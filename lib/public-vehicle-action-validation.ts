export const EMAIL_OTP_LENGTH = 6;
export const EMAIL_OTP_EXPIRY_MINUTES = 10;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const EMAIL_OTP_MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5;
export const EMAIL_OTP_MAX_REQUESTS_PER_IP_PER_HOUR = 20;
export const OFFER_MINIMUM_PRICE_RATIO = 0.8;
export const OFFER_MAX_PER_EMAIL_PER_DAY = 3;
export const OFFER_MAX_PER_PHONE_PER_DAY = 3;
export const OFFER_MAX_PER_IP_PER_DAY = 10;
export const INSPECTION_MAX_PER_EMAIL_PER_DAY = 3;
export const INSPECTION_MAX_PER_PHONE_PER_DAY = 3;
export const INSPECTION_MAX_PER_IP_PER_DAY = 10;
export const PUBLIC_ACTION_NAME_MAX_LENGTH = 120;
export const PUBLIC_ACTION_EMAIL_MAX_LENGTH = 254;
export const PUBLIC_ACTION_PHONE_MAX_LENGTH = 32;
export const PUBLIC_ACTION_MESSAGE_MAX_LENGTH = 1200;
export const PUBLIC_ACTION_PREFERRED_TIME_MAX_LENGTH = 120;
export const PUBLIC_ACTION_IDEMPOTENCY_KEY_MAX_LENGTH = 120;

export type PublicVehicleActionType = "offer" | "inspection";
export type PublicOfferSource = "guest" | "authenticated";
export type PublicEmailVerificationMethod = "email_otp" | "account_email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPublicVehicleActionType(value: unknown): value is PublicVehicleActionType {
  return value === "offer" || value === "inspection";
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmailAddress(value: string) {
  return EMAIL_PATTERN.test(normalizeEmailAddress(value));
}

export function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function formatPhoneForDisplay(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isReasonablyValidPhoneNumber(value: string) {
  const normalized = normalizePhoneNumber(value);
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export function sanitizePlainText(value: string, maxLength = PUBLIC_ACTION_MESSAGE_MAX_LENGTH) {
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const normalized = withoutTags
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return normalized.slice(0, maxLength).trim();
}

export function sanitizeSingleLineText(value: string, maxLength: number) {
  return sanitizePlainText(value, maxLength).replace(/\n+/g, " ").trim();
}

export function isValidOtpCode(value: string) {
  return new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`).test(value.trim());
}

export function normalizeIdempotencyKey(value: string) {
  return sanitizeSingleLineText(value, PUBLIC_ACTION_IDEMPOTENCY_KEY_MAX_LENGTH);
}

export function formatInspectionDateForDisplay(value: string) {
  const parsed = parseInspectionDate(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(parsed);
}

export function parseInspectionDate(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isPastInspectionDate(value: string, now = new Date()) {
  const parsed = parseInspectionDate(value);
  if (!parsed) return true;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < today.getTime();
}

export function calculateMinimumOfferAmount(askingPrice: number) {
  return Math.ceil(askingPrice * OFFER_MINIMUM_PRICE_RATIO);
}
