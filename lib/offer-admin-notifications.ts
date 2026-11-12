import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin-server";
import {
  sendAdminDealerOfferNotificationEmail,
  sendAdminPrivateOfferNotificationEmail
} from "@/lib/public-vehicle-action-email";

type OfferNotificationKind = "private" | "dealer";
type OfferNotificationCollection = "offers" | "dealerOffers";
type NotificationStatus = "pending" | "sending" | "sent" | "failed";

const NOTIFICATION_LEASE_MS = 5 * 60 * 1000;

function collectionFor(kind: OfferNotificationKind): OfferNotificationCollection {
  return kind === "private" ? "offers" : "dealerOffers";
}

function stringValue(data: Record<string, unknown>, field: string) {
  return typeof data[field] === "string" ? data[field] : "";
}

function numberValue(data: Record<string, unknown>, field: string) {
  const value = data[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function timestampValue(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  return null;
}

function notificationStatus(value: unknown): NotificationStatus {
  return value === "sending" || value === "sent" || value === "failed" ? value : "pending";
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message.slice(0, 500) : "Offer notification failed.";
}

export type AdminOfferNotificationResult = {
  attempted: boolean;
  sent: boolean;
  skipped?: "already_sent" | "in_progress" | "not_found";
  providerMessageId?: string | null;
};

export async function deliverAdminOfferNotification(input: {
  kind: OfferNotificationKind;
  offerId: string;
}): Promise<AdminOfferNotificationResult> {
  const collection = collectionFor(input.kind);
  const db = getAdminDb();
  const ref = db.collection(collection).doc(input.offerId);
  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { data: null, skipped: "not_found" as const };

    const data = snapshot.data() ?? {};
    const status = notificationStatus(data.adminNotificationStatus);
    const lastAttemptAt = timestampValue(data.adminNotificationLastAttemptAt)?.getTime() ?? 0;
    if (status === "sent") return { data: null, skipped: "already_sent" as const };
    if (status === "sending" && lastAttemptAt > Date.now() - NOTIFICATION_LEASE_MS) {
      return { data: null, skipped: "in_progress" as const };
    }

    const now = Timestamp.now();
    transaction.set(ref, {
      adminNotificationStatus: "sending",
      adminNotificationAttemptCount: FieldValue.increment(1),
      adminNotificationLastAttemptAt: now,
      adminNotificationError: null
    }, { merge: true });
    return { data, skipped: null };
  });

  if (!claimed.data) {
    return {
      attempted: false,
      sent: claimed.skipped === "already_sent",
      skipped: claimed.skipped ?? "not_found"
    };
  }

  try {
    const submittedAt = timestampValue(claimed.data.createdAt) ?? new Date();
    const result = input.kind === "private"
      ? await sendAdminPrivateOfferNotificationEmail({
          vehicleTitle: stringValue(claimed.data, "vehicleTitle"),
          vehicleReference: stringValue(claimed.data, "vehicleReference") || stringValue(claimed.data, "vehicleId"),
          askingPrice: numberValue(claimed.data, "askingPriceAtSubmission") || numberValue(claimed.data, "vehiclePrice"),
          buyerName: stringValue(claimed.data, "buyerName"),
          buyerEmail: stringValue(claimed.data, "buyerEmail"),
          buyerPhone: stringValue(claimed.data, "buyerPhone"),
          offerAmount: numberValue(claimed.data, "offerAmount") || numberValue(claimed.data, "amount"),
          message: stringValue(claimed.data, "message") || undefined,
          offerPercentage: numberValue(claimed.data, "offerPercentage")
            || ((numberValue(claimed.data, "askingPriceAtSubmission") || numberValue(claimed.data, "vehiclePrice")) > 0
              ? ((numberValue(claimed.data, "offerAmount") || numberValue(claimed.data, "amount"))
                / (numberValue(claimed.data, "askingPriceAtSubmission") || numberValue(claimed.data, "vehiclePrice"))) * 100
              : 0),
          buyerAccess: claimed.data.source === "guest" ? "guest" : "registered",
          verificationMethodLabel: claimed.data.verificationMethod === "email_otp"
            ? "Verified by email OTP"
            : "Verified account email",
          submittedAt,
          status: stringValue(claimed.data, "status") || "pending"
        })
      : await sendAdminDealerOfferNotificationEmail({
          vehicleTitle: stringValue(claimed.data, "vehicleTitle"),
          vehicleReference: stringValue(claimed.data, "vehicleReference") || stringValue(claimed.data, "vehicleId"),
          askingPrice: numberValue(claimed.data, "askingPriceAtSubmission"),
          dealershipName: stringValue(claimed.data, "dealershipName"),
          contactName: stringValue(claimed.data, "contactName"),
          contactEmail: stringValue(claimed.data, "contactEmail") || undefined,
          contactPhone: stringValue(claimed.data, "contactPhone"),
          offerAmount: numberValue(claimed.data, "offerAmount"),
          preferredInspectionDate: stringValue(claimed.data, "preferredInspectionDate") || undefined,
          comments: stringValue(claimed.data, "comments") || undefined,
          submittedAt,
          status: stringValue(claimed.data, "status") || "new"
        });

    await ref.set({
      adminNotificationStatus: "sent",
      adminNotificationProviderMessageId: result.providerMessageId ?? null,
      adminNotificationSentAt: Timestamp.now(),
      adminNotificationError: null
    }, { merge: true });

    return {
      attempted: true,
      sent: true,
      providerMessageId: result.providerMessageId ?? null
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error("[offer-admin-notifications] Delivery failed.", {
      kind: input.kind,
      offerId: input.offerId,
      error: message
    });
    try {
      await ref.set({
        adminNotificationStatus: "failed",
        adminNotificationProviderMessageId: null,
        adminNotificationFailedAt: Timestamp.now(),
        adminNotificationError: message
      }, { merge: true });
    } catch (stateError) {
      console.error("[offer-admin-notifications] Failed to record delivery state.", {
        kind: input.kind,
        offerId: input.offerId,
        error: safeErrorMessage(stateError)
      });
    }

    return { attempted: true, sent: false };
  }
}
