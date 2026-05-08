"use client";

import {
  ActionCodeSettings,
  AuthError,
  EmailAuthProvider,
  GoogleAuthProvider,
  UserCredential,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
  User
} from "firebase/auth";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, isFirebaseConfigured, missingFirebaseConfigKeys } from "@/lib/firebase";
import { AccountType, AppUser } from "@/types";
import { createAdminPermissions, resolveManagedUserAccess } from "@/lib/permissions";
import { getSiteUrl } from "@/lib/seo";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<AppUser>;
  register: (input: { name: string; email: string; password: string; accountType: AccountType }) => Promise<AppUser>;
  continueWithGoogle: (accountType?: AccountType) => Promise<AppUser | null>;
  requestPasswordReset: (email: string) => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_UNAVAILABLE_MESSAGE = "Account signup is temporarily unavailable because authentication is not configured for this deployment.";
const LIVE_DATA_MESSAGE = "We’re having trouble loading live data right now. Please check your connection and try again.";
const PRODUCTION_SITE_URL = "https://carnest.au";
const PROFILE_SETUP_MESSAGE = "Your account was created, but we couldn’t finish setting up your profile. Please sign in to continue.";
const PROFILE_LOAD_MESSAGE = "We signed you in, but couldn’t load your account profile. Please try again.";
const PROFILE_CREATE_FAILED_MESSAGE = "Your account was created, but we couldn’t finish setting up your profile. Please sign in again and we’ll restore it automatically.";
const PROFILE_NOT_FOUND_MESSAGE = "User profile not found. We’re creating it for you now.";
const PASSWORD_RESET_REQUIRED_MESSAGE = "Please reset your password via email.";
const ACCOUNT_BANNED_MESSAGE = "This account has been banned. Please contact CarNest support.";
const LOGIN_PROTECTION_STORAGE_KEY = "carnest_login_protection";
const LOGIN_PROTECTION_SESSION_KEY = "carnest_login_protection_session";
export const GOOGLE_POST_LOGIN_REDIRECT_STORAGE_KEY = "carnest_google_post_login_redirect";
const pendingProfileSeeds = new Map<string, { name: string; accountType: AccountType; role: "private" | "dealer" }>();
const EMPTY_ADMIN_PERMISSIONS = createAdminPermissions({
  manageVehicles: false,
  manageOffers: false,
  manageEnquiries: false,
  manageInspections: false,
  managePricing: false,
  manageQuotes: false,
  manageUsers: false,
  manageAdmins: false
});

type UserSecurityState = {
  failedLoginAttempts: number;
  mustResetPassword: boolean;
};

type LocalLoginProtectionState = UserSecurityState & {
  resetCompleted: boolean;
};

const DEFAULT_USER_SECURITY_STATE: UserSecurityState = {
  failedLoginAttempts: 0,
  mustResetPassword: false
};

const DEFAULT_LOCAL_LOGIN_PROTECTION_STATE: LocalLoginProtectionState = {
  ...DEFAULT_USER_SECURITY_STATE,
  resetCompleted: false
};

function setSessionCookies(user: AppUser | null) {
  if (typeof document === "undefined") return;
  const maxAge = user ? "max-age=604800" : "max-age=0";
  document.cookie = `carnest_session=${user ? "active" : ""}; path=/; ${maxAge}`;
  document.cookie = `carnest_role=${user?.role ?? ""}; path=/; ${maxAge}`;
  document.cookie = `carnest_dealer_status=${user?.dealerStatus ?? ""}; path=/; ${maxAge}`;
  document.cookie = `carnest_permissions=${user?.adminPermissions ? encodeURIComponent(JSON.stringify(user.adminPermissions)) : ""}; path=/; ${maxAge}`;
}

function getErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

function readLocalLoginProtectionStore() {
  if (typeof window === "undefined") return {} as Record<string, LocalLoginProtectionState>;

  try {
    const rawValue =
      window.localStorage.getItem(LOGIN_PROTECTION_STORAGE_KEY)
      || window.sessionStorage.getItem(LOGIN_PROTECTION_STORAGE_KEY)
      || window.sessionStorage.getItem(LOGIN_PROTECTION_SESSION_KEY);
    if (!rawValue) return {};

    const parsedValue = JSON.parse(rawValue) as Record<string, Partial<LocalLoginProtectionState>>;
    return Object.fromEntries(
      Object.entries(parsedValue).map(([email, state]) => [
        email,
        {
          failedLoginAttempts: typeof state.failedLoginAttempts === "number" ? state.failedLoginAttempts : 0,
          mustResetPassword: Boolean(state.mustResetPassword),
          resetCompleted: Boolean(state.resetCompleted)
        }
      ])
    );
  } catch {
    return {};
  }
}

function writeLocalLoginProtectionStore(store: Record<string, LocalLoginProtectionState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOGIN_PROTECTION_STORAGE_KEY, JSON.stringify(store));
  window.sessionStorage.setItem(LOGIN_PROTECTION_STORAGE_KEY, JSON.stringify(store));
  window.sessionStorage.setItem(LOGIN_PROTECTION_SESSION_KEY, JSON.stringify(store));
}

function getLocalLoginProtectionState(email: string): LocalLoginProtectionState {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) return DEFAULT_LOCAL_LOGIN_PROTECTION_STATE;

  return readLocalLoginProtectionStore()[normalizedEmail] ?? DEFAULT_LOCAL_LOGIN_PROTECTION_STATE;
}

function setLocalLoginProtectionState(email: string, state: LocalLoginProtectionState) {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail || typeof window === "undefined") return;

  const store = readLocalLoginProtectionStore();

  if (
    state.failedLoginAttempts === 0 &&
    !state.mustResetPassword &&
    !state.resetCompleted
  ) {
    delete store[normalizedEmail];
  } else {
    store[normalizedEmail] = state;
  }

  writeLocalLoginProtectionStore(store);
}

function incrementLocalFailedLoginAttempts(email: string) {
  const currentState = getLocalLoginProtectionState(email);
  const failedLoginAttempts = currentState.failedLoginAttempts + 1;
  const nextState: LocalLoginProtectionState = {
    failedLoginAttempts,
    mustResetPassword: failedLoginAttempts >= 3,
    resetCompleted: false
  };

  setLocalLoginProtectionState(email, nextState);
  return nextState;
}

function markLocalResetRequired(email: string) {
  const currentState = getLocalLoginProtectionState(email);
  const nextState: LocalLoginProtectionState = {
    failedLoginAttempts: Math.max(currentState.failedLoginAttempts, 3),
    mustResetPassword: true,
    resetCompleted: false
  };

  setLocalLoginProtectionState(email, nextState);
}

export function markLocalPasswordResetComplete(email: string) {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) return;

  clearLocalLoginProtection(normalizedEmail);
}

export function clearAllLoginProtectionBrowserState() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(LOGIN_PROTECTION_STORAGE_KEY);
  window.sessionStorage.removeItem(LOGIN_PROTECTION_STORAGE_KEY);
  window.sessionStorage.removeItem(LOGIN_PROTECTION_SESSION_KEY);
}

function clearLocalLoginProtection(email: string) {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) return;
  setLocalLoginProtectionState(normalizedEmail, DEFAULT_LOCAL_LOGIN_PROTECTION_STATE);
}

export async function clearResetRequiredStateForEmail(email: string, password?: string) {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail || !isFirebaseConfigured) {
    clearAllLoginProtectionBrowserState();
    return;
  }

  let signedInForCleanup = false;

  try {
    let currentUser = auth.currentUser;

    if ((!currentUser || normalizeAuthEmail(currentUser.email ?? "") !== normalizedEmail) && password) {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      currentUser = credential.user;
      signedInForCleanup = true;
    }

    if (currentUser && normalizeAuthEmail(currentUser.email ?? "") === normalizedEmail) {
      await writeUserSecurityState(currentUser.uid, DEFAULT_USER_SECURITY_STATE);
    }
  } finally {
    clearLocalLoginProtection(normalizedEmail);
    clearAllLoginProtectionBrowserState();

    if (signedInForCleanup) {
      try {
        await signOut(auth);
      } catch {}
    }
  }
}

function getUserSecurityState(data?: Record<string, unknown>): UserSecurityState {
  return {
    failedLoginAttempts: typeof data?.failedLoginAttempts === "number" ? data.failedLoginAttempts : 0,
    mustResetPassword: data?.mustResetPassword === true
  };
}

async function readUserSecurityState(firebaseUser: User) {
  return await withProfileRetry(firebaseUser, async () => {
    const snapshot = await getDoc(doc(db, "users", firebaseUser.uid));
    if (!snapshot.exists()) {
      return DEFAULT_USER_SECURITY_STATE;
    }

    return getUserSecurityState(snapshot.data() as Record<string, unknown>);
  });
}

async function writeUserSecurityState(uid: string, state: UserSecurityState) {
  await setDoc(
    doc(db, "users", uid),
    {
      failedLoginAttempts: state.failedLoginAttempts,
      mustResetPassword: state.mustResetPassword
    },
    { merge: true }
  );
}

function isInvalidLoginAttemptCode(code: string) {
  return code === "auth/invalid-login-credentials"
    || code === "auth/invalid-credential"
    || code === "auth/user-not-found"
    || code === "auth/wrong-password";
}

export function mapAuthError(error: unknown) {
  const code = getErrorCode(error);

  if (!code && error instanceof Error) {
    if (
      error.message === AUTH_UNAVAILABLE_MESSAGE ||
      error.message === LIVE_DATA_MESSAGE ||
      error.message === PROFILE_SETUP_MESSAGE ||
      error.message === PROFILE_LOAD_MESSAGE
    ) {
      return error.message;
    }

    return error.message || "We couldn’t finish signing you in. Please try again.";
  }

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
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled before it finished.";
    case "auth/account-exists-with-different-credential":
      return "An account with this email already exists. Please sign in using your existing method.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/invalid-login-credentials":
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "We couldn’t sign you in with those details. Please try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact CarNest support if you need help.";
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
    case "unauthenticated":
    case "unavailable":
      return LIVE_DATA_MESSAGE;
    case "permission-denied":
      return "We couldn’t load your account profile right now. Please try again.";
    default:
      return "We couldn’t complete authentication. Please try again.";
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

function getProfilePermissions(user: Pick<AppUser, "role" | "adminPermissions">) {
  return user.adminPermissions ?? EMPTY_ADMIN_PERMISSIONS;
}

function getStoredAccountType(existingData?: Record<string, unknown>, pendingSeed?: { accountType: AccountType; role: "private" | "dealer" }) {
  if (existingData?.accountType === "dealer" || existingData?.role === "dealer") {
    return "dealer" as const;
  }

  if (existingData?.accountType === "private" || existingData?.role === "private") {
    return "private" as const;
  }

  if (pendingSeed?.accountType === "dealer" || pendingSeed?.role === "dealer") {
    return "dealer" as const;
  }

  return "private" as const;
}

function buildPrivateProfileSeed(firebaseUser: User, accountType: AccountType = "private") {
  const normalizedEmail = normalizeAuthEmail(firebaseUser.email ?? "");
  return {
    name: firebaseUser.displayName?.trim() || normalizedEmail.split("@")[0] || "CarNest User",
    accountType,
    role: "private" as const
  };
}

function buildSafeDefaultPrivateProfilePayload(firebaseUser: User, displayNameOverride?: string) {
  const displayName = displayNameOverride?.trim() || firebaseUser.displayName?.trim() || normalizeAuthEmail(firebaseUser.email ?? "").split("@")[0] || "CarNest User";
  const now = Timestamp.now();

  return {
    uid: firebaseUser.uid,
    email: normalizeAuthEmail(firebaseUser.email ?? ""),
    name: displayName,
    displayName,
    photoURL: firebaseUser.photoURL ?? "",
    phone: "",
    emailVerified: firebaseUser.emailVerified,
    role: "private" as const,
    accountType: "private" as const,
    complianceStatus: "clear" as const,
    dealerStatus: "none" as const,
    dealerVerified: false,
    agreedToDealerTerms: false,
    agreedToTerms: false,
    dealerPlan: "free" as const,
    planType: "free" as const,
    maxListings: 3,
    shopPublicVisible: false,
    shopVisible: false,
    brandingEnabled: false,
    contactDisplayEnabled: false,
    accountBanned: false,
    listingRestricted: false,
    failedLoginAttempts: 0,
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now
  };
}

function shouldFallbackToGoogleRedirect(error: unknown) {
  const code = getErrorCode(error);
  return code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment";
}

function buildManagedUserProfile(
  firebaseUser: User,
  pendingSeed?: { name: string; accountType: AccountType; role: "private" | "dealer" },
  existingData?: Record<string, unknown>
) {
  const email = String(existingData?.email ?? firebaseUser.email ?? "");
  const accountType = getStoredAccountType(existingData, pendingSeed);
  const managedAccess = resolveManagedUserAccess({
    email,
    storedRole: typeof existingData?.role === "string" ? existingData.role : pendingSeed?.role ?? "private",
    storedPermissions:
      existingData?.adminPermissions && typeof existingData.adminPermissions === "object"
        ? (existingData.adminPermissions as Record<string, boolean>)
        : undefined
  });

  return {
    id: firebaseUser.uid,
    email,
    displayName: String(existingData?.displayName ?? existingData?.name ?? pendingSeed?.name ?? firebaseUser.displayName ?? "CarNest User"),
    name: String(existingData?.name ?? existingData?.displayName ?? pendingSeed?.name ?? firebaseUser.displayName ?? "CarNest User"),
    photoURL: typeof existingData?.photoURL === "string" ? existingData.photoURL : firebaseUser.photoURL ?? undefined,
    phone: typeof existingData?.phone === "string" ? existingData.phone : "",
    role: managedAccess.role,
    accountType,
    adminPermissions: managedAccess.adminPermissions ?? EMPTY_ADMIN_PERMISSIONS,
    emailVerified: firebaseUser.emailVerified,
    accountBanned: Boolean(existingData?.accountBanned),
    complianceStatus:
      existingData?.complianceStatus === "possible_unlicensed_trader" || existingData?.complianceStatus === "verified_dealer"
        ? existingData.complianceStatus
        : "clear",
    complianceFlaggedAt: typeof existingData?.complianceFlaggedAt === "string" ? existingData.complianceFlaggedAt : undefined,
    dealerStatus:
      existingData?.dealerStatus === "submitted_unverified"
      || existingData?.dealerStatus === "pending"
      || existingData?.dealerStatus === "pending_review"
      || existingData?.dealerStatus === "info_requested"
      || existingData?.dealerStatus === "approved"
      || existingData?.dealerStatus === "rejected"
        ? existingData.dealerStatus
        : "none",
    dealerVerified: Boolean(existingData?.dealerVerified),
    dealerApplicationId: typeof existingData?.dealerApplicationId === "string" ? existingData.dealerApplicationId : undefined,
    agreedToDealerTerms: Boolean(existingData?.agreedToDealerTerms ?? existingData?.agreedToTerms),
    agreedToTerms: Boolean(existingData?.agreedToDealerTerms ?? existingData?.agreedToTerms),
    agreedAt: typeof existingData?.agreedAt === "string" ? existingData.agreedAt : undefined,
    dealerPlan:
      existingData?.dealerPlan === "starter" || existingData?.dealerPlan === "growth" || existingData?.dealerPlan === "pro"
      || existingData?.dealerPlan === "tier1" || existingData?.dealerPlan === "tier2" || existingData?.dealerPlan === "tier3"
        ? existingData.dealerPlan
        : "free",
    planType:
      existingData?.dealerPlan === "starter" || existingData?.dealerPlan === "growth" || existingData?.dealerPlan === "pro"
      || existingData?.dealerPlan === "tier1" || existingData?.dealerPlan === "tier2" || existingData?.dealerPlan === "tier3"
        ? existingData.dealerPlan
        : "free",
    maxListings: typeof existingData?.maxListings === "number" ? existingData.maxListings : undefined,
    shopPublicVisible: Boolean(existingData?.shopPublicVisible ?? existingData?.shopVisible),
    shopVisible: Boolean(existingData?.shopPublicVisible ?? existingData?.shopVisible),
    brandingEnabled: Boolean(existingData?.brandingEnabled),
    contactDisplayEnabled: Boolean(existingData?.contactDisplayEnabled),
    listingRestricted: Boolean(existingData?.listingRestricted),
    createdAt: typeof existingData?.createdAt === "string" ? existingData.createdAt : undefined
  } satisfies AppUser;
}

function buildStoredProfilePayload(
  firebaseUser: User,
  pendingSeed?: { name: string; accountType: AccountType; role: "private" | "dealer" },
  existingData?: Record<string, unknown>
) {
  const user = buildManagedUserProfile(firebaseUser, pendingSeed, existingData);
  const storedRole =
    typeof existingData?.role === "string"
      ? existingData.role
      : user.role === "admin" || user.role === "super_admin"
        ? user.role
        : pendingSeed?.role ?? "private";

  const payload: Record<string, unknown> = {
    uid: firebaseUser.uid,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    photoURL: user.photoURL ?? "",
    phone: user.phone ?? "",
    emailVerified: firebaseUser.emailVerified,
    role: storedRole,
    accountType: user.accountType ?? "private",
    complianceStatus: user.complianceStatus ?? "clear",
    dealerStatus: user.dealerStatus ?? "none",
    dealerVerified: user.dealerVerified ?? false,
    agreedToDealerTerms: user.agreedToDealerTerms ?? false,
    agreedToTerms: user.agreedToDealerTerms ?? user.agreedToTerms ?? false,
    dealerPlan: user.dealerPlan ?? "free",
    planType: user.dealerPlan ?? user.planType ?? "free",
    maxListings: user.maxListings ?? 3,
    shopPublicVisible: user.shopPublicVisible ?? false,
    shopVisible: user.shopPublicVisible ?? user.shopVisible ?? false,
    brandingEnabled: user.brandingEnabled ?? false,
    contactDisplayEnabled: user.contactDisplayEnabled ?? false,
    accountBanned: user.accountBanned ?? false,
    listingRestricted: user.listingRestricted ?? false,
    failedLoginAttempts:
      typeof existingData?.failedLoginAttempts === "number"
        ? existingData.failedLoginAttempts
        : 0,
    mustResetPassword:
      typeof existingData?.mustResetPassword === "boolean"
        ? existingData.mustResetPassword
        : false,
    updatedAt: Timestamp.now()
  };

  if (typeof existingData?.createdAt === "string" || (existingData?.createdAt && typeof existingData.createdAt === "object")) {
    payload.createdAt = existingData.createdAt;
  } else {
    payload.createdAt = Timestamp.now();
  }

  if (user.dealerApplicationId) {
    payload.dealerApplicationId = user.dealerApplicationId;
  }

  if (user.role === "admin" || user.role === "super_admin") {
    payload.adminPermissions = getProfilePermissions(user);
  }

  return { user, payload };
}

async function upsertUserProfileDocument(
  firebaseUser: User,
  pendingSeed?: { name: string; accountType: AccountType; role: "private" | "dealer" }
) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(ref);
  const existingData = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined;
  const { user, payload } = existingData
    ? buildStoredProfilePayload(firebaseUser, pendingSeed, existingData)
    : {
        user: buildManagedUserProfile(firebaseUser, { name: pendingSeed?.name ?? buildPrivateProfileSeed(firebaseUser).name, accountType: "private", role: "private" }),
        payload: buildSafeDefaultPrivateProfilePayload(firebaseUser, pendingSeed?.name)
      };
  await setDoc(ref, payload, { merge: true });
  return user;
}

function createProfileSetupError(context: "signup" | "login", error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  const baseMessage = context === "signup" ? PROFILE_CREATE_FAILED_MESSAGE : PROFILE_LOAD_MESSAGE;

  if (process.env.NODE_ENV === "development" && (code || message)) {
    return new Error(`${baseMessage}${code || message ? ` [${code || "unknown"}] ${message}` : ""}`);
  }

  return new Error(baseMessage);
}

function mapProfileError(error: unknown, context: "signup" | "login") {
  const code = getErrorCode(error);

  if (code === "permission-denied" || code === "unauthenticated") {
    return context === "signup"
      ? PROFILE_CREATE_FAILED_MESSAGE
      : "User profile not found. We couldn’t restore it automatically. Please try again.";
  }

  if (code === "unavailable" || code === "auth/network-request-failed") {
    return LIVE_DATA_MESSAGE;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return context === "signup" ? PROFILE_CREATE_FAILED_MESSAGE : PROFILE_LOAD_MESSAGE;
}

async function withProfileRetry<T>(firebaseUser: User, operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    const code = getErrorCode(error);

    if (code === "permission-denied" || code === "unauthenticated") {
      await firebaseUser.getIdToken(true);
      return await operation();
    }

    throw error;
  }
}

async function ensureUserProfile(firebaseUser: User): Promise<AppUser> {
  return await withProfileRetry(firebaseUser, async () => {
    const ref = doc(db, "users", firebaseUser.uid);
    const snapshot = await getDoc(ref);
    const pendingSeed = pendingProfileSeeds.get(firebaseUser.uid);

    if (snapshot.exists()) {
      const data = snapshot.data() as Record<string, unknown>;
      const user = buildManagedUserProfile(firebaseUser, pendingSeed, data);

      if (
        !data.uid ||
        !data.name ||
        !("photoURL" in data) ||
        !("phone" in data) ||
        !("emailVerified" in data) ||
        !("accountType" in data) ||
        !("complianceStatus" in data) ||
        !("dealerStatus" in data) ||
        !("dealerVerified" in data) ||
        !("agreedToDealerTerms" in data) ||
        !("dealerPlan" in data) ||
        !("maxListings" in data) ||
        !("shopPublicVisible" in data) ||
        !("brandingEnabled" in data) ||
        !("contactDisplayEnabled" in data) ||
        !("accountBanned" in data) ||
        !("listingRestricted" in data) ||
        !("failedLoginAttempts" in data) ||
        !("mustResetPassword" in data) ||
        (data.role !== user.role && !(data.role === "private" && user.accountType === "private")) ||
        JSON.stringify(data.adminPermissions ?? null) !== JSON.stringify(user.adminPermissions ?? null)
      ) {
        const { payload: profileUpdate } = buildStoredProfilePayload(firebaseUser, pendingSeed, data);
        await setDoc(ref, profileUpdate, { merge: true });
      }

      setSessionCookies(user);
      pendingProfileSeeds.delete(firebaseUser.uid);
      return user;
    }

    const user = await upsertUserProfileDocument(firebaseUser, pendingSeed);
    setSessionCookies(user);
    pendingProfileSeeds.delete(firebaseUser.uid);
    return user;
  });
}

async function assertAccountNotBanned(profile: AppUser) {
  if (!profile.accountBanned) return;

  try {
    await signOut(auth);
  } catch {}

  setSessionCookies(null);
  throw new Error(ACCOUNT_BANNED_MESSAGE);
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

    void (async () => {
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
          const pendingSeed = pendingProfileSeeds.get(redirectResult.user.uid) ?? buildPrivateProfileSeed(redirectResult.user);
          await withProfileRetry(redirectResult.user, () => upsertUserProfileDocument(redirectResult.user, pendingSeed));
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Google redirect result failed", error);
        }
        setAuthError(mapAuthError(error));
      }
    })();

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
        await assertAccountNotBanned(profile);
        setAppUser(profile);
        setAuthError("");
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load auth profile", error);
        }
        setAppUser(null);
        setSessionCookies(null);
        setAuthError(error instanceof Error && error.message ? error.message : LIVE_DATA_MESSAGE);
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

        const normalizedEmail = normalizeAuthEmail(email);
        const localProtectionState = getLocalLoginProtectionState(normalizedEmail);

        try {
          const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          await credential.user.getIdToken(true);
          const remoteSecurityState = await readUserSecurityState(credential.user);

          if (remoteSecurityState.mustResetPassword) {
            markLocalResetRequired(normalizedEmail);
            try {
              await signOut(auth);
            } catch {}
            setSessionCookies(null);
            throw new Error(PASSWORD_RESET_REQUIRED_MESSAGE);
          }

          let profile: AppUser;

          try {
            profile = await ensureUserProfile(credential.user);
            await assertAccountNotBanned(profile);
          } catch (profileError) {
            if (process.env.NODE_ENV === "development") {
              console.error("Login profile load failed", profileError);
            }
            try {
              await signOut(auth);
            } catch {}
            setSessionCookies(null);
            throw new Error(mapProfileError(profileError, "login"));
          }

          if (
            remoteSecurityState.failedLoginAttempts !== 0 ||
            remoteSecurityState.mustResetPassword ||
            localProtectionState.failedLoginAttempts !== 0 ||
            localProtectionState.mustResetPassword ||
            localProtectionState.resetCompleted
          ) {
            await writeUserSecurityState(credential.user.uid, DEFAULT_USER_SECURITY_STATE);
            clearLocalLoginProtection(normalizedEmail);
          }

          setAppUser(profile);
          setAuthError("");
          return profile;
        } catch (error) {
          const code = getErrorCode(error);

          if (code === "auth/too-many-requests") {
            markLocalResetRequired(normalizedEmail);
            throw new Error(PASSWORD_RESET_REQUIRED_MESSAGE);
          }

          if (isInvalidLoginAttemptCode(code)) {
            const updatedLocalProtectionState = incrementLocalFailedLoginAttempts(normalizedEmail);
            if (updatedLocalProtectionState.mustResetPassword) {
              throw new Error(PASSWORD_RESET_REQUIRED_MESSAGE);
            }
          }

          if (process.env.NODE_ENV === "development") {
            console.error("Login failed", error);
          }
          throw new Error(mapAuthError(error));
        }
      },
      register: async ({ name, email, password, accountType }) => {
        if (!isFirebaseConfigured) {
          if (process.env.NODE_ENV === "development") {
            console.error("Firebase Authentication is not configured for this deployment.", {
              missingFirebaseConfigKeys
            });
          }
          throw new Error(AUTH_UNAVAILABLE_MESSAGE);
        }

        try {
          const normalizedEmail = normalizeAuthEmail(email);
          const credential: UserCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          const role = "private" as const;
          pendingProfileSeeds.set(credential.user.uid, { name, accountType: "private", role });
          await updateProfile(credential.user, { displayName: name });
          if (accountType === "dealer") {
            await sendEmailVerification(credential.user).catch(() => undefined);
          }
          await credential.user.getIdToken(true);

          try {
            await withProfileRetry(credential.user, () => upsertUserProfileDocument(credential.user, { name, accountType: "private", role }));
          } catch (profileCreateError) {
            console.error("User profile creation failed during signup", {
              code: getErrorCode(profileCreateError),
              message: getErrorMessage(profileCreateError),
              error: profileCreateError
            });
            try {
              await signOut(auth);
            } catch {}
            setSessionCookies(null);
            throw createProfileSetupError("signup", profileCreateError);
          }

          let user: AppUser;

          try {
            user = await ensureUserProfile(credential.user);
          } catch (profileError) {
            console.error("Registration profile setup failed", {
              code: getErrorCode(profileError),
              message: getErrorMessage(profileError),
              error: profileError
            });
            try {
              await signOut(auth);
            } catch {}
            setSessionCookies(null);
            throw createProfileSetupError("signup", profileError);
          }

          setAppUser(user);
          setSessionCookies(user);
          setAuthError("");
          return user;
        } catch (error) {
          if (error instanceof Error && error.message !== PROFILE_SETUP_MESSAGE) {
            const currentUserId = auth.currentUser?.uid;
            if (currentUserId) {
              pendingProfileSeeds.delete(currentUserId);
            }
          }
          if (process.env.NODE_ENV === "development") {
            console.error("Registration failed", error);
          }
          throw new Error(mapAuthError(error));
        }
      },
      continueWithGoogle: async (_accountType = "private") => {
        if (!isFirebaseConfigured) {
          throw new Error(AUTH_UNAVAILABLE_MESSAGE);
        }

        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        try {
          try {
            const credential = await signInWithPopup(auth, provider);
            const pendingSeed = buildPrivateProfileSeed(credential.user);
            pendingProfileSeeds.set(credential.user.uid, pendingSeed);
            await credential.user.getIdToken(true);

            const user = await withProfileRetry(credential.user, () =>
              upsertUserProfileDocument(credential.user, pendingSeed)
            );

            await assertAccountNotBanned(user);
            setAppUser(user);
            setSessionCookies(user);
            setAuthError("");
            return user;
          } catch (popupError) {
            if (!shouldFallbackToGoogleRedirect(popupError)) {
              throw popupError;
            }

            await signInWithRedirect(auth, provider);
            return null;
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Google sign-in failed", error);
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
