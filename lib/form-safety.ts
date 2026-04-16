export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const DEFAULT_RATE_LIMIT_MESSAGE = "Too many requests. Please try again later.";
const DEFAULT_DUPLICATE_MESSAGE = "It looks like this request was already submitted.";

interface AntiSpamCheckInput {
  honeypot: string;
  startedAt: number;
  storageKey: string;
  minimumFillMs?: number;
  throttleMs?: number;
}

export function isValidEmailAddress(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

function readSubmissionEntries(storageKey: string) {
  if (typeof window === "undefined") return [] as Array<{ at: number; fingerprint?: string }>;

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue) as Array<{ at?: unknown; fingerprint?: unknown }>;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => ({
        at: Number(entry.at ?? 0),
        fingerprint: typeof entry.fingerprint === "string" ? entry.fingerprint : undefined
      }))
      .filter((entry) => Number.isFinite(entry.at) && entry.at > 0);
  } catch {
    return [];
  }
}

function writeSubmissionEntries(storageKey: string, entries: Array<{ at: number; fingerprint?: string }>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entries.slice(-20)));
  } catch {
    // Ignore storage failures and continue with lighter protection.
  }
}

export function buildSubmissionFingerprint(parts: Array<string | number | undefined | null>) {
  return parts
    .map((part) => String(part ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("|");
}

export function checkRateLimit({
  storageKey,
  limit,
  windowMs,
  message = DEFAULT_RATE_LIMIT_MESSAGE
}: {
  storageKey: string;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  const now = Date.now();
  const recentEntries = readSubmissionEntries(storageKey).filter((entry) => now - entry.at <= windowMs);
  writeSubmissionEntries(storageKey, recentEntries);

  if (recentEntries.length >= limit) {
    return message;
  }

  return "";
}

export function checkDuplicateSubmission({
  storageKey,
  fingerprint,
  windowMs,
  message = DEFAULT_DUPLICATE_MESSAGE
}: {
  storageKey: string;
  fingerprint: string;
  windowMs: number;
  message?: string;
}) {
  if (!fingerprint) return "";

  const now = Date.now();
  const recentEntries = readSubmissionEntries(storageKey).filter((entry) => now - entry.at <= windowMs);
  writeSubmissionEntries(storageKey, recentEntries);

  if (recentEntries.some((entry) => entry.fingerprint === fingerprint)) {
    return message;
  }

  return "";
}

export function checkAntiSpamGuards({
  honeypot,
  startedAt,
  storageKey,
  minimumFillMs = 1500,
  throttleMs = 30000
}: AntiSpamCheckInput) {
  if (honeypot.trim()) {
    return "Unable to submit right now.";
  }

  if (Date.now() - startedAt < minimumFillMs) {
    return "Please take a moment to review your details before submitting.";
  }

  if (typeof window !== "undefined") {
    const lastSubmittedAt = Number(window.sessionStorage.getItem(storageKey) ?? "0");
    if (lastSubmittedAt && Date.now() - lastSubmittedAt < throttleMs) {
      return "Please wait a moment before submitting again.";
    }
  }

  return "";
}

export function rememberSubmission(storageKey: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(storageKey, String(Date.now()));
}

export function rememberSubmissionEvent(storageKey: string, fingerprint?: string) {
  const now = Date.now();
  const recentEntries = readSubmissionEntries(storageKey).filter((entry) => now - entry.at <= 24 * 60 * 60 * 1000);
  recentEntries.push({ at: now, fingerprint });
  writeSubmissionEntries(storageKey, recentEntries);
}

export function validateTurnstileToken(token: string) {
  if (!TURNSTILE_SITE_KEY) return "";
  if (token.trim()) return "";
  return "Please complete the security check before submitting.";
}

export async function verifyTurnstileToken(token: string) {
  if (!TURNSTILE_SITE_KEY) return "";
  if (!token.trim()) return "Please complete the security check before submitting.";

  try {
    const response = await fetch("/api/turnstile/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      return "Something went wrong. Please try again.";
    }

    const payload = (await response.json()) as { success?: boolean };
    return payload.success ? "" : "Please complete the security check before submitting.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}
