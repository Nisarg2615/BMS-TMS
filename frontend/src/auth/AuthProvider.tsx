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
import { auth, firebaseConfigured } from "../firebase";
import { sleep } from "../utils/authErrors";

type AuthContextValue = {
  firebaseUser: User | null;
  idToken: string | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string>;
};

function allowedDomains(): string[] {
  const domainsRaw = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS as string) || "";
  return domainsRaw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

async function validateSignedInUser(user: User): Promise<string | null> {
  await user.reload();

  const domains = allowedDomains();
  if (domains.length && user.email) {
    const domain = user.email.split("@")[1]?.toLowerCase();
    if (!domain || !domains.includes(domain)) {
      return `Signed in as ${user.email}, but only school email domains are allowed (${domains.join(", ")}).`;
    }
  }

  return null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setIdToken(null);
        setLoading(false);
        return;
      }

      const validationError = await validateSignedInUser(user);
      if (validationError) {
        setAuthError(validationError);
        await signOut(auth);
        setFirebaseUser(null);
        setIdToken(null);
        setLoading(false);
        return;
      }

      setAuthError(null);
      setFirebaseUser(user);
      const token = await user.getIdToken();
      setIdToken(token);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      idToken,
      loading,
      authError,
      clearAuthError: () => setAuthError(null),
      signUp: async (email, password) => {
        if (!auth) throw new Error("Firebase is not configured.");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (cred.user) {
          await sendEmailVerification(cred.user);
        }
        // Keep demo flow simple: require verified email before login.
        await signOut(auth);
      },
      signIn: async (email, password) => {
        if (!auth) throw new Error("Firebase is not configured.");
        setAuthError(null);
        await signInWithEmailAndPassword(auth, email, password);
      },
      signInWithGoogle: async () => {
        if (!auth) throw new Error("Firebase is not configured.");
        setAuthError(null);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithPopup(auth, provider);
      },
      logout: async () => {
        if (!auth) throw new Error("Firebase is not configured.");
        await signOut(auth);
      },
      getFreshToken: async () => {
        for (let attempt = 0; attempt < 8; attempt++) {
          if (auth?.currentUser) {
            return auth.currentUser.getIdToken(true);
          }
          await sleep(250);
        }
        throw new Error("Not authenticated");
      },
    }),
    [firebaseUser, idToken, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

