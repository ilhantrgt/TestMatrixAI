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
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, RequirementItem, TestCase, TestRun, JiraConfig, Project } from './types';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as Record<string, string>);

const effectiveFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};

const app = initializeApp(effectiveFirebaseConfig);

const customDbId = env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

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
  staticTestReports?: Record<string, any>;
  staticTestSummary?: any;
  jiraConfig?: JiraConfig;
  updatedAt?: string;
}

/**
 * Deep sanitization for Firestore documents.
 * Converts `undefined` values to omitted keys or `null` to avoid Firestore schema rejection.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

/**
 * Optimizes and prunes payload object before sending to Firestore to strictly satisfy
 * Firestore's 1 MiB (1,048,576 bytes) single-document size limit.
 */
export function optimizePayloadForFirestoreLimit<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;

  const getByteSize = (obj: any) => {
    try {
      return new TextEncoder().encode(JSON.stringify(obj)).length;
    } catch {
      return 0;
    }
  };

  const MAX_ALLOWED_BYTES = 850000; // Safe threshold (850KB) under 1MB (1,048,576 bytes)

  if (getByteSize(payload) <= MAX_ALLOWED_BYTES) {
    return payload;
  }

  // Clone payload to prune safely without mutating state
  const target: any = JSON.parse(JSON.stringify(payload));

  const pruneProjectObj = (proj: any) => {
    if (!proj || typeof proj !== 'object') return;

    // Step 1: Prune staticTestReports verbose details (snippets, long rationale)
    if (proj.staticTestReports && typeof proj.staticTestReports === 'object') {
      const reports = proj.staticTestReports;
      Object.keys(reports).forEach((key) => {
        const rep = reports[key];
        if (rep && typeof rep === 'object') {
          if (Array.isArray(rep.findings) && rep.findings.length > 5) {
            rep.findings = rep.findings.slice(0, 5);
          }
          if (Array.isArray(rep.findings)) {
            rep.findings.forEach((f: any) => {
              if (typeof f.description === 'string' && f.description.length > 200) {
                f.description = f.description.slice(0, 200) + '...';
              }
              if (typeof f.recommendation === 'string' && f.recommendation.length > 200) {
                f.recommendation = f.recommendation.slice(0, 200) + '...';
              }
              delete f.offendingTextSnippet;
            });
          }
          if (typeof rep.improvedVersion === 'string' && rep.improvedVersion.length > 400) {
            rep.improvedVersion = rep.improvedVersion.slice(0, 400) + '...';
          }
        }
      });
    }

    if (getByteSize(target) <= MAX_ALLOWED_BYTES) return;

    // Step 2: Prune historical testRuns (keep last 3)
    if (Array.isArray(proj.testRuns) && proj.testRuns.length > 3) {
      proj.testRuns = proj.testRuns.slice(-3);
    }

    if (getByteSize(target) <= MAX_ALLOWED_BYTES) return;

    // Step 3: Trim raw requirement text if extremely large (> 80KB)
    if (typeof proj.requirementText === 'string' && proj.requirementText.length > 80000) {
      proj.requirementText = proj.requirementText.slice(0, 80000) + '\n\n[Dökümanda bulut saklama boyutu sınırı nedeniyle otomatik kısaltma yapıldı]';
    }

    if (getByteSize(target) <= MAX_ALLOWED_BYTES) return;

    // Step 4: Trim test case steps / stepExpectedResults if bloated
    if (Array.isArray(proj.testCases)) {
      proj.testCases.forEach((tc: any) => {
        if (typeof tc.description === 'string' && tc.description.length > 300) {
          tc.description = tc.description.slice(0, 300) + '...';
        }
        if (Array.isArray(tc.steps)) {
          tc.steps = tc.steps.map((s: any) => (typeof s === 'string' && s.length > 300 ? s.slice(0, 300) + '...' : s));
        }
        if (Array.isArray(tc.stepExpectedResults)) {
          tc.stepExpectedResults = tc.stepExpectedResults.map((s: any) => (typeof s === 'string' && s.length > 300 ? s.slice(0, 300) + '...' : s));
        }
      });
    }
  };

  // If top-level object is a project
  pruneProjectObj(target);

  // If top-level object is UserCloudWorkspace containing projects array
  if (Array.isArray(target.projects)) {
    target.projects.forEach(pruneProjectObj);
  }

  return target;
}

/**
 * Deterministic signature of project content (ignoring volatile timestamp strings).
 * Used to mathematically prevent redundant cloud writes and infinite bounce loops.
 */
export function getProjectContentSignature(project: Project): string {
  if (!project) return '';
  return JSON.stringify({
    id: project.id,
    name: project.name,
    description: project.description || '',
    ownerId: project.ownerId || '',
    ownerEmail: (project.ownerEmail || '').toLowerCase().trim(),
    sharedEmails: (project.sharedEmails || []).map((e) => e.toLowerCase().trim()).sort(),
    members: (project.members || []).map((m) => ({
      email: m.email.toLowerCase().trim(),
      role: m.role,
    })),
    isShared: Boolean(project.isShared),
    requirementText: project.requirementText || '',
    requirements: project.requirements || [],
    testCases: project.testCases || [],
    testRuns: project.testRuns || [],
    generationStats: project.generationStats || null,
    recommendations: project.recommendations || [],
    staticTestReports: project.staticTestReports || {},
    staticTestSummary: project.staticTestSummary || null,
  });
}

/**
 * Deterministic signature of workspace content.
 */
export function getWorkspaceContentSignature(data: UserCloudWorkspace): string {
  if (!data) return '';
  return JSON.stringify({
    projectsCount: (data.projects || []).length,
    activeProjectId: data.activeProjectId || '',
    requirementText: data.requirementText || '',
    requirementsCount: (data.requirements || []).length,
    testCasesCount: (data.testCases || []).length,
    testRunsCount: (data.testRuns || []).length,
    generationStats: data.generationStats || null,
    recommendations: data.recommendations || [],
    staticTestReports: data.staticTestReports || {},
    staticTestSummary: data.staticTestSummary || null,
    jiraConfig: data.jiraConfig || null,
    projectsSignatures: (data.projects || []).map(getProjectContentSignature),
  });
}

const QUOTA_STORAGE_KEY = 'tm_firestore_quota_exceeded_timestamp';

// Check if quota was exceeded recently (e.g. today)
function checkInitialQuotaStatus(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) return false;
    const timestamp = parseInt(raw, 10);
    // If recorded within last 20 hours, consider still in quota exhaustion window
    if (!isNaN(timestamp) && Date.now() - timestamp < 20 * 60 * 60 * 1000) {
      return true;
    }
  } catch {}
  return false;
}

// Track whether Firestore has hit quota limits today
let isFirestoreQuotaExceeded = checkInitialQuotaStatus();
const quotaSubscribers = new Set<(isExceeded: boolean) => void>();

export function getIsFirestoreQuotaExceeded(): boolean {
  return isFirestoreQuotaExceeded;
}

export function subscribeToQuotaStatus(listener: (isExceeded: boolean) => void): () => void {
  quotaSubscribers.add(listener);
  listener(isFirestoreQuotaExceeded);
  return () => {
    quotaSubscribers.delete(listener);
  };
}

export function getFirestoreUpgradeUrl(): string {
  const proj = firebaseConfig.projectId || 'xenon-conquest-wdw25';
  const dbId = firebaseConfig.firestoreDatabaseId || 'ai-studio-testmatrixaitest-713a3635-d7d5-41e6-bdf7-fba2aad7c71a';
  return `https://console.firebase.google.com/project/${proj}/firestore/databases/${dbId}/data?openUpgradeDialog=true`;
}

// Track the last serialized signature per user to prevent redundant writes
const lastKnownCloudSignatureMap: Record<string, string> = {};

// In-flight write tracking and coalescing queue
const inFlightWrites: Record<string, boolean> = {};
const pendingWrites: Record<string, UserCloudWorkspace> = {};

function isQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err?.message || err?.code || JSON.stringify(err);
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota') ||
    msg.includes('quota') ||
    err?.code === 'resource-exhausted'
  );
}

function handleQuotaWarning(context: string, err?: any) {
  if (!isFirestoreQuotaExceeded) {
    isFirestoreQuotaExceeded = true;
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, Date.now().toString());
    } catch {}
    quotaSubscribers.forEach((cb) => {
      try {
        cb(true);
      } catch {}
    });
  }

  // Clear in-flight queues to halt repeat failures
  Object.keys(pendingWrites).forEach((k) => delete pendingWrites[k]);
  Object.keys(inFlightWrites).forEach((k) => (inFlightWrites[k] = false));
  Object.keys(pendingSharedWrites).forEach((k) => delete pendingSharedWrites[k]);
  Object.keys(inFlightSharedWrites).forEach((k) => (inFlightSharedWrites[k] = false));

  console.warn(
    `[TestMatrix AI] Firebase Firestore günlük kota sınırına ulaşıldı (${context}): Veriler yerel tarayıcı hafızasında (Local Storage) korunmaktadır.`,
    err?.message || err
  );
}

/**
 * Saves user profile to Firestore `users/{userId}` document
 */
export async function saveUserProfileToCloud(user: UserProfile): Promise<void> {
  if (!user?.id || isFirestoreQuotaExceeded) return;
  try {
    const userRef = doc(db, 'users', user.id);
    const sanitizedUser = sanitizeForFirestore({
      ...user,
      email: (user.email || '').toLowerCase().trim(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(userRef, sanitizedUser, { merge: true });
  } catch (error: any) {
    if (isQuotaError(error)) {
      handleQuotaWarning('saveUserProfileToCloud', error);
      return;
    }
    console.warn('[TestMatrix AI Firebase] saveUserProfileToCloud warning:', error?.message || error);
  }
}

/**
 * Loads user profile from Firestore `users/{userId}` document
 */
export async function loadUserProfileFromCloud(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (error: any) {
    if (isQuotaError(error)) {
      handleQuotaWarning('loadUserProfileFromCloud', error);
      return null;
    }
    console.warn('[TestMatrix AI Firebase] loadUserProfileFromCloud warning:', error?.message || error);
  }
  return null;
}

/**
 * Searches for a user profile in Firestore by email address
 */
export async function findUserInCloudByEmail(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      return docData as UserProfile;
    }
  } catch (error: any) {
    if (isQuotaError(error)) {
      handleQuotaWarning('findUserInCloudByEmail', error);
      return null;
    }
    console.warn('[TestMatrix AI Firebase] findUserInCloudByEmail warning:', error?.message || error);
  }
  return null;
}

/**
 * Saves user workspace data (requirements, test cases, test runs, stats) to `userData/{userId}`
 * Uses content signature deduplication to prevent runaway write loops.
 */
export async function saveUserDataToCloud(
  userId: string,
  data: UserCloudWorkspace
): Promise<void> {
  if (!userId || isFirestoreQuotaExceeded) return;

  const signature = getWorkspaceContentSignature(data);
  if (lastKnownCloudSignatureMap[userId] === signature) {
    return;
  }

  // If a write is currently in flight for this user, queue this payload and return
  if (inFlightWrites[userId]) {
    pendingWrites[userId] = data;
    return;
  }

  inFlightWrites[userId] = true;
  lastKnownCloudSignatureMap[userId] = signature;

  try {
    const dataRef = doc(db, 'userData', userId);
    const sanitizedPayload = optimizePayloadForFirestoreLimit(
      sanitizeForFirestore({
        ...data,
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(dataRef, sanitizedPayload, { merge: true });
  } catch (error: any) {
    if (isQuotaError(error)) {
      handleQuotaWarning('saveUserDataToCloud', error);
      delete pendingWrites[userId];
      inFlightWrites[userId] = false;
      return;
    }
    console.warn('[TestMatrix AI Firebase] saveUserDataToCloud warning:', error?.message || error);
  } finally {
    inFlightWrites[userId] = false;

    if (!isFirestoreQuotaExceeded && pendingWrites[userId]) {
      const nextData = pendingWrites[userId];
      delete pendingWrites[userId];
      setTimeout(() => {
        saveUserDataToCloud(userId, nextData);
      }, 1000);
    }
  }
}

/**
 * Loads user workspace data from `userData/{userId}`
 */
export async function loadUserDataFromCloud(userId: string): Promise<UserCloudWorkspace | null> {
  if (!userId) return null;
  try {
    const dataRef = doc(db, 'userData', userId);
    const snap = await getDoc(dataRef);
    if (snap.exists()) {
      const result = snap.data() as UserCloudWorkspace;
      lastKnownCloudSignatureMap[userId] = getWorkspaceContentSignature(result);
      return result;
    }
  } catch (error: any) {
    if (isQuotaError(error)) {
      handleQuotaWarning('loadUserDataFromCloud', error);
      return null;
    }
    console.warn('[TestMatrix AI Firebase] loadUserDataFromCloud warning:', error?.message || error);
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
  if (!userId) return () => {};
  const dataRef = doc(db, 'userData', userId);
  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(
      dataRef,
      (snap) => {
        if (snap.exists()) {
          const cloudData = snap.data() as UserCloudWorkspace;
          lastKnownCloudSignatureMap[userId] = getWorkspaceContentSignature(cloudData);
          onData(cloudData);
        }
      },
      (error: any) => {
        if (isQuotaError(error)) {
          handleQuotaWarning('subscribeToUserData', error);
          return;
        }
        console.warn('[TestMatrix AI Firebase] subscribeToUserData listener warning:', error?.message || error);
      }
    );
  } catch (err: any) {
    if (isQuotaError(err)) {
      handleQuotaWarning('subscribeToUserData outer', err);
    }
  }

  return () => {
    if (unsub) {
      try { unsub(); } catch {}
    }
  };
}

/**
 * ========================================================
 * SHARED PROJECTS (MULTI-USER COLLABORATION & HYBRID SYNC)
 * Stored under `sharedProjects/{projectId}` + Local Hybrid Store
 * ========================================================
 */

const SHARED_PROJECTS_STORAGE_KEY = 'tm_shared_projects_store';
const lastKnownSharedSignatureMap: Record<string, string> = {};
const inFlightSharedWrites: Record<string, boolean> = {};
const pendingSharedWrites: Record<string, Project> = {};

/**
 * Retrieves all locally cached shared projects.
 */
export function getLocalSharedProjects(): Project[] {
  try {
    const raw = localStorage.getItem(SHARED_PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Saves a shared project to local storage and broadcasts across browser tabs.
 */
export function saveLocalSharedProject(project: Project): void {
  try {
    const existing = getLocalSharedProjects();
    const updated = [
      ...existing.filter((p) => p.id !== project.id),
      project,
    ];
    localStorage.setItem(SHARED_PROJECTS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('tm_shared_projects_channel');
      ch.postMessage({ type: 'PROJECT_UPDATED', project });
      ch.close();
    }
  } catch {}
}

/**
 * Deletes a shared project from local storage and broadcasts.
 */
export function deleteLocalSharedProject(projectId: string): void {
  try {
    const existing = getLocalSharedProjects();
    const updated = existing.filter((p) => p.id !== projectId);
    localStorage.setItem(SHARED_PROJECTS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('tm_shared_projects_channel');
      ch.postMessage({ type: 'PROJECT_DELETED', projectId });
      ch.close();
    }
  } catch {}
}

/**
 * Saves a shared project to `sharedProjects/{projectId}` with signature deduplication
 * and local fallback so collaboration never breaks.
 */
export async function saveSharedProjectToCloud(project: Project, force = false): Promise<void> {
  if (!project?.id) return;

  const projectId = project.id;
  const normalizedOwnerEmail = (project.ownerEmail || '').toLowerCase().trim();
  const members = (project.members || []).map((m) => ({
    ...m,
    email: (m.email || '').toLowerCase().trim(),
  }));

  // Guarantee all allowed emails are gathered in lowercase
  const sharedEmailsSet = new Set<string>();
  if (normalizedOwnerEmail) sharedEmailsSet.add(normalizedOwnerEmail);
  if (project.sharedEmails && Array.isArray(project.sharedEmails)) {
    project.sharedEmails.forEach((e) => {
      if (e) sharedEmailsSet.add(e.toLowerCase().trim());
    });
  }
  members.forEach((m) => {
    if (m?.email) sharedEmailsSet.add(m.email);
  });

  const cleanedProject: Project = {
    ...project,
    isShared: true,
    ownerEmail: normalizedOwnerEmail || undefined,
    sharedEmails: Array.from(sharedEmailsSet),
    members,
  };

  // 1. Always save to local multi-user store and broadcast across tabs
  saveLocalSharedProject(cleanedProject);

  if (isFirestoreQuotaExceeded) {
    return;
  }

  // 2. Check content signature: If identical to last saved and not forced, skip redundant network write
  const signature = getProjectContentSignature(cleanedProject);
  if (!force && lastKnownSharedSignatureMap[projectId] === signature) {
    return;
  }

  if (inFlightSharedWrites[projectId] && !force) {
    pendingSharedWrites[projectId] = cleanedProject;
    return;
  }

  inFlightSharedWrites[projectId] = true;
  lastKnownSharedSignatureMap[projectId] = signature;

  try {
    const projRef = doc(db, 'sharedProjects', projectId);
    const sanitizedPayload = optimizePayloadForFirestoreLimit(
      sanitizeForFirestore({
        ...cleanedProject,
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(projRef, sanitizedPayload, { merge: true });
    console.info(`[TestMatrix AI Firebase] Shared project persisted to Firestore: ${projectId}`);
  } catch (error: any) {
    if (isQuotaError(error)) {
      handleQuotaWarning('saveSharedProjectToCloud', error);
      delete pendingSharedWrites[projectId];
      return;
    }
    console.warn('[TestMatrix AI Firebase] saveSharedProjectToCloud warning:', error?.message || error);
    delete pendingSharedWrites[projectId];
  } finally {
    inFlightSharedWrites[projectId] = false;
    if (!isFirestoreQuotaExceeded && pendingSharedWrites[projectId]) {
      const nextData = pendingSharedWrites[projectId];
      delete pendingSharedWrites[projectId];
      setTimeout(() => {
        saveSharedProjectToCloud(nextData);
      }, 1000);
    }
  }
}

/**
 * Directly fetch a shared project by ID from Firestore
 */
export async function getSharedProjectById(projectId: string): Promise<Project | null> {
  if (!projectId) return null;
  try {
    const projRef = doc(db, 'sharedProjects', projectId);
    const snap = await getDoc(projRef);
    if (snap.exists()) {
      return snap.data() as Project;
    }
  } catch (e: any) {
    console.warn('[TestMatrix AI Firebase] getSharedProjectById error:', e?.message || e);
  }
  return null;
}

/**
 * Deletes a shared project from `sharedProjects/{projectId}` and local store.
 */
export async function deleteSharedProjectFromCloud(projectId: string): Promise<void> {
  if (!projectId) return;

  deleteLocalSharedProject(projectId);
  delete lastKnownSharedSignatureMap[projectId];

  try {
    const projRef = doc(db, 'sharedProjects', projectId);
    await deleteDoc(projRef);
  } catch (error: any) {
    console.warn('[TestMatrix AI Firebase] deleteSharedProjectFromCloud warning:', error?.message || error);
  }
}

/**
 * Helper to test if a project is accessible by a user
 */
export function checkProjectMatchesUser(p: Project, email: string, userId?: string): boolean {
  if (!p) return false;
  const normalizedEmail = (email || '').toLowerCase().trim();
  const inSharedEmails = (p.sharedEmails || []).some(
    (e) => e && e.toLowerCase().trim() === normalizedEmail
  );
  const inMembers = (p.members || []).some(
    (m) => m?.email && m.email.toLowerCase().trim() === normalizedEmail
  );
  const isOwner =
    (p.ownerEmail && p.ownerEmail.toLowerCase().trim() === normalizedEmail) ||
    Boolean(userId && p.ownerId && p.ownerId === userId);
  return Boolean(inSharedEmails || inMembers || isOwner);
}

/**
 * Loads all shared projects accessible by the current user (hybrid: Local + Firestore)
 */
export async function loadSharedProjectsForUser(
  email: string,
  userId: string
): Promise<Project[]> {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const foundProjectsMap: Record<string, Project> = {};

  // 1. First retrieve from local hybrid store
  const localProjects = getLocalSharedProjects();
  localProjects.forEach((lp) => {
    if (checkProjectMatchesUser(lp, normalizedEmail, userId)) {
      foundProjectsMap[lp.id] = { ...lp, isShared: true };
    }
  });

  // 2. Fetch all shared projects from Firestore and filter
  if (normalizedEmail || userId) {
    try {
      const sharedRef = collection(db, 'sharedProjects');
      const allSnap = await getDocs(sharedRef);
      allSnap.forEach((docSnap) => {
        const data = docSnap.data() as Project;
        if (checkProjectMatchesUser(data, normalizedEmail, userId)) {
          foundProjectsMap[data.id] = { ...data, isShared: true };
          saveLocalSharedProject(data);
        }
      });
    } catch (error: any) {
      console.warn('[TestMatrix AI Firebase] loadSharedProjectsForUser warning:', error?.message || error);
    }
  }

  return Object.values(foundProjectsMap);
}

/**
 * Real-time listener for ALL shared projects accessible by this user.
 * Supports cross-tab BroadcastChannel and Firestore onSnapshot.
 */
export function subscribeToSharedProjectsForUser(
  email: string,
  userId: string,
  onUpdate: (projects: Project[]) => void
): () => void {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const projectsById: Record<string, Project> = {};

  // Seed with local shared projects
  const localProjects = getLocalSharedProjects();
  localProjects.forEach((lp) => {
    if (checkProjectMatchesUser(lp, normalizedEmail, userId)) {
      projectsById[lp.id] = { ...lp, isShared: true };
    }
  });

  const emit = () => {
    onUpdate(Object.values(projectsById));
  };

  // Immediate initial emission
  emit();

  const unsubs: (() => void)[] = [];

  // Listen to BroadcastChannel for cross-tab sharing
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('tm_shared_projects_channel');
    channel.onmessage = (event) => {
      const { type, project, projectId } = event.data || {};
      if (type === 'PROJECT_UPDATED' && project) {
        if (checkProjectMatchesUser(project, normalizedEmail, userId)) {
          projectsById[project.id] = { ...project, isShared: true };
          emit();
        } else {
          delete projectsById[project.id];
          emit();
        }
      } else if (type === 'PROJECT_DELETED' && projectId) {
        delete projectsById[projectId];
        emit();
      }
    };
    unsubs.push(() => channel.close());
  }

  // Real-time Firestore listener on entire sharedProjects collection
  try {
    const sharedRef = collection(db, 'sharedProjects');
    const unsub = onSnapshot(
      sharedRef,
      (snap) => {
        snap.docChanges().forEach((change) => {
          const docId = change.doc.id;
          if (change.type === 'removed') {
            delete projectsById[docId];
          } else {
            const data = change.doc.data() as Project;
            if (checkProjectMatchesUser(data, normalizedEmail, userId)) {
              projectsById[docId] = { ...data, isShared: true };
              saveLocalSharedProject(data);
            } else {
              delete projectsById[docId];
            }
          }
        });
        emit();
      },
      (error) => {
        console.warn('[TestMatrix AI Firebase] Realtime shared projects listener warning:', error?.message || error);
      }
    );
    unsubs.push(unsub);
  } catch (err: any) {
    console.warn('[TestMatrix AI Firebase] subscribeToSharedProjectsForUser outer error:', err?.message || err);
  }

  return () => {
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
}

/**
 * Real-time listener for a single shared project document.
 * Listens to BroadcastChannel and Firestore with content signature deduplication.
 */
export function subscribeToSharedProject(
  projectId: string,
  onUpdate: (project: Project) => void
): () => void {
  if (!projectId) return () => {};

  const unsubs: (() => void)[] = [];

  // 1. Cross-tab channel listener
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('tm_shared_projects_channel');
    channel.onmessage = (event) => {
      const { type, project } = event.data || {};
      if (type === 'PROJECT_UPDATED' && project && project.id === projectId) {
        const sig = getProjectContentSignature(project);
        if (lastKnownSharedSignatureMap[projectId] !== sig) {
          lastKnownSharedSignatureMap[projectId] = sig;
          onUpdate(project);
        }
      }
    };
    unsubs.push(() => channel.close());
  }

  // 2. Firestore document listener
  try {
    const projRef = doc(db, 'sharedProjects', projectId);
    const unsubDoc = onSnapshot(
      projRef,
      (snap) => {
        if (snap.exists()) {
          const proj = snap.data() as Project;
          const sig = getProjectContentSignature(proj);
          if (lastKnownSharedSignatureMap[projectId] !== sig) {
            lastKnownSharedSignatureMap[projectId] = sig;
            saveLocalSharedProject(proj);
            onUpdate(proj);
          }
        }
      },
      (error: any) => {
        if (isQuotaError(error)) {
          handleQuotaWarning('subscribeToSharedProject', error);
          return;
        }
        console.warn('[TestMatrix AI Firebase] subscribeToSharedProject listener warning:', error?.message || error);
      }
    );
    unsubs.push(unsubDoc);
  } catch (err: any) {
    if (isQuotaError(err)) {
      handleQuotaWarning('subscribeToSharedProject outer', err);
    }
  }

  return () => {
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
}
