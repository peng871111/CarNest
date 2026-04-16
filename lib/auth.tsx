"use client";

import {
  ActionCodeSettings,
  AuthError,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  User
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, isFirebaseConfigured, missingFirebaseConfigKeys } from "@/lib/firebase";
import { AppUser } from "@/types";
import { resolveManagedUserAccess } from "@/lib/permissions";
import { getSiteUrl } from "@/lib/seo";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<AppUser>;
  register: (input: { name: string; email: string; password: string; role: "buyer" | "seller" }) => Promise<AppUser>;
  requestPasswordReset: (email: string) => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_UNAVAILABLE_MESSAGE = "Account signup is temporarily unavailable because authentication is not configured for this deployment.";
const LIVE_DATA_MESSAGE = "We’re having trouble loading live data right now. Please check your connection and try again.";
const PRODUCTION_SITE_URL = "https://carnest-alpha.vercel.app";

function setSessionCookies(user: AppUser | null) {
  if (typeof document === "undefined") return;
  const maxAge = user ? "max-age=604800" : "max-age=0";
  document.cookie = `carnest_session=${user ? "active" : ""}; path=/; ${maxAge}`;
  document.cookie = `carnest_role=${user?.role ?? ""}; path=/; ${maxAge}`;
  document.cookie = `carnest_permissions=${user?.adminPermissions ? encodeURIComponent(JSON.stringify(user.adminPermissions)) : ""}; path=/; ${maxAge}`;
}

export function mapAuthError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String((error as AuthError).code) : "";

  switch (code) {
    case "auth/invalid-api-key":
      return "Firebase Authentication is misconfigured. Please check NEXT_PUBLIC_FIREBASE_API_KEY for this deployment.";
    case "auth/app-not-authorized":
      return "This Firebase web app is not authorized for the current domain. Please review your Firebase web app configuration.";
    case "auth/configuration-not-found":
    case "auth/operation-not-allowed":
      return "Firebase email/password sign-in is not enabled for this project yet.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/missing-password":
    case "auth/weak-password":
      return "Please use a stronger password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please sign in instead.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "We couldn’t sign you in with those details. Please try again.";
    case "auth/missing-email":
      return "Please enter your email address.";
    case "auth/user-token-expired":
    case "auth/requires-recent-login":
      return "Please sign in again before changing your password.";
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return "This password reset link is no longer valid. Please request a new reset email.";
    case "auth/missing-continue-uri":
    case "auth/invalid-continue-uri":
      return "This password reset link is incomplete. Please request a new reset email.";
    case "auth/network-request-failed":
      return LIVE_DATA_MESSAGE;
    default:
      return "Something went wrong. Please try again.";
  }
}

function getAuthOrigin() {
  if (typeof window !== "undefined" && window.location.origin.includes("localhost")) {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || PRODUCTION_SITE_URL || getSiteUrl();
}

function getPasswordResetActionCodeSettings(): ActionCodeSettings {
  return {
    url: new URL("/login?reset=success", getAuthOrigin()).toString()
  };
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
      const profileUpdate: Record<string, unknown> = {
        uid: firebaseUser.uid,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone ?? "",
        role: user.role
      };

      if (user.adminPermissions || "adminPermissions" in data) {
        profileUpdate.adminPermissions = user.adminPermissions ?? {};
      }

      await setDoc(
        ref,
        profileUpdate,
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

  await setDoc(
    ref,
    {
      uid: firebaseUser.uid,
      ...user,
      ...(user.adminPermissions ? { adminPermissions: user.adminPermissions } : {}),
      createdAt: serverTimestamp()
    }
  );
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
          if (process.env.NODE_ENV === "development") {
            console.error("Firebase Authentication is not configured for this deployment.", {
              missingFirebaseConfigKeys
            });
          }
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
            ...(user.adminPermissions ? { adminPermissions: user.adminPermissions } : {}),
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
      requestPasswordReset: async (email) => {
        if (!isFirebaseConfigured) {
          throw new Error(AUTH_UNAVAILABLE_MESSAGE);
        }

        try {
          await sendPasswordResetEmail(auth, email, getPasswordResetActionCodeSettings());
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Password reset request failed", error);
          }
          throw new Error(mapAuthError(error));
        }
      },
      changePassword: async ({ currentPassword, newPassword }) => {
        if (!isFirebaseConfigured) {
          throw new Error(AUTH_UNAVAILABLE_MESSAGE);
        }

        if (!firebaseUser?.email) {
          throw new Error("We couldn’t verify your account email. Please sign in again.");
        }

        try {
          const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
          await reauthenticateWithCredential(firebaseUser, credential);
          await updatePassword(firebaseUser, newPassword);
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Password change failed", error);
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
