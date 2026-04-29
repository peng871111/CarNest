import { App, applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID?.trim()
  || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  || "";
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() || "";
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";

let cachedApp: App | null = null;

function createAdminApp() {
  if (getApps().length) {
    return getApps()[0]!;
  }

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {})
  });
}

export function getAdminDb(): Firestore | null {
  try {
    if (!cachedApp) {
      cachedApp = createAdminApp();
    }

    return getFirestore(cachedApp);
  } catch (error) {
    console.warn("[vehicle-views] Firebase Admin SDK is not configured.", {
      reason: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
