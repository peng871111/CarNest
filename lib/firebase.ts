import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const CUSTOM_PRODUCTION_AUTH_DOMAIN = "carnest.au";
const rawFirebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? "";
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
const shouldUseCustomProductionAuthDomain = process.env.NODE_ENV === "production" && (
  process.env.VERCEL_ENV === "production"
  || configuredSiteUrl.includes("carnest.au")
);

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "",
  authDomain: shouldUseCustomProductionAuthDomain ? CUSTOM_PRODUCTION_AUTH_DOMAIN : rawFirebaseAuthDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? ""
};

export const missingFirebaseConfigKeys = [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", firebaseConfig.appId]
].filter(([, value]) => !value).map(([key]) => key);

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

export const isFirebaseStorageConfigured = Boolean(
  isFirebaseConfigured && firebaseConfig.storageBucket
);

const app = getApps().length
  ? getApps()[0]
  : initializeApp(
      isFirebaseConfigured
        ? firebaseConfig
        : {
            apiKey: "demo",
            authDomain: "demo",
            projectId: "demo",
            storageBucket: "demo",
            messagingSenderId: "demo",
            appId: "demo"
          }
    );

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
