import "server-only";

import { randomBytes, randomInt, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { DocumentData, DocumentReference, DocumentSnapshot, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin-server";
import { getAdminVehicleById } from "@/lib/vehicle-admin-server";
import {
  sendAdminInspectionNotificationEmail,
  sendAdminOfferNotificationEmail,
  sendSellerOfferNotificationEmail,
  sendVehicleActionVerificationCodeEmail
} from "@/lib/public-vehicle-action-email";
import {
  calculateMinimumOfferAmount,
  EMAIL_OTP_EXPIRY_MINUTES,
  EMAIL_OTP_LENGTH,
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_MAX_REQUESTS_PER_EMAIL_PER_HOUR,
  EMAIL_OTP_MAX_REQUESTS_PER_IP_PER_HOUR,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  formatInspectionDateForDisplay,
  formatPhoneForDisplay,
  INSPECTION_MAX_PER_EMAIL_PER_DAY,
  INSPECTION_MAX_PER_IP_PER_DAY,
  INSPECTION_MAX_PER_PHONE_PER_DAY,
  isPastInspectionDate,
  isPublicVehicleActionType,
  isReasonablyValidPhoneNumber,
  isValidEmailAddress,
  isValidOtpCode,
  normalizeEmailAddress,
  normalizeIdempotencyKey,
  normalizePhoneNumber,
  OFFER_MAX_PER_EMAIL_PER_DAY,
  OFFER_MAX_PER_IP_PER_DAY,
  OFFER_MAX_PER_PHONE_PER_DAY,
  PUBLIC_ACTION_EMAIL_MAX_LENGTH,
  PUBLIC_ACTION_IDEMPOTENCY_KEY_MAX_LENGTH,
  PUBLIC_ACTION_MESSAGE_MAX_LENGTH,
  PUBLIC_ACTION_NAME_MAX_LENGTH,
  PUBLIC_ACTION_PHONE_MAX_LENGTH,
  PUBLIC_ACTION_PREFERRED_TIME_MAX_LENGTH,
  PublicEmailVerificationMethod,
  PublicOfferSource,
  PublicVehicleActionType,
  sanitizePlainText,
  sanitizeSingleLineText
} from "@/lib/public-vehicle-action-validation";
import { formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { Vehicle } from "@/types";

const OTP_SESSION_COLLECTION = "publicEmailVerificationSessions";
const NOTIFICATION_FAILURE_COLLECTION = "publicSubmissionNotificationFailures";
const OFFER_COLLECTION = "offers";
const INSPECTION_COLLECTION = "inspectionRequests";
const OTP_EXPIRY_MS = EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

type VerificationSessionRecord = {
  id: string;
  actionType: PublicVehicleActionType;
  vehicleId: string;
  email: string;
  codeHash: string;
  verificationTokenHash?: string;
  attemptCount: number;
  ipHash: string;
  deliveryStatus: "sent" | "failed";
  resendAvailableAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  verifiedAt?: Date;
  codeUsedAt?: Date;
  submissionUsedAt?: Date;
  relatedDocumentId?: string;
};

type AuthenticatedContext = {
  uid: string;
  email: string;
  emailVerified: boolean;
} | null;

type PublicRouteErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_REQUEST"
  | "LISTING_UNAVAILABLE"
  | "TURNSTILE_FAILED"
  | "OTP_SEND_FAILED"
  | "OTP_COOLDOWN"
  | "OTP_REQUEST_LIMIT_EMAIL"
  | "OTP_REQUEST_LIMIT_IP"
  | "OTP_INCORRECT"
  | "OTP_EXPIRED"
  | "OTP_TOO_MANY_ATTEMPTS"
  | "EMAIL_NOT_VERIFIED"
  | "PROFILE_SETUP_FAILED"
  | "OFFER_BELOW_MINIMUM"
  | "OFFER_RATE_LIMIT_EMAIL"
  | "OFFER_RATE_LIMIT_PHONE"
  | "OFFER_RATE_LIMIT_IP"
  | "INSPECTION_RATE_LIMIT_EMAIL"
  | "INSPECTION_RATE_LIMIT_PHONE"
  | "INSPECTION_RATE_LIMIT_IP"
  | "SAVE_FAILED"
  | "PHOTO_UPLOAD_FAILED"
  | "PHOTO_METADATA_FAILED"
  | "INSPECTION_SAVE_FAILED";

class PublicRouteError extends Error {
  constructor(
    readonly code: PublicRouteErrorCode,
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "PublicRouteError";
  }
}

type VerificationResolution =
  | {
      verified: true;
      method: PublicEmailVerificationMethod;
      source: PublicOfferSource;
      authenticatedUid?: string;
      sessionRef?: DocumentReference;
      existingSubmissionId?: string;
    }
  | {
      verified: false;
    };

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || ""
  );
}

function getVehicleTitle(vehicle: Vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function getPublicActionSecret() {
  return (
    process.env.PUBLIC_ACTION_SECRET
    || process.env.EMAIL_OTP_SECRET
    || process.env.CRON_SECRET
    || process.env.TURNSTILE_SECRET_KEY
    || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
    || process.env.RESEND_API_KEY
    || ""
  ).trim();
}

function hashValue(scope: string, value: string) {
  const secret = getPublicActionSecret();
  if (!secret) {
    throw new Error("A server-side signing secret is not configured.");
  }

  return createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex");
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function buildOtpHash(sessionId: string, code: string) {
  return hashValue("public-email-otp", `${sessionId}:${code}`);
}

function buildVerificationTokenHash(sessionId: string, token: string) {
  return hashValue("public-email-verification-token", `${sessionId}:${token}`);
}

function buildIpHash(ip: string) {
  return ip ? hashValue("public-request-ip", ip) : "";
}

function getNow() {
  return new Date();
}

function normalizeVerificationSession(
  snapshot: DocumentSnapshot<DocumentData>
): VerificationSessionRecord | null {
  const data = snapshot.data();
  if (!data) return null;

  return {
    id: snapshot.id,
    actionType: data.actionType === "inspection" ? "inspection" : "offer",
    vehicleId: typeof data.vehicleId === "string" ? data.vehicleId : "",
    email: typeof data.email === "string" ? data.email : "",
    codeHash: typeof data.codeHash === "string" ? data.codeHash : "",
    verificationTokenHash: typeof data.verificationTokenHash === "string" ? data.verificationTokenHash : undefined,
    attemptCount: typeof data.attemptCount === "number" ? data.attemptCount : 0,
    ipHash: typeof data.ipHash === "string" ? data.ipHash : "",
    deliveryStatus: data.deliveryStatus === "failed" ? "failed" : "sent",
    resendAvailableAt: data.resendAvailableAt instanceof Timestamp ? data.resendAvailableAt.toDate() : undefined,
    expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : undefined,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
    verifiedAt: data.verifiedAt instanceof Timestamp ? data.verifiedAt.toDate() : undefined,
    codeUsedAt: data.codeUsedAt instanceof Timestamp ? data.codeUsedAt.toDate() : undefined,
    submissionUsedAt: data.submissionUsedAt instanceof Timestamp ? data.submissionUsedAt.toDate() : undefined,
    relatedDocumentId: typeof data.relatedDocumentId === "string" ? data.relatedDocumentId : undefined
  };
}

async function verifyTurnstileTokenServer(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ?? "";
  if (!secret) return true;
  if (!token.trim()) return false;

  const formData = new URLSearchParams();
  formData.set("secret", secret);
  formData.set("response", token.trim());
  if (ip) {
    formData.set("remoteip", ip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new PublicRouteError("TURNSTILE_FAILED", "Please complete the security check before submitting.", 502);
  }

  const payload = await response.json() as { success?: boolean };
  return Boolean(payload.success);
}

async function resolveAuthenticatedContext(authToken?: string): Promise<AuthenticatedContext> {
  const token = authToken?.trim() ?? "";
  if (!token) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const normalizedEmail = normalizeEmailAddress(decoded.email ?? "");
    return normalizedEmail
      ? {
          uid: decoded.uid,
          email: normalizedEmail,
          emailVerified: decoded.email_verified === true
        }
      : null;
  } catch (error) {
    console.warn("[public-vehicle-actions] Failed to verify authenticated user token.", {
      code: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

function ensurePublicVehicleAvailable(vehicle: Vehicle | null, actionType: PublicVehicleActionType): asserts vehicle is Vehicle {
  if (!vehicle || vehicle.deleted || vehicle.status !== "approved" || vehicle.sellerStatus !== "ACTIVE") {
    throw new PublicRouteError("LISTING_UNAVAILABLE", "This vehicle is no longer available.", 409);
  }

  if (actionType === "inspection" && vehicle.listingType !== "warehouse") {
    throw new PublicRouteError("LISTING_UNAVAILABLE", "This vehicle is no longer available.", 409);
  }
}

async function loadPublicVehicleOrThrow(vehicleId: string, actionType: PublicVehicleActionType) {
  const vehicle = await getAdminVehicleById(vehicleId);
  ensurePublicVehicleAvailable(vehicle, actionType);
  return vehicle;
}

function validateContactFields(input: {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
}) {
  const buyerName = sanitizeSingleLineText(input.buyerName, PUBLIC_ACTION_NAME_MAX_LENGTH);
  const buyerEmail = normalizeEmailAddress(input.buyerEmail.slice(0, PUBLIC_ACTION_EMAIL_MAX_LENGTH));
  const buyerPhoneDisplay = formatPhoneForDisplay(input.buyerPhone).slice(0, PUBLIC_ACTION_PHONE_MAX_LENGTH);
  const buyerPhoneNormalized = normalizePhoneNumber(input.buyerPhone);

  if (!buyerName) {
    throw new PublicRouteError("INVALID_REQUEST", "Please enter your name.");
  }

  if (!buyerEmail || !isValidEmailAddress(buyerEmail)) {
    throw new PublicRouteError("INVALID_REQUEST", "Please enter a valid email address.");
  }

  if (!buyerPhoneDisplay || !isReasonablyValidPhoneNumber(input.buyerPhone)) {
    throw new PublicRouteError("INVALID_REQUEST", "Please enter a valid phone number.");
  }

  return {
    buyerName,
    buyerEmail,
    buyerPhoneDisplay,
    buyerPhoneNormalized
  };
}

function createOtpCode() {
  return String(randomInt(0, 1000000)).padStart(EMAIL_OTP_LENGTH, "0");
}

function createVerificationToken() {
  return randomBytes(24).toString("base64url");
}

async function getRecentOtpSessions(withinMs: number) {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - withinMs));
  const snapshot = await getAdminDb().collection(OTP_SESSION_COLLECTION).where("createdAt", ">=", cutoff).get();
  return snapshot.docs.map(normalizeVerificationSession).filter((entry): entry is VerificationSessionRecord => Boolean(entry));
}

async function getRecentOfferDocs() {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - DAY_MS));
  return await getAdminDb().collection(OFFER_COLLECTION).where("createdAt", ">=", cutoff).get();
}

async function getRecentInspectionDocs() {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - DAY_MS));
  return await getAdminDb().collection(INSPECTION_COLLECTION).where("createdAt", ">=", cutoff).get();
}

async function recordNotificationFailure(input: {
  type: "offer_admin" | "offer_seller" | "inspection_admin";
  relatedDocumentId: string;
  vehicleId: string;
  vehicleTitle: string;
  recipient: string;
  errorMessage: string;
}) {
  await getAdminDb().collection(NOTIFICATION_FAILURE_COLLECTION).add({
    ...input,
    createdAt: Timestamp.now()
  });
}

async function fetchSellerNotificationEmail(ownerUid: string) {
  if (!ownerUid) return "";
  const snapshot = await getAdminDb().collection("users").doc(ownerUid).get();
  const data = snapshot.data();
  const email = typeof data?.email === "string" ? normalizeEmailAddress(data.email) : "";
  return isValidEmailAddress(email) ? email : "";
}

function isOfferDuplicateCandidate(data: Record<string, unknown>, input: {
  vehicleId: string;
  buyerEmail: string;
  offerAmount: number;
  message: string;
}) {
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().getTime() : 0;
  if (!createdAt || Date.now() - createdAt > DUPLICATE_WINDOW_MS) return false;

  const normalizedEmail =
    typeof data.normalizedBuyerEmail === "string"
      ? data.normalizedBuyerEmail
      : normalizeEmailAddress(String(data.buyerEmail ?? ""));
  const amount = Number(data.offerAmount ?? data.amount ?? 0);
  const normalizedMessage = sanitizePlainText(String(data.message ?? ""));

  return normalizedEmail === input.buyerEmail
    && String(data.vehicleId ?? "") === input.vehicleId
    && amount === input.offerAmount
    && normalizedMessage === input.message;
}

function isInspectionDuplicateCandidate(data: Record<string, unknown>, input: {
  vehicleId: string;
  buyerEmail: string;
  preferredDate: string;
  preferredTime: string;
  message: string;
}) {
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().getTime() : 0;
  if (!createdAt || Date.now() - createdAt > DUPLICATE_WINDOW_MS) return false;

  const normalizedEmail =
    typeof data.normalizedBuyerEmail === "string"
      ? data.normalizedBuyerEmail
      : normalizeEmailAddress(String(data.buyerEmail ?? ""));

  return normalizedEmail === input.buyerEmail
    && String(data.vehicleId ?? "") === input.vehicleId
    && String(data.preferredDate ?? "") === input.preferredDate
    && sanitizeSingleLineText(String(data.preferredTime ?? ""), PUBLIC_ACTION_PREFERRED_TIME_MAX_LENGTH) === input.preferredTime
    && sanitizePlainText(String(data.message ?? "")) === input.message;
}

async function resolveVerificationForSubmission(input: {
  actionType: PublicVehicleActionType;
  vehicleId: string;
  email: string;
  authToken?: string;
  verificationSessionId?: string;
  verificationToken?: string;
}): Promise<VerificationResolution> {
  const authenticated = await resolveAuthenticatedContext(input.authToken);
  if (authenticated && authenticated.emailVerified && authenticated.email === input.email) {
    return {
      verified: true,
      method: "account_email",
      source: "authenticated",
      authenticatedUid: authenticated.uid
    };
  }

  const sessionId = input.verificationSessionId?.trim() ?? "";
  const verificationToken = input.verificationToken?.trim() ?? "";
  if (!sessionId || !verificationToken) {
    return { verified: false };
  }

  const sessionRef = getAdminDb().collection(OTP_SESSION_COLLECTION).doc(sessionId);
  const snapshot = await sessionRef.get();
  const session = normalizeVerificationSession(snapshot);
  if (!session || session.deliveryStatus !== "sent") {
    return { verified: false };
  }

  if (
    session.actionType !== input.actionType
    || session.vehicleId !== input.vehicleId
    || session.email !== input.email
    || !session.verificationTokenHash
    || !hashesMatch(session.verificationTokenHash, buildVerificationTokenHash(session.id, verificationToken))
  ) {
    return { verified: false };
  }

  if (!session.verifiedAt || !session.codeUsedAt || !session.expiresAt || session.expiresAt.getTime() < Date.now()) {
    throw new PublicRouteError("OTP_EXPIRED", "Verification code has expired. Please request a new code.");
  }

  return {
    verified: true,
    method: "email_otp",
    source: authenticated ? "authenticated" : "guest",
    authenticatedUid: authenticated?.uid,
    sessionRef,
    existingSubmissionId: session.relatedDocumentId
  };
}

async function updateOfferNotificationState(offerId: string, state: {
  adminNotificationStatus?: "sent" | "failed";
  adminNotificationProviderMessageId?: string | null;
  adminNotificationFailedAt?: Timestamp | null;
  sellerNotificationStatus?: "sent" | "failed";
  sellerNotificationProviderMessageId?: string | null;
  sellerNotificationFailedAt?: Timestamp | null;
}) {
  await getAdminDb().collection(OFFER_COLLECTION).doc(offerId).set(state, { merge: true });
}

async function updateInspectionNotificationState(inspectionId: string, state: {
  adminNotificationStatus?: "sent" | "failed";
  adminNotificationProviderMessageId?: string | null;
  adminNotificationFailedAt?: Timestamp | null;
}) {
  await getAdminDb().collection(INSPECTION_COLLECTION).doc(inspectionId).set(state, { merge: true });
}

export async function sendPublicActionVerificationCode(input: {
  actionType: PublicVehicleActionType;
  vehicleId: string;
  email: string;
  turnstileToken: string;
  request: NextRequest;
}) {
  if (!isPublicVehicleActionType(input.actionType)) {
    throw new PublicRouteError("INVALID_REQUEST", "Unable to send a verification code.");
  }

  const vehicle = await loadPublicVehicleOrThrow(input.vehicleId, input.actionType);
  const email = normalizeEmailAddress(input.email.slice(0, PUBLIC_ACTION_EMAIL_MAX_LENGTH));
  if (!isValidEmailAddress(email)) {
    throw new PublicRouteError("INVALID_REQUEST", "Please enter a valid email address.");
  }

  const ip = getClientIp(input.request);
  const ipHash = buildIpHash(ip);
  const turnstileOk = await verifyTurnstileTokenServer(input.turnstileToken, ip);
  if (!turnstileOk) {
    throw new PublicRouteError("TURNSTILE_FAILED", "Please complete the security check before submitting.");
  }

  const recentSessions = await getRecentOtpSessions(HOUR_MS);
  const recentForEmail = recentSessions.filter((session) => session.email === email);
  const recentForIp = ipHash ? recentSessions.filter((session) => session.ipHash === ipHash) : [];
  if (recentForEmail.length >= EMAIL_OTP_MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
    throw new PublicRouteError("OTP_REQUEST_LIMIT_EMAIL", "Too many verification code requests. Please try again later.", 429);
  }
  if (recentForIp.length >= EMAIL_OTP_MAX_REQUESTS_PER_IP_PER_HOUR) {
    throw new PublicRouteError("OTP_REQUEST_LIMIT_IP", "Too many verification code requests. Please try again later.", 429);
  }

  const recentForSameListingAction = recentSessions
    .filter((session) => session.email === email && session.vehicleId === vehicle.id && session.actionType === input.actionType && session.deliveryStatus === "sent")
    .sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0))[0];

  if (recentForSameListingAction?.createdAt && Date.now() - recentForSameListingAction.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new PublicRouteError("OTP_COOLDOWN", "Please wait before requesting another code.", 429);
  }

  const sessionRef = getAdminDb().collection(OTP_SESSION_COLLECTION).doc();
  const code = createOtpCode();
  const now = getNow();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  try {
    const emailResult = await sendVehicleActionVerificationCodeEmail(email, code);
    await sessionRef.set({
      actionType: input.actionType,
      vehicleId: vehicle.id,
      vehicleTitle: getVehicleTitle(vehicle),
      vehicleReference: getVehicleDisplayReference(vehicle),
      email,
      codeHash: buildOtpHash(sessionRef.id, code),
      verificationTokenHash: "",
      attemptCount: 0,
      ipHash,
      deliveryStatus: "sent",
      resendAvailableAt: Timestamp.fromDate(new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS)),
      expiresAt: Timestamp.fromDate(expiresAt),
      providerMessageId: emailResult.providerMessageId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now)
    });
  } catch (error) {
    await sessionRef.set({
      actionType: input.actionType,
      vehicleId: vehicle.id,
      vehicleTitle: getVehicleTitle(vehicle),
      vehicleReference: getVehicleDisplayReference(vehicle),
      email,
      codeHash: "",
      verificationTokenHash: "",
      attemptCount: 0,
      ipHash,
      deliveryStatus: "failed",
      deliveryErrorMessage: error instanceof Error ? error.message : String(error),
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now)
    });

    console.error("[public-vehicle-actions] Verification email send failed.", {
      operation: "send_verification_code",
      vehicleId: vehicle.id,
      actionType: input.actionType,
      email,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new PublicRouteError("OTP_SEND_FAILED", "Verification email could not be sent. Please try again.");
  }

  return {
    sessionId: sessionRef.id,
    expiresAt: expiresAt.toISOString(),
    cooldownSeconds: EMAIL_OTP_RESEND_COOLDOWN_SECONDS
  };
}

export async function verifyPublicActionEmailCode(input: {
  actionType: PublicVehicleActionType;
  vehicleId: string;
  email: string;
  sessionId: string;
  code: string;
}) {
  if (!isPublicVehicleActionType(input.actionType)) {
    throw new PublicRouteError("INVALID_REQUEST", "Verification code is incorrect.");
  }

  const email = normalizeEmailAddress(input.email.slice(0, PUBLIC_ACTION_EMAIL_MAX_LENGTH));
  const code = input.code.trim();
  if (!isValidEmailAddress(email) || !isValidOtpCode(code) || !input.sessionId.trim()) {
    throw new PublicRouteError("OTP_INCORRECT", "Verification code is incorrect.");
  }

  const sessionRef = getAdminDb().collection(OTP_SESSION_COLLECTION).doc(input.sessionId.trim());
  const snapshot = await sessionRef.get();
  const session = normalizeVerificationSession(snapshot);

  if (
    !session
    || session.deliveryStatus !== "sent"
    || session.email !== email
    || session.vehicleId !== input.vehicleId
    || session.actionType !== input.actionType
    || !session.codeHash
  ) {
    throw new PublicRouteError("OTP_INCORRECT", "Verification code is incorrect.");
  }

  const now = getNow();
  if (session.codeUsedAt) {
    throw new PublicRouteError("OTP_INCORRECT", "Verification code has already been used.");
  }

  if (!session.expiresAt || session.expiresAt.getTime() < now.getTime()) {
    throw new PublicRouteError("OTP_EXPIRED", "Verification code has expired. Please request a new code.");
  }

  if (session.attemptCount >= EMAIL_OTP_MAX_ATTEMPTS) {
    throw new PublicRouteError("OTP_TOO_MANY_ATTEMPTS", "Too many verification attempts. Please request a new code.");
  }

  const nextAttemptCount = session.attemptCount + 1;
  const codeMatches = hashesMatch(session.codeHash, buildOtpHash(session.id, code));
  if (!codeMatches) {
    await sessionRef.set(
      {
        attemptCount: nextAttemptCount,
        updatedAt: Timestamp.fromDate(now)
      },
      { merge: true }
    );

    if (nextAttemptCount >= EMAIL_OTP_MAX_ATTEMPTS) {
      throw new PublicRouteError("OTP_TOO_MANY_ATTEMPTS", "Too many verification attempts. Please request a new code.");
    }

    throw new PublicRouteError("OTP_INCORRECT", "Verification code is incorrect.");
  }

  const verificationToken = createVerificationToken();
  await sessionRef.set(
    {
      attemptCount: nextAttemptCount,
      verificationTokenHash: buildVerificationTokenHash(session.id, verificationToken),
      verifiedAt: Timestamp.fromDate(now),
      codeUsedAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now)
    },
    { merge: true }
  );

  return {
    verificationToken
  };
}

async function enforceOfferRateLimits(input: {
  buyerEmail: string;
  buyerPhoneNormalized: string;
  ipHash: string;
}) {
  const snapshot = await getRecentOfferDocs();
  let emailCount = 0;
  let phoneCount = 0;
  let ipCount = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const normalizedEmail =
      typeof data.normalizedBuyerEmail === "string"
        ? data.normalizedBuyerEmail
        : normalizeEmailAddress(String(data.buyerEmail ?? ""));
    const normalizedPhone =
      typeof data.normalizedBuyerPhone === "string"
        ? data.normalizedBuyerPhone
        : normalizePhoneNumber(String(data.buyerPhone ?? ""));
    const submissionIpHash = typeof data.submissionIpHash === "string" ? data.submissionIpHash : "";

    if (normalizedEmail === input.buyerEmail) emailCount += 1;
    if (normalizedPhone && normalizedPhone === input.buyerPhoneNormalized) phoneCount += 1;
    if (input.ipHash && submissionIpHash === input.ipHash) ipCount += 1;
  });

  if (emailCount >= OFFER_MAX_PER_EMAIL_PER_DAY) {
    throw new PublicRouteError("OFFER_RATE_LIMIT_EMAIL", "Daily offer limit reached. Please try again later.", 429);
  }
  if (phoneCount >= OFFER_MAX_PER_PHONE_PER_DAY) {
    throw new PublicRouteError("OFFER_RATE_LIMIT_PHONE", "Daily offer limit reached. Please try again later.", 429);
  }
  if (ipCount >= OFFER_MAX_PER_IP_PER_DAY) {
    throw new PublicRouteError("OFFER_RATE_LIMIT_IP", "Too many requests. Please try again later.", 429);
  }
}

async function enforceInspectionRateLimits(input: {
  buyerEmail: string;
  buyerPhoneNormalized: string;
  ipHash: string;
}) {
  const snapshot = await getRecentInspectionDocs();
  let emailCount = 0;
  let phoneCount = 0;
  let ipCount = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const normalizedEmail =
      typeof data.normalizedBuyerEmail === "string"
        ? data.normalizedBuyerEmail
        : normalizeEmailAddress(String(data.buyerEmail ?? ""));
    const normalizedPhone =
      typeof data.normalizedBuyerPhone === "string"
        ? data.normalizedBuyerPhone
        : normalizePhoneNumber(String(data.buyerPhone ?? ""));
    const submissionIpHash = typeof data.submissionIpHash === "string" ? data.submissionIpHash : "";

    if (normalizedEmail === input.buyerEmail) emailCount += 1;
    if (normalizedPhone && normalizedPhone === input.buyerPhoneNormalized) phoneCount += 1;
    if (input.ipHash && submissionIpHash === input.ipHash) ipCount += 1;
  });

  if (emailCount >= INSPECTION_MAX_PER_EMAIL_PER_DAY) {
    throw new PublicRouteError("INSPECTION_RATE_LIMIT_EMAIL", "Too many inspection requests. Please try again later.", 429);
  }
  if (phoneCount >= INSPECTION_MAX_PER_PHONE_PER_DAY) {
    throw new PublicRouteError("INSPECTION_RATE_LIMIT_PHONE", "Too many inspection requests. Please try again later.", 429);
  }
  if (ipCount >= INSPECTION_MAX_PER_IP_PER_DAY) {
    throw new PublicRouteError("INSPECTION_RATE_LIMIT_IP", "Too many inspection requests. Please try again later.", 429);
  }
}

export async function submitPublicOffer(input: {
  vehicleId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  offerAmount: number;
  message?: string;
  turnstileToken: string;
  idempotencyKey: string;
  request: NextRequest;
  authToken?: string;
  verificationSessionId?: string;
  verificationToken?: string;
}) {
  const vehicle = await loadPublicVehicleOrThrow(input.vehicleId, "offer");
  const { buyerName, buyerEmail, buyerPhoneDisplay, buyerPhoneNormalized } = validateContactFields(input);
  const message = sanitizePlainText(input.message ?? "", PUBLIC_ACTION_MESSAGE_MAX_LENGTH);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) {
    throw new PublicRouteError("INVALID_REQUEST", "Offer could not be saved.");
  }

  if (!Number.isFinite(input.offerAmount) || input.offerAmount <= 0) {
    throw new PublicRouteError("INVALID_REQUEST", "Please enter a valid offer amount.");
  }

  const minimumOffer = calculateMinimumOfferAmount(vehicle.price);
  if (input.offerAmount < minimumOffer) {
    throw new PublicRouteError("OFFER_BELOW_MINIMUM", `The minimum offer for this vehicle is ${formatCurrency(minimumOffer)}.`);
  }

  const ip = getClientIp(input.request);
  const turnstileOk = await verifyTurnstileTokenServer(input.turnstileToken, ip);
  if (!turnstileOk) {
    throw new PublicRouteError("TURNSTILE_FAILED", "Please complete the security check before submitting.");
  }

  const verification = await resolveVerificationForSubmission({
    actionType: "offer",
    vehicleId: vehicle.id,
    email: buyerEmail,
    authToken: input.authToken,
    verificationSessionId: input.verificationSessionId,
    verificationToken: input.verificationToken
  });

  if (!verification.verified) {
    throw new PublicRouteError("EMAIL_NOT_VERIFIED", "Please verify your email before submitting your offer.");
  }

  if (verification.existingSubmissionId) {
    const existingSnapshot = await getAdminDb().collection(OFFER_COLLECTION).doc(verification.existingSubmissionId).get();
    if (existingSnapshot.exists) {
      return {
        offerId: verification.existingSubmissionId,
        duplicate: true
      };
    }
  }

  const recentOffersSnapshot = await getRecentOfferDocs();
  const duplicateOffer = recentOffersSnapshot.docs.find((doc) =>
    isOfferDuplicateCandidate(doc.data(), {
      vehicleId: vehicle.id,
      buyerEmail,
      offerAmount: input.offerAmount,
      message
    })
  );

  if (duplicateOffer) {
    if (verification.sessionRef) {
      await verification.sessionRef.set(
        {
          submissionUsedAt: Timestamp.now(),
          relatedDocumentId: duplicateOffer.id,
          updatedAt: Timestamp.now()
        },
        { merge: true }
      );
    }
    return {
      offerId: duplicateOffer.id,
      duplicate: true
    };
  }

  const ipHash = buildIpHash(ip);
  await enforceOfferRateLimits({
    buyerEmail,
    buyerPhoneNormalized,
    ipHash
  });

  const createdAt = Timestamp.now();
  const nowIso = createdAt.toDate().toISOString();
  const verificationMethod = verification.method;
  const source = verification.source;
  const vehicleTitle = getVehicleTitle(vehicle);
  const offerPercentage = Number(((input.offerAmount / vehicle.price) * 100).toFixed(2));
  const offerRef = getAdminDb().collection(OFFER_COLLECTION).doc();
  const offerPayload = {
    buyerUid: verification.authenticatedUid ?? "",
    listingOwnerUid: vehicle.ownerUid,
    userId: verification.authenticatedUid ?? "",
    vehicleId: vehicle.id,
    vehicleTitle,
    vehicleReference: getVehicleDisplayReference(vehicle),
    vehiclePrice: vehicle.price,
    askingPriceAtSubmission: vehicle.price,
    buyerName,
    buyerEmail,
    buyerPhone: buyerPhoneDisplay,
    normalizedBuyerEmail: buyerEmail,
    normalizedBuyerPhone: buyerPhoneNormalized,
    amount: input.offerAmount,
    offerAmount: input.offerAmount,
    offerPercentage,
    message,
    messages: [
      {
        type: "offer_update",
        sender: "buyer",
        amount: input.offerAmount,
        createdAt
      },
      ...(message
        ? [{
            type: "message",
            sender: "buyer",
            text: message,
            createdAt
          }]
        : [])
    ],
    buyerViewed: true,
    sellerViewed: false,
    contactUnlocked: false,
    contactUnlockedAt: null,
    contactUnlockedBy: null,
    contactVisibilityState: "hidden",
    lastUpdatedBy: "buyer",
    sellerOwnerUid: vehicle.ownerUid,
    submittedByUid: verification.authenticatedUid ?? "",
    respondedAt: null,
    updatedAt: createdAt,
    createdAt,
    status: "pending",
    source,
    emailVerified: true,
    verificationMethod,
    submissionIpHash: ipHash,
    submissionUserAgent: input.request.headers.get("user-agent") ?? "",
    idempotencyKey: idempotencyKey.slice(0, PUBLIC_ACTION_IDEMPOTENCY_KEY_MAX_LENGTH),
    adminNotificationStatus: "pending",
    sellerNotificationStatus: "pending"
  };

  await offerRef.set(offerPayload);

  if (verification.sessionRef) {
    await verification.sessionRef.set(
      {
        submissionUsedAt: createdAt,
        relatedDocumentId: offerRef.id,
        updatedAt: createdAt
      },
      { merge: true }
    );
  }

  const verificationMethodLabel = verificationMethod === "email_otp" ? "Verified by email OTP" : "Verified account email";

  try {
    const result = await sendAdminOfferNotificationEmail({
      vehicle,
      buyerName,
      buyerEmail,
      buyerPhone: buyerPhoneDisplay,
      offerAmount: input.offerAmount,
      message,
      offerPercentage,
      verificationMethodLabel,
      submittedAt: createdAt.toDate()
    });
    await updateOfferNotificationState(offerRef.id, {
      adminNotificationStatus: "sent",
      adminNotificationProviderMessageId: result.providerMessageId,
      adminNotificationFailedAt: null
    });
  } catch (error) {
    console.error("[public-vehicle-actions] Offer admin notification failed.", {
      operation: "offer_admin_notification",
      offerId: offerRef.id,
      vehicleId: vehicle.id,
      error: error instanceof Error ? error.message : String(error)
    });
    await updateOfferNotificationState(offerRef.id, {
      adminNotificationStatus: "failed",
      adminNotificationProviderMessageId: null,
      adminNotificationFailedAt: Timestamp.now()
    });
    await recordNotificationFailure({
      type: "offer_admin",
      relatedDocumentId: offerRef.id,
      vehicleId: vehicle.id,
      vehicleTitle,
      recipient: "info@carnest.au",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }

  const sellerEmail = await fetchSellerNotificationEmail(vehicle.ownerUid);
  if (sellerEmail) {
    try {
      const result = await sendSellerOfferNotificationEmail({
        to: sellerEmail,
        vehicleTitle,
        amount: input.offerAmount,
        offerId: offerRef.id
      });
      await updateOfferNotificationState(offerRef.id, {
        sellerNotificationStatus: "sent",
        sellerNotificationProviderMessageId: result.providerMessageId,
        sellerNotificationFailedAt: null
      });
    } catch (error) {
      console.error("[public-vehicle-actions] Seller offer notification failed.", {
        operation: "offer_seller_notification",
        offerId: offerRef.id,
        vehicleId: vehicle.id,
        error: error instanceof Error ? error.message : String(error)
      });
      await updateOfferNotificationState(offerRef.id, {
        sellerNotificationStatus: "failed",
        sellerNotificationProviderMessageId: null,
        sellerNotificationFailedAt: Timestamp.now()
      });
      await recordNotificationFailure({
        type: "offer_seller",
        relatedDocumentId: offerRef.id,
        vehicleId: vehicle.id,
        vehicleTitle,
        recipient: sellerEmail,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    offerId: offerRef.id,
    duplicate: false,
    submittedAt: nowIso
  };
}

export async function submitPublicInspectionRequest(input: {
  vehicleId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  preferredDate: string;
  preferredTime: string;
  message?: string;
  turnstileToken: string;
  idempotencyKey: string;
  request: NextRequest;
  authToken?: string;
  verificationSessionId?: string;
  verificationToken?: string;
}) {
  const vehicle = await loadPublicVehicleOrThrow(input.vehicleId, "inspection");
  const { buyerName, buyerEmail, buyerPhoneDisplay, buyerPhoneNormalized } = validateContactFields(input);
  const preferredDate = input.preferredDate.trim();
  const preferredTime = sanitizeSingleLineText(input.preferredTime, PUBLIC_ACTION_PREFERRED_TIME_MAX_LENGTH);
  const message = sanitizePlainText(input.message ?? "", PUBLIC_ACTION_MESSAGE_MAX_LENGTH);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  if (!preferredDate || isPastInspectionDate(preferredDate)) {
    throw new PublicRouteError("INVALID_REQUEST", "Please choose a future inspection date.");
  }

  if (!preferredTime) {
    throw new PublicRouteError("INVALID_REQUEST", "Please share a preferred inspection time.");
  }

  if (!idempotencyKey) {
    throw new PublicRouteError("INVALID_REQUEST", "Inspection request could not be saved.");
  }

  const ip = getClientIp(input.request);
  const turnstileOk = await verifyTurnstileTokenServer(input.turnstileToken, ip);
  if (!turnstileOk) {
    throw new PublicRouteError("TURNSTILE_FAILED", "Please complete the security check before submitting.");
  }

  const verification = await resolveVerificationForSubmission({
    actionType: "inspection",
    vehicleId: vehicle.id,
    email: buyerEmail,
    authToken: input.authToken,
    verificationSessionId: input.verificationSessionId,
    verificationToken: input.verificationToken
  });

  if (!verification.verified) {
    throw new PublicRouteError("EMAIL_NOT_VERIFIED", "Please verify your email before requesting an inspection.");
  }

  if (verification.existingSubmissionId) {
    const existingSnapshot = await getAdminDb().collection(INSPECTION_COLLECTION).doc(verification.existingSubmissionId).get();
    if (existingSnapshot.exists) {
      return {
        inspectionRequestId: verification.existingSubmissionId,
        duplicate: true
      };
    }
  }

  const recentInspectionsSnapshot = await getRecentInspectionDocs();
  const duplicateInspection = recentInspectionsSnapshot.docs.find((doc) =>
    isInspectionDuplicateCandidate(doc.data(), {
      vehicleId: vehicle.id,
      buyerEmail,
      preferredDate,
      preferredTime,
      message
    })
  );

  if (duplicateInspection) {
    if (verification.sessionRef) {
      await verification.sessionRef.set(
        {
          submissionUsedAt: Timestamp.now(),
          relatedDocumentId: duplicateInspection.id,
          updatedAt: Timestamp.now()
        },
        { merge: true }
      );
    }
    return {
      inspectionRequestId: duplicateInspection.id,
      duplicate: true
    };
  }

  const ipHash = buildIpHash(ip);
  await enforceInspectionRateLimits({
    buyerEmail,
    buyerPhoneNormalized,
    ipHash
  });

  const createdAt = Timestamp.now();
  const inspectionRef = getAdminDb().collection(INSPECTION_COLLECTION).doc();
  await inspectionRef.set({
    vehicleId: vehicle.id,
    vehicleTitle: getVehicleTitle(vehicle),
    vehicleReference: getVehicleDisplayReference(vehicle),
    buyerName,
    buyerEmail,
    buyerPhone: buyerPhoneDisplay,
    normalizedBuyerEmail: buyerEmail,
    normalizedBuyerPhone: buyerPhoneNormalized,
    preferredDate,
    preferredTime,
    message,
    status: "NEW",
    listingType: vehicle.listingType,
    sellerOwnerUid: vehicle.ownerUid,
    submittedByUid: verification.authenticatedUid ?? "",
    createdAt,
    updatedAt: createdAt,
    source: verification.source,
    emailVerified: true,
    verificationMethod: verification.method,
    submissionIpHash: ipHash,
    submissionUserAgent: input.request.headers.get("user-agent") ?? "",
    idempotencyKey,
    adminNotificationStatus: "pending"
  });

  if (verification.sessionRef) {
    await verification.sessionRef.set(
      {
        submissionUsedAt: createdAt,
        relatedDocumentId: inspectionRef.id,
        updatedAt: createdAt
      },
      { merge: true }
    );
  }

  const verificationMethodLabel = verification.method === "email_otp" ? "Verified by email OTP" : "Verified account email";
  try {
    const result = await sendAdminInspectionNotificationEmail({
      vehicle,
      buyerName,
      buyerEmail,
      buyerPhone: buyerPhoneDisplay,
      preferredDate,
      preferredTime,
      message,
      verificationMethodLabel,
      submittedAt: createdAt.toDate()
    });
    await updateInspectionNotificationState(inspectionRef.id, {
      adminNotificationStatus: "sent",
      adminNotificationProviderMessageId: result.providerMessageId,
      adminNotificationFailedAt: null
    });
  } catch (error) {
    console.error("[public-vehicle-actions] Inspection admin notification failed.", {
      operation: "inspection_admin_notification",
      inspectionRequestId: inspectionRef.id,
      vehicleId: vehicle.id,
      error: error instanceof Error ? error.message : String(error)
    });
    await updateInspectionNotificationState(inspectionRef.id, {
      adminNotificationStatus: "failed",
      adminNotificationProviderMessageId: null,
      adminNotificationFailedAt: Timestamp.now()
    });
    await recordNotificationFailure({
      type: "inspection_admin",
      relatedDocumentId: inspectionRef.id,
      vehicleId: vehicle.id,
      vehicleTitle: getVehicleTitle(vehicle),
      recipient: "info@carnest.au",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    inspectionRequestId: inspectionRef.id,
    duplicate: false,
    preferredDateLabel: formatInspectionDateForDisplay(preferredDate)
  };
}

export function createPublicRouteErrorResponse(error: unknown) {
  if (error instanceof PublicRouteError) {
    return {
      status: error.status,
      body: {
        success: false,
        code: error.code,
        message: error.message
      }
    };
  }

  console.error("[public-vehicle-actions] Unhandled public route error.", error);
  return {
    status: 500,
    body: {
      success: false,
      code: "SAVE_FAILED" satisfies PublicRouteErrorCode,
      message: "Something went wrong. Please try again."
    }
  };
}
