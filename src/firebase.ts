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

const customDbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

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

function handleQuotaExceeded(err?: any) {
  if (!isFirestoreQuotaExceeded) {
    isFirestoreQuotaExceeded = true;
    console.info(
      '[TestMatrix AI] Firebase Firestore günlük ücretsiz kotası doldu. Verileriniz yerel tarayıcı hafızasında (localStorage) güvenle saklanmaya devam edecektir.'
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
  if (isFirestoreQuotaExceeded) return;
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
    if (
      error?.code === 'resource-exhausted' ||
      String(error).includes('resource-exhausted') ||
      String(error).includes('Quota')
    ) {
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
  if (isFirestoreQuotaExceeded) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (error: any) {
    if (
      error?.code === 'resource-exhausted' ||
      String(error).includes('resource-exhausted') ||
      String(error).includes('Quota')
    ) {
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
  if (isFirestoreQuotaExceeded) return null;
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      return docData as UserProfile;
    }
  } catch (error: any) {
    if (
      error?.code === 'resource-exhausted' ||
      String(error).includes('resource-exhausted') ||
      String(error).includes('Quota')
    ) {
      handleQuotaExceeded(error);
      return null;
    }
    console.warn('Firebase findUserInCloudByEmail warning:', error);
  }
  return null;
}

/**
 * Saves user workspace data (requirements, test cases, test runs, stats) to `userData/{userId}`
 */
export async function saveUserDataToCloud(
  userId: string,
  data: UserCloudWorkspace
): Promise<void> {
  if (!userId || isFirestoreQuotaExceeded) return;
  try {
    const dataRef = doc(db, 'userData', userId);
    // Remove undefined values
    const cleanData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.projects !== undefined) cleanData.projects = data.projects;
    if (data.activeProjectId !== undefined) cleanData.activeProjectId = data.activeProjectId;
    if (data.requirementText !== undefined) cleanData.requirementText = data.requirementText;
    if (data.requirements !== undefined) cleanData.requirements = data.requirements;
    if (data.testCases !== undefined) cleanData.testCases = data.testCases;
    if (data.testRuns !== undefined) cleanData.testRuns = data.testRuns;
    if (data.generationStats !== undefined) cleanData.generationStats = data.generationStats;
    if (data.recommendations !== undefined) cleanData.recommendations = data.recommendations;
    if (data.jiraConfig !== undefined) cleanData.jiraConfig = data.jiraConfig;

    await setDoc(dataRef, cleanData, { merge: true });
  } catch (error: any) {
    if (
      error?.code === 'resource-exhausted' ||
      String(error).includes('resource-exhausted') ||
      String(error).includes('Quota')
    ) {
      handleQuotaExceeded(error);
      return;
    }
    console.warn('Firebase saveUserDataToCloud warning:', error);
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
      return snap.data() as UserCloudWorkspace;
    }
  } catch (error: any) {
    if (
      error?.code === 'resource-exhausted' ||
      String(error).includes('resource-exhausted') ||
      String(error).includes('Quota')
    ) {
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
          onData(snap.data() as UserCloudWorkspace);
        }
      },
      (error: any) => {
        if (
          error?.code === 'resource-exhausted' ||
          String(error).includes('resource-exhausted') ||
          String(error).includes('Quota')
        ) {
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
    handleQuotaExceeded(err);
  }

  return () => {
    if (unsub) {
      try { unsub(); } catch {}
    }
  };
}
