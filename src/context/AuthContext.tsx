// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User as FirebaseUser, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, deleteDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';

export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'teacher' | 'student';
  classId?: string;
  groupId?: string;
}

interface AuthContextType {
  user: AppUser | null;
  actualTeacherUser: AppUser | null;
  loading: boolean;
  activeClassId: string | null;
  setActiveClassId: React.Dispatch<React.SetStateAction<string | null>>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setViewAsStudent: (student: AppUser) => void;
  stopViewingAsStudent: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [actualUser, setActualUser] = useState<AppUser | null>(null);
  const [viewingAsStudent, setViewingAsStudent] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  // The exposed user is either the spoofed student or the actual user
  const user = viewingAsStudent || actualUser;
  const actualTeacherUser = viewingAsStudent ? actualUser : null;

  const fetchOrLinkUserProfile = async (firebaseUser: FirebaseUser) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', firebaseUser.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // 1. MATCH FOUND: Extract the pre-populated data
        const existingDoc = querySnapshot.docs[0];
        const existingData = existingDoc.data();
        const oldId = existingDoc.id;
        const newId = firebaseUser.uid;

        const newAppUser: AppUser = {
          id: newId,
          email: firebaseUser.email || '',
          firstName: existingData.firstName || firebaseUser.displayName?.split(' ')[0] || '',
          lastName: existingData.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
          role: existingData.role || 'student',
          classId: existingData.classId, 
        };

        // 2. Create the correctly linked user document
        await setDoc(userRef, newAppUser);

        // 3. FIX: Search for the old ID in any groups and swap it for the new Google UID
        const groupsRef = collection(db, 'groups');
        const groupQuery = query(groupsRef, where('memberIds', 'array-contains', oldId));
        const groupSnap = await getDocs(groupQuery);

        if (!groupSnap.empty) {
          const groupDoc = groupSnap.docs[0];
          await updateDoc(doc(db, 'groups', groupDoc.id), {
            memberIds: arrayRemove(oldId)
          });
          await updateDoc(doc(db, 'groups', groupDoc.id), {
            memberIds: arrayUnion(newId)
          });
        }
        
        // 4. Delete the old pre-populated document
        await deleteDoc(doc(db, 'users', oldId));

      } else {
        // NO MATCH: Brand new user
        const newUser: AppUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          firstName: firebaseUser.displayName?.split(' ')[0] || '',
          lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
          role: 'student', 
        };
        await setDoc(userRef, newUser);
      }
    }
  };

  useEffect(() => {
    let unsubUser: () => void;
    let unsubGroups: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchOrLinkUserProfile(firebaseUser);

        const userRef = doc(db, 'users', firebaseUser.uid);
        
        unsubUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const baseUser = { id: docSnap.id, ...docSnap.data() } as AppUser;

            const groupsQ = query(collection(db, 'groups'), where('memberIds', 'array-contains', firebaseUser.uid));
            unsubGroups = onSnapshot(groupsQ, (groupSnap) => {
              const groupId = groupSnap.empty ? undefined : groupSnap.docs[0].id;
              setActualUser({ ...baseUser, groupId });
              setLoading(false);
            });
          } else {
            setLoading(false);
          }
        });
      } else {
        setActualUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
      if (unsubGroups) unsubGroups();
    };
  }, []);

  const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Extract the Google Access Token
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    
    if (token) {
      // Store it in sessionStorage so it persists across page reloads during the session
      sessionStorage.setItem('google_access_token', token);
    }
  } catch (error) {
    console.error("Error logging in with Google:", error);
  }
};

  const logout = async () => {
    await signOut(auth);
    setActualUser(null);
    setViewingAsStudent(null);
  };

  const setViewAsStudent = (student: AppUser) => setViewingAsStudent(student);
  const stopViewingAsStudent = () => setViewingAsStudent(null);

  return (
    <AuthContext.Provider value={{ 
      user, 
      actualTeacherUser,
      loading,
      activeClassId,       
      setActiveClassId,
      loginWithGoogle, 
      logout, 
      setViewAsStudent, 
      stopViewingAsStudent 
    }}>
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