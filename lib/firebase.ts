import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function readPublicEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

const firebaseConfig = {
  apiKey: readPublicEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readPublicEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readPublicEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readPublicEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readPublicEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readPublicEnv("NEXT_PUBLIC_FIREBASE_APP_ID")
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
