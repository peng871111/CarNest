"use client";

import {
  AuthError,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { AppUser, UserRole } from "@/types";
import { resolveManagedUserAccess } from "@/lib/permissions";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<AppUser>;
  register: (input: { name: string; email: string; password: string; role: "buyer" | "seller" }) => Promise<AppUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_UNAVAILABLE_MESSAGE = "Secure account access is temporarily unavailable. Please try again later.";
const LIVE_DATA_MESSAGE = "We’re having trouble loading live data right now. Please check your connection and try again.";

function setSessionCookies(user: AppUser | null) {
  if (typeof document === "undefined") return;
  const maxAge = user ? "max-age=604800" : "max-age=0";
  document.cookie = `carnest_session=${user ? "active" : ""}; path=/; ${maxAge}`;
  document.cookie = `carnest_role=${user?.role ?? ""}; path=/; ${maxAge}`;
  document.cookie = `carnest_permissions=${user?.adminPermissions ? encodeURIComponent(JSON.stringify(user.adminPermissions)) : ""}; path=/; ${maxAge}`;
}

function mapAuthError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String((error as AuthError).code) : "";

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/missing-password":
    case "auth/weak-password":
      return "Please use a stronger password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please sign in instead.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "We couldn’t sign you in with those details. Please try again.";
    case "auth/network-request-failed":
      return LIVE_DATA_MESSAGE;
    default:
      return "Something went wrong. Please try again.";
  }
}

async function ensureUserProfile(firebaseUser: User): Promise<AppUser> {
  const ref = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const data = snapshot.data() as Record<string, unknown>;
    const managedAccess = resolveManagedUserAccess({
      email: String(data.email ?? firebaseUser.email ?? ""),
      storedRole: typeof data.role === "string" ? data.role : "buyer",
      storedPermissions:
        data.adminPermissions && typeof data.adminPermissions === "object"
          ? (data.adminPermissions as Record<string, boolean>)
          : undefined
    });
    const user: AppUser = {
      id: firebaseUser.uid,
      email: String(data.email ?? firebaseUser.email ?? ""),
      displayName: String(data.displayName ?? data.name ?? firebaseUser.displayName ?? "CarNest User"),
      name: String(data.name ?? data.displayName ?? firebaseUser.displayName ?? "CarNest User"),
      phone: typeof data.phone === "string" ? data.phone : "",
      role: managedAccess.role,
      adminPermissions: managedAccess.adminPermissions,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined
    };

    if (
      !data.uid ||
      !data.name ||
      !("phone" in data) ||
      data.role !== user.role ||
      JSON.stringify(data.adminPermissions ?? null) !== JSON.stringify(user.adminPermissions ?? null)
    ) {
      await setDoc(
        ref,
        {
          uid: firebaseUser.uid,
          name: user.name,
          displayName: user.displayName,
          email: user.email,
          phone: user.phone ?? "",
          role: user.role,
          adminPermissions: user.adminPermissions ?? {}
        },
        { merge: true }
      );
    }

    setSessionCookies(user);
    return user;
  }

  const user: AppUser = {
    id: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName: firebaseUser.displayName || "CarNest User",
    name: firebaseUser.displayName || "CarNest User",
    phone: "",
    ...resolveManagedUserAccess({
      email: firebaseUser.email || "",
      storedRole: "buyer"
    })
  };

  await setDoc(ref, { uid: firebaseUser.uid, ...user, adminPermissions: user.adminPermissions ?? {}, createdAt: serverTimestamp() });
  setSessionCookies(user);
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setFirebaseUser(null);
      setAppUser(null);
      setSessionCookies(null);
      setAuthError("");
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setAppUser(null);
        setSessionCookies(null);
        setAuthError("");
        setLoading(false);
        return;
      }

      try {
        const profile = await ensureUserProfile(user);
        setAppUser(profile);
        setAuthError("");
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load auth profile", error);
        }
        setAppUser(null);
        setSessionCookies(null);
        setAuthError(LIVE_DATA_MESSAGE);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      appUser,
      loading,
      authError,
      login: async (email, password) => {
        if (!isFirebaseConfigured) {
          throw new Error(AUTH_UNAVAILABLE_MESSAGE);
        }

        try {
          const credential = await signInWithEmailAndPassword(auth, email, password);
          const profile = await ensureUserProfile(credential.user);
          setAppUser(profile);
          setAuthError("");
          return profile;
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Login failed", error);
          }
          throw new Error(mapAuthError(error));
        }
      },
      register: async ({ name, email, password, role }) => {
        if (!isFirebaseConfigured) {
          throw new Error(AUTH_UNAVAILABLE_MESSAGE);
        }

        try {
          const credential = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(credential.user, { displayName: name });
          const managedAccess = resolveManagedUserAccess({
            email,
            storedRole: role
          });

          const user: AppUser = {
            id: credential.user.uid,
            email,
            displayName: name,
            name,
            phone: "",
            role: managedAccess.role,
            adminPermissions: managedAccess.adminPermissions
          };

          await setDoc(doc(db, "users", credential.user.uid), {
            uid: credential.user.uid,
            name,
            ...user,
            adminPermissions: user.adminPermissions ?? {},
            createdAt: serverTimestamp()
          });

          setAppUser(user);
          setSessionCookies(user);
          setAuthError("");
          return user;
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Registration failed", error);
          }
          throw new Error(mapAuthError(error));
        }
      },
      logout: async () => {
        setSessionCookies(null);
        if (!isFirebaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);
        try {
          await signOut(auth);
          setAuthError("");
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Logout failed", error);
          }
          throw new Error(LIVE_DATA_MESSAGE);
        }
      }
    }),
    [appUser, authError, firebaseUser, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
