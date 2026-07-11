import "server-only";

import { AppOptions, applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function normalizePrivateKey(value?: string) {
  return value?.replace(/\\n/g, "\n").trim() ?? "";
}

function getServiceAccountCredentialOptions() {
  const rawServiceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim() ?? "";
  if (rawServiceAccountJson) {
    try {
      const parsed = JSON.parse(rawServiceAccountJson) as {
        projectId?: string;
        clientEmail?: string;
        privateKey?: string;
      };
      if (parsed.projectId && parsed.clientEmail && parsed.privateKey) {
        return {
          projectId: parsed.projectId,
          clientEmail: parsed.clientEmail,
          privateKey: normalizePrivateKey(parsed.privateKey)
        };
      }
    } catch (error) {
      console.error("[firebase-admin-server] Invalid FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON", error);
    }
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim()
    || process.env.GOOGLE_CLOUD_PROJECT?.trim()
    || process.env.GCLOUD_PROJECT?.trim()
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
    || "";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey
    };
  }

  return null;
}

function buildFirebaseAdminOptions(): AppOptions {
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? undefined;
  const serviceAccount = getServiceAccountCredentialOptions();
  const projectId =
    serviceAccount?.projectId
    || process.env.FIREBASE_ADMIN_PROJECT_ID?.trim()
    || process.env.GOOGLE_CLOUD_PROJECT?.trim()
    || process.env.GCLOUD_PROJECT?.trim()
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
    || undefined;

  if (serviceAccount) {
    return {
      credential: cert(serviceAccount),
      ...(projectId ? { projectId } : {}),
      ...(storageBucket ? { storageBucket } : {})
    };
  }

  return {
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
    ...(storageBucket ? { storageBucket } : {})
  };
}

export function getFirebaseAdminApp() {
  if (getApps().length) {
    return getApps()[0];
  }

  return initializeApp(buildFirebaseAdminOptions());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
