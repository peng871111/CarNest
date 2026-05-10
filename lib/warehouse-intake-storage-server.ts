import "server-only";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? "";

function buildStorageMediaUrl(storagePath: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

export async function fetchPrivateWarehouseIntakeStorageObject(storagePath: string, idToken: string) {
  if (!STORAGE_BUCKET) {
    throw new Error("Firebase Storage bucket is not configured.");
  }

  if (!storagePath.trim()) {
    throw new Error("Storage path is required.");
  }

  if (!idToken.trim()) {
    throw new Error("Missing Firebase ID token.");
  }

  const url = buildStorageMediaUrl(storagePath);
  const authHeaders = [
    { Authorization: `Firebase ${idToken}` },
    { Authorization: `Bearer ${idToken}` }
  ];

  let lastResponse: Response | null = null;

  for (const headers of authHeaders) {
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store"
    });

    if (response.ok) {
      return response;
    }

    lastResponse = response;

    if (response.status !== 401 && response.status !== 403) {
      break;
    }
  }

  const errorText = lastResponse ? await lastResponse.text().catch(() => "") : "";
  throw new Error(
    `Unable to access private warehouse intake file (${lastResponse?.status ?? "unknown"}).${errorText ? ` ${errorText}` : ""}`
  );
}
