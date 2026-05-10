export function extractFirebaseStoragePath(value?: string | null) {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";

  if (normalized.startsWith("gs://")) {
    const withoutScheme = normalized.slice(5);
    const slashIndex = withoutScheme.indexOf("/");
    return slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
  }

  if (!/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);

    if (parsed.hostname === "firebasestorage.googleapis.com") {
      const pathMatch = parsed.pathname.match(/\/(?:v0|download\/storage\/v1)\/b\/[^/]+\/o\/(.+)$/i);
      if (pathMatch?.[1]) {
        return decodeURIComponent(pathMatch[1]);
      }
    }

    if (parsed.hostname === "storage.googleapis.com") {
      const [, bucket, ...segments] = parsed.pathname.split("/").filter(Boolean);
      if (bucket && segments.length) {
        return segments.join("/");
      }
    }
  } catch {
    return "";
  }

  return "";
}
