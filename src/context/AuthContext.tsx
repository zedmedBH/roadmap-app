// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User as FirebaseUser, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';

// Match the data model from your blueprint
export interface AppUser {
  id: string; // Firebase Auth UID
  email: string;
  firstName: string;
  lastName: string;
  role: 'teacher' | 'student';
  classId?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch or link Firestore user profile
  const fetchOrLinkUserProfile = async (firebaseUser: FirebaseUser) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // User exists, just set them in state
      setUser({ id: userSnap.id, ...userSnap.data() } as AppUser);
    } else {
      // PHASE 2 ACCOUNT LINKING LOGIC
      // Check if a teacher pre-loaded this student via CSV using their email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', firebaseUser.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Match found! Link the Auth ID to the existing profile data
        const existingDoc = querySnapshot.docs[0];
        const existingData = existingDoc.data();
        
        const newAppUser: AppUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          firstName: existingData.firstName || firebaseUser.displayName?.split(' ')[0] || '',
          lastName: existingData.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
          role: existingData.role || 'student',
          classId: existingData.classId,
        };

        // Write the new document with the correct Auth UID and delete the old placeholder
        await setDoc(userRef, newAppUser);
        // (Optional: Add logic to delete the old placeholder document if its ID wasn't the email)

        setUser(newAppUser);
      } else {
        // For development/first-time teacher setup: Create a brand new teacher profile
        // In production, you might restrict this so only approved teachers can create accounts
        const newUser: AppUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          firstName: firebaseUser.displayName?.split(' ')[0] || '',
          lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
          role: 'teacher', // Defaulting new unknown logins to teacher for initial setup
        };
        await setDoc(userRef, newUser);
        setUser(newUser);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchOrLinkUserProfile(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      await fetchOrLinkUserProfile(result.user);
    } catch (error) {
      console.error("Error logging in with Google:", error);
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};