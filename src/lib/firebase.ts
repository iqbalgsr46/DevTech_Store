// Firebase Configuration
// Inisialisasi Firebase App, Realtime Database, dan Auth
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  ...(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? { databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL } : {}),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Cegah inisialisasi ganda (hot reload di dev)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? getDatabase(app) : null;
export const auth = getAuth(app);
export default app;
