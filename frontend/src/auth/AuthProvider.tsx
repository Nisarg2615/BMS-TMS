import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../firebase";

type AuthContextValue = {
  firebaseUser: User | null;
  idToken: string | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
      } else {
        setIdToken(null);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      idToken,
      loading,
      signUp: async (email, password) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (cred.user) {
          await sendEmailVerification(cred.user);
        }
        // Keep demo flow simple: require verified email before login.
        await signOut(auth);
      },
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
        const u = auth.currentUser;
        if (u) {
          await u.reload();
          if (!u.emailVerified) {
            await signOut(auth);
            throw new Error("Please verify your email before logging in.");
          }
        }
      },
      signInWithGoogle: async () => {
        const provider = new GoogleAuthProvider();
        // Allow all Google accounts for the demo; role/department is handled in Firestore.
        await signInWithPopup(auth, provider);
        const u = auth.currentUser;
        if (u) {
          await u.reload();
          if (!u.emailVerified) {
            await signOut(auth);
            throw new Error("Please verify your email before logging in.");
          }
        }
      },
      logout: async () => {
        await signOut(auth);
      },
      getFreshToken: async () => {
        if (!auth.currentUser) throw new Error("Not authenticated");
        return auth.currentUser.getIdToken(true);
      },
    }),
    [firebaseUser, idToken, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

