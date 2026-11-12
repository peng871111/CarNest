import "server-only";

import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  DealerOfferInput,
  DEALER_OFFER_IDEMPOTENCY_KEY_PATTERN,
  getDealerOfferValidationErrors,
  isDealerOfferStatus,
  normalizeDealerOfferInput
} from "@/lib/dealer-offer-validation";
import { getAdminDb } from "@/lib/firebase-admin-server";
import { getAdminVehicleById } from "@/lib/vehicle-admin-server";
import { getVehicleDisplayReference } from "@/lib/utils";
import { DealerOffer, DealerOfferStatus } from "@/types";

const DEALER_OFFER_RATE_LIMITS = {
  ip: 20,
  phone: 5,
  email: 5
};
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export class DealerOfferRouteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function serializeDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : "";
  }
  if (typeof value === "string") return value;
  return "";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function serializeDealerOffer(id: string, data: Record<string, unknown>): DealerOffer {
  return {
    id,
    vehicleId: stringValue(data.vehicleId),
    vehicleTitle: stringValue(data.vehicleTitle),
    vehicleReference: stringValue(data.vehicleReference) || undefined,
    askingPriceAtSubmission: numberValue(data.askingPriceAtSubmission),
    dealershipName: stringValue(data.dealershipName),
    contactName: stringValue(data.contactName),
    contactPhone: stringValue(data.contactPhone),
    normalizedContactPhone: stringValue(data.normalizedContactPhone),
    contactEmail: stringValue(data.contactEmail) || undefined,
    normalizedContactEmail: stringValue(data.normalizedContactEmail) || undefined,
    offerAmount: numberValue(data.offerAmount),
    preferredInspectionDate: stringValue(data.preferredInspectionDate) || undefined,
    comments: stringValue(data.comments) || undefined,
    status: isDealerOfferStatus(data.status) ? data.status : "new",
    createdAt: serializeDate(data.createdAt) || undefined,
    updatedAt: serializeDate(data.updatedAt) || undefined
  };
}

function getRequestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const firstForwardedIp = forwarded.split(",")[0]?.trim();
  return firstForwardedIp || request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function verifyTurnstileToken(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ?? "";
  const siteKeyConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
  if (!secret) {
    if (siteKeyConfigured) {
      throw new DealerOfferRouteError("SERVER_CONFIGURATION", "Security verification failed. Please refresh and try again.", 503);
    }
    return;
  }
  if (!token.trim()) throw new DealerOfferRouteError("TURNSTILE_REQUIRED", "Please complete the security check before submitting.", 400);

  const body = new URLSearchParams({ secret, response: token.trim() });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new DealerOfferRouteError("TURNSTILE_FAILED", "Security verification failed. Please refresh and try again.", 502);
  }
  const result = await response.json() as { success?: boolean };
  if (!result.success) throw new DealerOfferRouteError("TURNSTILE_REJECTED", "Please complete the security check before submitting.", 400);
}

function assertValidDealerOffer(input: DealerOfferInput) {
  const errors = getDealerOfferValidationErrors(input);
  if (Object.keys(errors).length) {
    throw new DealerOfferRouteError("INVALID_INPUT", Object.values(errors)[0] ?? "Unable to submit this offer.", 400);
  }
  return normalizeDealerOfferInput(input);
}

export async function submitDealerOffer({
  input,
  request,
  turnstileToken,
  honeypot = ""
}: {
  input: DealerOfferInput;
  request: NextRequest;
  turnstileToken: string;
  honeypot?: string;
}) {
  if (honeypot.trim()) {
    throw new DealerOfferRouteError("INVALID_INPUT", "Unable to submit this dealer offer.", 400);
  }
  const value = assertValidDealerOffer(input);
  const vehicle = await getAdminVehicleById(value.vehicleId);
  if (!vehicle || vehicle.deleted || vehicle.status !== "approved" || vehicle.sellerStatus !== "ACTIVE") {
    throw new DealerOfferRouteError("LISTING_UNAVAILABLE", "This vehicle is no longer available for offers.", 404);
  }

  const ip = getRequestIp(request);
  await verifyTurnstileToken(turnstileToken, ip);

  const db = getAdminDb();
  const idempotencyHash = hash(`${vehicle.id}:${value.idempotencyKey}`);
  const offerRef = db.collection("dealerOffers").doc(`dealer_${idempotencyHash}`);
  const duplicateHash = hash([
    vehicle.id,
    value.dealershipName.toLowerCase(),
    value.normalizedPhone,
    value.offerAmount.toFixed(2),
    value.comments.toLowerCase()
  ].join("|"));
  const duplicateRef = db.collection("dealerOfferSubmissionKeys").doc(duplicateHash);
  const day = new Date().toISOString().slice(0, 10);
  const rateLimitRefs = [
    { scope: "ip", hash: hash(ip), limit: DEALER_OFFER_RATE_LIMITS.ip },
    { scope: "phone", hash: hash(value.normalizedPhone), limit: DEALER_OFFER_RATE_LIMITS.phone },
    ...(value.normalizedEmail ? [{ scope: "email", hash: hash(value.normalizedEmail), limit: DEALER_OFFER_RATE_LIMITS.email }] : [])
  ].map((entry) => ({
    ...entry,
    ref: db.collection("dealerOfferRateLimits").doc(`${day}_${entry.scope}_${entry.hash}`)
  }));

  const result = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(offerRef);
    if (existing.exists) return { offerId: offerRef.id, duplicate: true };

    const duplicate = await transaction.get(duplicateRef);
    const duplicateData = duplicate.data() ?? {};
    const duplicateExpiresAt = duplicateData.expiresAt instanceof Timestamp ? duplicateData.expiresAt.toMillis() : 0;
    if (duplicate.exists && duplicateExpiresAt > Date.now() && typeof duplicateData.offerId === "string") {
      return { offerId: duplicateData.offerId, duplicate: true };
    }

    const rateLimitSnapshots = await Promise.all(rateLimitRefs.map(({ ref }) => transaction.get(ref)));
    for (let index = 0; index < rateLimitSnapshots.length; index += 1) {
      const count = numberValue(rateLimitSnapshots[index].data()?.count);
      if (count >= rateLimitRefs[index].limit) {
        throw new DealerOfferRouteError("RATE_LIMITED", "Too many requests. Please try again later.", 429);
      }
    }

    const now = Timestamp.now();
    transaction.set(offerRef, {
      vehicleId: vehicle.id,
      vehicleTitle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant}`.replace(/\s+/g, " ").trim(),
      vehicleReference: getVehicleDisplayReference(vehicle),
      askingPriceAtSubmission: vehicle.price,
      dealershipName: value.dealershipName,
      contactName: value.contactName,
      contactPhone: value.phone,
      normalizedContactPhone: value.normalizedPhone,
      ...(value.email ? { contactEmail: value.email, normalizedContactEmail: value.normalizedEmail } : {}),
      offerAmount: value.offerAmount,
      ...(value.preferredInspectionDate ? { preferredInspectionDate: value.preferredInspectionDate } : {}),
      ...(value.comments ? { comments: value.comments } : {}),
      status: "new" satisfies DealerOfferStatus,
      submissionIpHash: hash(ip),
      idempotencyKeyHash: idempotencyHash,
      createdAt: now,
      updatedAt: now
    });
    transaction.set(duplicateRef, {
      offerId: offerRef.id,
      expiresAt: Timestamp.fromMillis(now.toMillis() + DUPLICATE_WINDOW_MS),
      updatedAt: now
    });
    rateLimitRefs.forEach(({ ref }) => {
      transaction.set(ref, { count: FieldValue.increment(1), updatedAt: now }, { merge: true });
    });

    return { offerId: offerRef.id, duplicate: false };
  });

  return result;
}

export async function getDealerOffersForAdmin() {
  const snapshot = await getAdminDb().collection("dealerOffers").orderBy("createdAt", "desc").get();
  return snapshot.docs.map((item) => serializeDealerOffer(item.id, item.data() ?? {}));
}

export async function updateDealerOfferStatus({
  id,
  status,
  actorUid
}: {
  id: string;
  status: DealerOfferStatus;
  actorUid: string;
}) {
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(id) || !isDealerOfferStatus(status)) {
    throw new DealerOfferRouteError("INVALID_INPUT", "Unable to update this dealer offer.", 400);
  }

  const ref = getAdminDb().collection("dealerOffers").doc(id);
  await getAdminDb().runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (!existing.exists) throw new DealerOfferRouteError("NOT_FOUND", "Dealer offer not found.", 404);
    transaction.update(ref, { status, reviewedByUid: actorUid, updatedAt: FieldValue.serverTimestamp() });
  });
  const updated = await ref.get();
  return serializeDealerOffer(updated.id, updated.data() ?? {});
}

export function isValidDealerOfferIdempotencyKey(value: string) {
  return DEALER_OFFER_IDEMPOTENCY_KEY_PATTERN.test(value);
}
