// src/config/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace this object with the one you copied from the Firebase Console!
const firebaseConfig = {
  apiKey: "AIzaSyA8u1Cc3EznEdfsvNYrQcAiSo-5SwjZj7k",
  authDomain: "roadmap-app-5472a.firebaseapp.com",
  projectId: "roadmap-app-5472a",
  storageBucket: "roadmap-app-5472a.firebasestorage.app",
  messagingSenderId: "1037375495804",
  appId: "1:1037375495804:web:f95396711bac0ad114b3f9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export services
export const auth = getAuth(app);

// Update GoogleAuthProvider to request Google Drive scopes (Preparation for Phase 4)
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

export const db = getFirestore(app);