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
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, RequirementItem, TestCase, TestRun } from './types';

const app = initializeApp(firebaseConfig);

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export interface UserCloudWorkspace {
  requirementText?: string;
  requirements?: RequirementItem[];
  testCases?: TestCase[];
  testRuns?: TestRun[];
  generationStats?: any;
  recommendations?: string[];
  updatedAt?: string;
}

/**
 * Saves user profile to Firestore `users/{userId}` document
 */
export async function saveUserProfileToCloud(user: UserProfile): Promise<void> {
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
  } catch (error) {
    console.warn('Firebase saveUserProfileToCloud warning:', error);
  }
}

/**
 * Loads user profile from Firestore `users/{userId}` document
 */
export async function loadUserProfileFromCloud(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (error) {
    console.warn('Firebase loadUserProfileFromCloud warning:', error);
  }
  return null;
}

/**
 * Searches for a user profile in Firestore by email address
 */
export async function findUserInCloudByEmail(email: string): Promise<UserProfile | null> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      return docData as UserProfile;
    }
  } catch (error) {
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
  if (!userId) return;
  try {
    const dataRef = doc(db, 'userData', userId);
    // Remove undefined values
    const cleanData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.requirementText !== undefined) cleanData.requirementText = data.requirementText;
    if (data.requirements !== undefined) cleanData.requirements = data.requirements;
    if (data.testCases !== undefined) cleanData.testCases = data.testCases;
    if (data.testRuns !== undefined) cleanData.testRuns = data.testRuns;
    if (data.generationStats !== undefined) cleanData.generationStats = data.generationStats;
    if (data.recommendations !== undefined) cleanData.recommendations = data.recommendations;

    await setDoc(dataRef, cleanData, { merge: true });
  } catch (error) {
    console.warn('Firebase saveUserDataToCloud warning:', error);
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
      return snap.data() as UserCloudWorkspace;
    }
  } catch (error) {
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
  if (!userId) return () => {};
  const dataRef = doc(db, 'userData', userId);
  return onSnapshot(
    dataRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserCloudWorkspace);
      }
    },
    (error) => {
      console.warn('Firebase subscribeToUserData listener error:', error);
    }
  );
}
