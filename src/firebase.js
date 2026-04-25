// ═══════════════════════════════════════════════════════════════════════════
// 🔥 CONFIGURACIÓN FIREBASE
// ═══════════════════════════════════════════════════════════════════════════
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const FIREBASE_CONFIG = {
     apiKey: "REDACTED_FIREBASE_API_KEY",
     authDomain: "REDACTED_FIREBASE_PROJECT.firebaseapp.com",
     projectId: "REDACTED_FIREBASE_PROJECT",
     storageBucket: "REDACTED_FIREBASE_PROJECT.firebasestorage.app",
     messagingSenderId: "REDACTED_FIREBASE_SENDER_ID",
     appId: "REDACTED_FIREBASE_APP_ID"
   };

export const firebaseEnabled = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

let db = null;
let storage = null;
let auth = null;
let googleProvider = null;

if (firebaseEnabled) {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });
}

export { db, storage, auth, googleProvider };
