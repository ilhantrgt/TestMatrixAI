import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  disableNetwork,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, RequirementItem, TestCase, TestRun, JiraConfig, Project } from './types';

const effectiveFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};

const app = initializeApp(effectiveFirebaseConfig);

const customDbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  (import.meta.env.VITE_FIREBASE_PROJECT_ID ? undefined : firebaseConfig.firestoreDatabaseId);

export const db = customDbId
  ? getFirestore(app, customDbId)
  : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface UserCloudWorkspace {
  projects?: Project[];
  activeProjectId?: string;
  requirementText?: string;
  requirements?: RequirementItem[];
  testCases?: TestCase[];
  testRuns?: TestRun[];
  generationStats?: any;
  recommendations?: string[];
  jiraConfig?: JiraConfig;
  updatedAt?: string;
}

let isFirestoreQuotaExceeded = false;

// Track the last serialized data string per user to prevent redundant writes
const lastKnownCloudDataMap: Record<string, string> = {};

// In-flight write tracking and coalescing queue
const inFlightWrites: Record<string, boolean> = {};
const pendingWrites: Record<string, UserCloudWorkspace> = {};

function isQuotaOrResourceExhausted(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err?.message || err?.code || JSON.stringify(err);
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('exhausted maximum allowed queued writes') ||
    msg.includes('maximum allowed queued writes') ||
    msg.includes('Quota') ||
    msg.includes('quota') ||
    err?.code === 'resource-exhausted'
  );
}

function handleQuotaExceeded(err?: any) {
  if (!isFirestoreQuotaExceeded) {
    isFirestoreQuotaExceeded = true;
    console.info(
      '[TestMatrix AI] Firebase Firestore kotası veya yazma kuyruğu doldu. Verileriniz kesintisiz şekilde yerel tarayıcı hafızasında (localStorage) saklanmaya devam edecektir.'
    );
    try {
      disableNetwork(db).catch(() => {});
    } catch {}
  }
}

/**
 * Saves user profile to Firestore `users/{userId}` document
 */
export async function saveUserProfileToCloud(user: UserProfile): Promise<void> {
  if (!user?.id || isFirestoreQuotaExceeded) return;
  try {
    const userRef = doc(db, 'users', user.id);
    await setDoc(
      userRef,
      {
        ...user,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error: any) {
    if (isQuotaOrResourceExhausted(error)) {
      handleQuotaExceeded(error);
      return;
    }
    console.warn('Firebase saveUserProfileToCloud warning:', error);
  }
}

/**
 * Loads user profile from Firestore `users/{userId}` document
 */
export async function loadUserProfileFromCloud(userId: string): Promise<UserProfile | null> {
  if (!userId || isFirestoreQuotaExceeded) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (error: any) {
    if (isQuotaOrResourceExhausted(error)) {
      handleQuotaExceeded(error);
      return null;
    }
    console.warn('Firebase loadUserProfileFromCloud warning:', error);
  }
  return null;
}

/**
 * Searches for a user profile in Firestore by email address
 */
export async function findUserInCloudByEmail(email: string): Promise<UserProfile | null> {
  if (!email || isFirestoreQuotaExceeded) return null;
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      return docData as UserProfile;
    }
  } catch (error: any) {
    if (isQuotaOrResourceExhausted(error)) {
      handleQuotaExceeded(error);
      return null;
    }
    console.warn('Firebase findUserInCloudByEmail warning:', error);
  }
  return null;
}

/**
 * Saves user workspace data (requirements, test cases, test runs, stats) to `userData/{userId}`
 * Uses coalesced queuing and deduplication to avoid write stream exhaustion.
 */
export async function saveUserDataToCloud(
  userId: string,
  data: UserCloudWorkspace
): Promise<void> {
  if (!userId || isFirestoreQuotaExceeded) return;

  // Clean data structure
  const cleanData: Record<string, any> = {};
  if (data.projects !== undefined) cleanData.projects = data.projects;
  if (data.activeProjectId !== undefined) cleanData.activeProjectId = data.activeProjectId;
  if (data.requirementText !== undefined) cleanData.requirementText = data.requirementText;
  if (data.requirements !== undefined) cleanData.requirements = data.requirements;
  if (data.testCases !== undefined) cleanData.testCases = data.testCases;
  if (data.testRuns !== undefined) cleanData.testRuns = data.testRuns;
  if (data.generationStats !== undefined) cleanData.generationStats = data.generationStats;
  if (data.recommendations !== undefined) cleanData.recommendations = data.recommendations;
  if (data.jiraConfig !== undefined) cleanData.jiraConfig = data.jiraConfig;

  // Compare with last known saved/received cloud state to prevent echo loops
  const serialized = JSON.stringify(cleanData);
  if (lastKnownCloudDataMap[userId] === serialized) {
    return;
  }

  // If a write is currently in flight for this user, queue this payload and return
  if (inFlightWrites[userId]) {
    pendingWrites[userId] = data;
    return;
  }

  inFlightWrites[userId] = true;
  lastKnownCloudDataMap[userId] = serialized;

  try {
    const dataRef = doc(db, 'userData', userId);
    await setDoc(dataRef, { ...cleanData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error: any) {
    if (isQuotaOrResourceExhausted(error)) {
      handleQuotaExceeded(error);
      delete pendingWrites[userId];
      inFlightWrites[userId] = false;
      return;
    }
    console.warn('Firebase saveUserDataToCloud warning:', error);
  } finally {
    inFlightWrites[userId] = false;

    // Process any coalesced pending write that arrived while the previous one was running
    if (pendingWrites[userId] && !isFirestoreQuotaExceeded) {
      const nextData = pendingWrites[userId];
      delete pendingWrites[userId];
      // Schedule next write cleanly
      setTimeout(() => {
        saveUserDataToCloud(userId, nextData);
      }, 500);
    }
  }
}

/**
 * Loads user workspace data from `userData/{userId}`
 */
export async function loadUserDataFromCloud(userId: string): Promise<UserCloudWorkspace | null> {
  if (!userId || isFirestoreQuotaExceeded) return null;
  try {
    const dataRef = doc(db, 'userData', userId);
    const snap = await getDoc(dataRef);
    if (snap.exists()) {
      const result = snap.data() as UserCloudWorkspace;
      // Record last known state
      const cleanData: Record<string, any> = {};
      if (result.projects !== undefined) cleanData.projects = result.projects;
      if (result.activeProjectId !== undefined) cleanData.activeProjectId = result.activeProjectId;
      if (result.requirementText !== undefined) cleanData.requirementText = result.requirementText;
      if (result.requirements !== undefined) cleanData.requirements = result.requirements;
      if (result.testCases !== undefined) cleanData.testCases = result.testCases;
      if (result.testRuns !== undefined) cleanData.testRuns = result.testRuns;
      if (result.generationStats !== undefined) cleanData.generationStats = result.generationStats;
      if (result.recommendations !== undefined) cleanData.recommendations = result.recommendations;
      if (result.jiraConfig !== undefined) cleanData.jiraConfig = result.jiraConfig;
      lastKnownCloudDataMap[userId] = JSON.stringify(cleanData);
      return result;
    }
  } catch (error: any) {
    if (isQuotaOrResourceExhausted(error)) {
      handleQuotaExceeded(error);
      return null;
    }
    console.warn('Firebase loadUserDataFromCloud warning:', error);
  }
  return null;
}

/**
 * Real-time listener for user workspace changes across devices or tabs
 */
export function subscribeToUserData(
  userId: string,
  onData: (data: UserCloudWorkspace) => void
): () => void {
  if (!userId || isFirestoreQuotaExceeded) return () => {};
  const dataRef = doc(db, 'userData', userId);
  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(
      dataRef,
      (snap) => {
        if (snap.exists()) {
          const cloudData = snap.data() as UserCloudWorkspace;
          // Record last known cloud data to avoid feedback loops
          const cleanData: Record<string, any> = {};
          if (cloudData.projects !== undefined) cleanData.projects = cloudData.projects;
          if (cloudData.activeProjectId !== undefined) cleanData.activeProjectId = cloudData.activeProjectId;
          if (cloudData.requirementText !== undefined) cleanData.requirementText = cloudData.requirementText;
          if (cloudData.requirements !== undefined) cleanData.requirements = cloudData.requirements;
          if (cloudData.testCases !== undefined) cleanData.testCases = cloudData.testCases;
          if (cloudData.testRuns !== undefined) cleanData.testRuns = cloudData.testRuns;
          if (cloudData.generationStats !== undefined) cleanData.generationStats = cloudData.generationStats;
          if (cloudData.recommendations !== undefined) cleanData.recommendations = cloudData.recommendations;
          if (cloudData.jiraConfig !== undefined) cleanData.jiraConfig = cloudData.jiraConfig;
          lastKnownCloudDataMap[userId] = JSON.stringify(cleanData);

          onData(cloudData);
        }
      },
      (error: any) => {
        if (isQuotaOrResourceExhausted(error)) {
          handleQuotaExceeded(error);
          if (unsub) {
            try { unsub(); } catch {}
          }
          return;
        }
        console.warn('Firebase subscribeToUserData listener warning:', error);
      }
    );
  } catch (err: any) {
    if (isQuotaOrResourceExhausted(err)) {
      handleQuotaExceeded(err);
    }
  }

  return () => {
    if (unsub) {
      try { unsub(); } catch {}
    }
  };
}

/**
 * SHARED PROJECTS (MULTI-USER COLLABORATION)
 * Stored under `sharedProjects/{projectId}`
 */

const lastKnownSharedProjectMap: Record<string, string> = {};
const inFlightSharedWrites: Record<string, boolean> = {};
const pendingSharedWrites: Record<string, Project> = {};

/**
 * Saves a shared project to `sharedProjects/{projectId}` with coalesced writes and deduplication
 */
export async function saveSharedProjectToCloud(project: Project): Promise<void> {
  if (!project?.id || isFirestoreQuotaExceeded) return;

  const projectId = project.id;
  const serialized = JSON.stringify(project);
  if (lastKnownSharedProjectMap[projectId] === serialized) {
    return;
  }

  if (inFlightSharedWrites[projectId]) {
    pendingSharedWrites[projectId] = project;
    return;
  }

  inFlightSharedWrites[projectId] = true;
  lastKnownSharedProjectMap[projectId] = serialized;

  try {
    const projRef = doc(db, 'sharedProjects', projectId);
    await setDoc(
      projRef,
      {
        ...project,
        isShared: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error: any) {
    if (isQuotaOrResourceExhausted(error)) {
      handleQuotaExceeded(error);
      delete pendingSharedWrites[projectId];
      inFlightSharedWrites[projectId] = false;
      return;
    }
    console.warn('Firebase saveSharedProjectToCloud warning:', error);
  } finally {
    inFlightSharedWrites[projectId] = false;
    if (pendingSharedWrites[projectId] && !isFirestoreQuotaExceeded) {
      const nextData = pendingSharedWrites[projectId];
      delete pendingSharedWrites[projectId];
      setTimeout(() => {
        saveSharedProjectToCloud(nextData);
      }, 500);
    }
  }
}

/**
 * Deletes a shared project from `sharedProjects/{projectId}`
 */
export async function deleteSharedProjectFromCloud(projectId: string): Promise<void> {
  if (!projectId || isFirestoreQuotaExceeded) return;
  try {
    const projRef = doc(db, 'sharedProjects', projectId);
    await deleteDoc(projRef);
    delete lastKnownSharedProjectMap[projectId];
  } catch (error: any) {
    if (isQuotaOrResourceExhausted(error)) {
      handleQuotaExceeded(error);
      return;
    }
    console.warn('Firebase deleteSharedProjectFromCloud warning:', error);
  }
}

/**
 * Loads all shared projects accessible by the current user (either as owner or as invited collaborator)
 */
export async function loadSharedProjectsForUser(
  email: string,
  userId: string
): Promise<Project[]> {
  if ((!email && !userId) || isFirestoreQuotaExceeded) return [];

  const foundProjectsMap: Record<string, Project> = {};
  const normalizedEmail = (email || '').toLowerCase().trim();

  try {
    const sharedRef = collection(db, 'sharedProjects');

    // 1. Query projects where the user's email is in sharedEmails array
    if (normalizedEmail) {
      const qEmail = query(
        sharedRef,
        where('sharedEmails', 'array-contains', normalizedEmail)
      );
      const emailSnap = await getDocs(qEmail);
      emailSnap.forEach((docSnap) => {
        const data = docSnap.data() as Project;
        foundProjectsMap[data.id] = data;
      });
    }

    // 2. Query projects where the user is the owner
    if (userId) {
      const qOwner = query(sharedRef, where('ownerId', '==', userId));
      const ownerSnap = await getDocs(qOwner);
      ownerSnap.forEach((docSnap) => {
        const data = docSnap.data() as Project;
        foundProjectsMap[data.id] = data;
      });
    }
  } catch (error: any) {
    if (isQuotaOrResourceExhausted(error)) {
      handleQuotaExceeded(error);
      return [];
    }
    console.warn('Firebase loadSharedProjectsForUser warning:', error);
  }

  return Object.values(foundProjectsMap);
}

/**
 * Real-time listener for a single shared project document
 */
export function subscribeToSharedProject(
  projectId: string,
  onUpdate: (project: Project) => void
): () => void {
  if (!projectId || isFirestoreQuotaExceeded) return () => {};

  const projRef = doc(db, 'sharedProjects', projectId);
  let unsub: (() => void) | null = null;

  try {
    unsub = onSnapshot(
      projRef,
      (snap) => {
        if (snap.exists()) {
          const proj = snap.data() as Project;
          lastKnownSharedProjectMap[projectId] = JSON.stringify(proj);
          onUpdate(proj);
        }
      },
      (error: any) => {
        if (isQuotaOrResourceExhausted(error)) {
          handleQuotaExceeded(error);
          if (unsub) {
            try { unsub(); } catch {}
          }
          return;
        }
        console.warn('Firebase subscribeToSharedProject listener warning:', error);
      }
    );
  } catch (err: any) {
    if (isQuotaOrResourceExhausted(err)) {
      handleQuotaExceeded(err);
    }
  }

  return () => {
    if (unsub) {
      try { unsub(); } catch {}
    }
  };
}

