/**
 * Firebase Client SDK — browser-only singleton
 *
 * This file is imported by "use client" components only.
 * It is NOT safe to import from server code or from modules that
 * run during SSR/build phases — doing so causes:
 *   TypeError: (0 , _appinfolog.getEnvInfo) is not a function
 * because Firebase v12 tries to detect the browser environment at
 * module-load time which breaks in Node.js contexts.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy singletons — only initialized when first accessed IN THE BROWSER.
// Top-level code intentionally does NOT call initializeApp() so that
// Next.js SSR module-graph tracing never triggers Firebase's env detection.
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }
  return _app;
}

export function getDb(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp());
  return _db;
}

export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

// Convenience re-exports as getters so existing code that does
//   import { db, auth } from "@/lib/firebase"
// still compiles — but the values are now lazy.
export const db = new Proxy({} as Firestore, {
  get(_t, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const auth = new Proxy({} as Auth, {
  get(_t, prop) {
    return (getClientAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export default {
  get app() { return getFirebaseApp(); },
};
