import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const databaseId = firebaseConfig.firestoreDatabaseId;
export const db = getFirestore(app, databaseId || undefined);
export const auth = getAuth();
