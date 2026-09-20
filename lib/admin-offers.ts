import type { Offer, OfferContactUnlockSource, OfferContactVisibilityState, OfferMessageSender, OfferStatus, OfferThreadEntry } from "@/types";

type OfferDocumentData = Record<string, unknown>;

export interface AdminOfferUpdateInput {
  status: OfferStatus;
  counterAmount?: number;
}

export interface AdminOfferUpdatePlan {
  status: OfferStatus;
  amount?: number;
  offerAmount?: number;
  appendMessage?: OfferThreadEntry;
  buyerViewed: boolean;
  sellerViewed: boolean;
  contactUnlocked: boolean;
  contactUnlockedAt?: string | null;
  contactUnlockedBy?: OfferContactUnlockSource | null;
  contactVisibilityState: OfferContactVisibilityState;
  lastUpdatedBy?: OfferMessageSender;
  respondedAt?: string | null;
  shouldTouchRespondedAt: boolean;
  emailEvent?: "seller_countered_offer" | "seller_accepted_offer";
  counterOfferUnchanged?: boolean;
}

export type AdminOfferEmailFailureReason =
  | "missing_buyer_email"
  | "missing_env"
  | "resend_error"
  | "email_not_sent";

export type AdminOfferEmailStatus =
  | { attempted: false; sent: false }
  | { attempted: true; sent: true; recipientEmail: string }
  | { attempted: true; sent: false; recipientEmail?: string; reason: AdminOfferEmailFailureReason };

export interface AdminOfferBuyerEmailRecipient {
  email: string;
  buyerAccess: "guest" | "registered";
}

export const ADMIN_OFFER_STATUSES = [
  "pending",
  "countered",
  "accepted",
  "declined",
  "accepted_pending_buyer_confirmation",
  "buyer_confirmed",
  "buyer_declined",
  "rejected"
] as const satisfies readonly OfferStatus[];

export async function resolveAdminOfferBuyerEmailRecipient(
  offer: Pick<Offer, "source" | "buyerEmail" | "buyerUid">,
  getProfileEmail: (buyerUid: string) => Promise<string>
): Promise<AdminOfferBuyerEmailRecipient> {
  if (offer.source === "guest") {
    return {
      email: offer.buyerEmail.trim().toLowerCase(),
      buyerAccess: "guest"
    };
  }

  const fallbackEmail = offer.buyerEmail.trim().toLowerCase();
  if (offer.buyerUid) {
    const email = (await getProfileEmail(offer.buyerUid)).trim().toLowerCase();
    if (email) {
      return {
        email,
        buyerAccess: "registered"
      };
    }
  }

  return {
    email: fallbackEmail,
    buyerAccess: "registered"
  };
}

export function getAdminOfferEmailFailureReason(reason?: string): AdminOfferEmailFailureReason {
  if (reason === "missing_env") return "missing_env";
  if (reason === "resend_error" || reason === "provider_error") return "resend_error";
  if (reason === "missing_buyer_email") return "missing_buyer_email";
  return "email_not_sent";
}

export function buildAdminOfferEmailStatusFromSendResult(
  recipientEmail: string,
  result: { sent: boolean; reason?: string }
): AdminOfferEmailStatus {
  return result.sent
    ? { attempted: true, sent: true, recipientEmail }
    : {
        attempted: true,
        sent: false,
        recipientEmail,
        reason: getAdminOfferEmailFailureReason(result.reason)
      };
}

export function getAdminOfferSaveMessage(isCounterOfferSave: boolean, emailStatus?: AdminOfferEmailStatus) {
  if (!isCounterOfferSave) return "Offer saved.";

  if (emailStatus?.attempted && emailStatus.sent) {
    return "Counteroffer saved and emailed to buyer.";
  }

  if (emailStatus?.attempted) {
    return "Counteroffer saved, but buyer email could not be sent.";
  }

  return "Counteroffer unchanged.";
}

export function getAdminOfferEmailQueryValue(
  isCounterOfferSave: boolean,
  emailStatus?: AdminOfferEmailStatus
) {
  if (!isCounterOfferSave) return "none";
  if (emailStatus?.attempted && emailStatus.sent) return "sent";
  if (emailStatus?.attempted) return "failed";
  return "unchanged";
}

export function getAdminOfferSaveMessageFromQuery(status: string | null, email: string | null) {
  if (status === "countered") {
    if (email === "sent") return "Counteroffer saved and emailed to buyer.";
    if (email === "failed") return "Counteroffer saved, but buyer email could not be sent.";
    if (email === "unchanged") return "Counteroffer unchanged.";
    return "Counteroffer saved";
  }

  if (status === "accepted") return "Offer accepted";
  if (status === "declined") return "Offer declined";
  if (status === "accepted_pending_buyer_confirmation") return "Offer accepted and vehicle moved under offer";
  if (status === "rejected") return "Offer rejected";
  if (status === "buyer_confirmed") return "Buyer confirmed the accepted offer";
  if (status === "buyer_declined") return "Buyer declined the accepted offer";
  return "Offer updated";
}

function serializeAdminOfferDate(value: unknown) {
  try {
    if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      const date = value.toDate();
      return date
        && typeof date === "object"
        && "getTime" in date
        && typeof date.getTime === "function"
        && "toISOString" in date
        && typeof date.toISOString === "function"
        && Number.isFinite(date.getTime())
        ? date.toISOString()
        : undefined;
    }
  } catch {
    return undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function readString(data: OfferDocumentData, field: string, fallback = "") {
  const value = data[field];
  return typeof value === "string" ? value : fallback;
}

function readNumber(data: OfferDocumentData, field: string, fallback = 0) {
  const value = data[field];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeAdminOfferStatus(value: unknown): OfferStatus {
  return typeof value === "string" && ADMIN_OFFER_STATUSES.includes(value as OfferStatus)
    ? value as OfferStatus
    : "pending";
}

function normalizeContactVisibilityState(value: unknown, contactUnlocked: boolean): OfferContactVisibilityState {
  if (value === "shared_after_accept" || value === "shared_after_counter_accept" || value === "hidden") {
    return value;
  }

  return contactUnlocked ? "shared_after_accept" : "hidden";
}

function normalizeContactUnlockSource(value: unknown): OfferContactUnlockSource | null {
  if (
    value === "buyer_confirm"
    || value === "seller_manual"
    || value === "seller_accept"
    || value === "buyer_counter_accept"
  ) {
    return value;
  }

  return null;
}

function normalizeMessageSender(value: unknown): OfferMessageSender | null {
  return value === "buyer" || value === "seller" ? value : null;
}

function serializeOfferMessages(value: unknown): OfferThreadEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const data = entry as Record<string, unknown>;
    const sender = normalizeMessageSender(data.sender);
    if (!sender) return [];

    const type = data.type === "offer_update" ? "offer_update" : "message";
    const text = typeof data.text === "string" ? data.text : "";
    const amount = typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : undefined;

    if (type === "message" && !text) return [];
    if (type === "offer_update" && typeof amount !== "number") return [];

    return [{
      type,
      sender,
      ...(text ? { text } : {}),
      ...(typeof amount === "number" ? { amount } : {}),
      createdAt: serializeAdminOfferDate(data.createdAt)
    } satisfies OfferThreadEntry];
  }).sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""));
}

export function serializeAdminOfferDoc(id: string, data: OfferDocumentData): Offer {
  const contactUnlocked = data.contactUnlocked === true;
  const amount = readNumber(data, "amount", readNumber(data, "offerAmount"));
  const buyerUid =
    readString(data, "buyerUid")
    || readString(data, "userId")
    || readString(data, "submittedByUid");
  const listingOwnerUid =
    readString(data, "listingOwnerUid")
    || readString(data, "sellerOwnerUid");
  const messages = serializeOfferMessages(data.messages);

  if (!messages.some((entry) => entry.type === "offer_update") && amount > 0) {
    messages.unshift({
      type: "offer_update",
      sender: "buyer",
      amount,
      createdAt: serializeAdminOfferDate(data.createdAt)
    });
  }

  return {
    id,
    buyerUid,
    listingOwnerUid,
    vehicleId: readString(data, "vehicleId"),
    vehicleTitle: readString(data, "vehicleTitle"),
    vehicleReference: readString(data, "vehicleReference") || undefined,
    vehiclePrice: readNumber(data, "vehiclePrice"),
    askingPriceAtSubmission: readNumber(data, "askingPriceAtSubmission") || undefined,
    buyerName: readString(data, "buyerName"),
    buyerEmail: readString(data, "buyerEmail"),
    buyerPhone: readString(data, "buyerPhone"),
    normalizedBuyerEmail: readString(data, "normalizedBuyerEmail") || undefined,
    normalizedBuyerPhone: readString(data, "normalizedBuyerPhone") || undefined,
    amount,
    offerPercentage: readNumber(data, "offerPercentage") || undefined,
    message: readString(data, "message"),
    messages,
    buyerViewed: data.buyerViewed === true,
    sellerViewed: data.sellerViewed === true,
    contactUnlocked,
    contactUnlockedAt: serializeAdminOfferDate(data.contactUnlockedAt) ?? null,
    contactUnlockedBy: normalizeContactUnlockSource(data.contactUnlockedBy),
    contactVisibilityState: normalizeContactVisibilityState(data.contactVisibilityState, contactUnlocked),
    lastUpdatedBy: normalizeMessageSender(data.lastUpdatedBy) ?? undefined,
    submittedByUid: readString(data, "submittedByUid") || undefined,
    status: normalizeAdminOfferStatus(data.status),
    createdAt: serializeAdminOfferDate(data.createdAt),
    updatedAt: serializeAdminOfferDate(data.updatedAt),
    respondedAt: serializeAdminOfferDate(data.respondedAt) ?? null,
    userId: readString(data, "userId") || undefined,
    offerAmount: readNumber(data, "offerAmount") || undefined,
    sellerOwnerUid: readString(data, "sellerOwnerUid") || undefined,
    source: data.source === "guest" || data.source === "authenticated" ? data.source : undefined,
    emailVerified: typeof data.emailVerified === "boolean" ? data.emailVerified : undefined,
    verificationMethod: data.verificationMethod === "email_otp" || data.verificationMethod === "account_email" ? data.verificationMethod : undefined,
    idempotencyKey: readString(data, "idempotencyKey") || undefined,
    submissionIpHash: readString(data, "submissionIpHash") || undefined
  };
}

export function sanitizeAdminOfferUpdateInput(value: unknown): AdminOfferUpdateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid offer update.");
  }

  const data = value as OfferDocumentData;
  if (typeof data.status !== "string" || !ADMIN_OFFER_STATUSES.includes(data.status as OfferStatus)) {
    throw new Error("Select a valid offer status.");
  }

  const rawCounterAmount = data.counterAmount;
  const counterAmount =
    typeof rawCounterAmount === "number"
      ? rawCounterAmount
      : typeof rawCounterAmount === "string" && rawCounterAmount.trim()
        ? Number(rawCounterAmount)
        : undefined;

  if (typeof counterAmount === "number" && (!Number.isFinite(counterAmount) || counterAmount <= 0)) {
    throw new Error("Counter offer amount must be greater than zero.");
  }

  return {
    status: data.status as OfferStatus,
    ...(typeof counterAmount === "number" ? { counterAmount: Math.round(counterAmount) } : {})
  };
}

export function buildAdminOfferUpdatePlan(input: AdminOfferUpdateInput, offer: Offer, nowIso = new Date().toISOString()): AdminOfferUpdatePlan {
  const contactVisibilityState = offer.contactVisibilityState ?? (offer.contactUnlocked ? "shared_after_accept" : "hidden");

  if (typeof input.counterAmount === "number") {
    const minimumOffer = Math.max(1000, Math.round(offer.vehiclePrice * 0.5));
    if (input.counterAmount < minimumOffer) {
      throw new Error("Please enter a realistic offer amount.");
    }

    const currentCounterAmount = offer.offerAmount ?? offer.amount;
    const counterAmountChanged = input.counterAmount !== currentCounterAmount;
    const statusChangedToCountered = offer.status !== "countered";
    const shouldSendCounterEmail = statusChangedToCountered || counterAmountChanged;

    return {
      status: "countered",
      ...(counterAmountChanged ? {
        amount: input.counterAmount,
        offerAmount: input.counterAmount
      } : {}),
      ...(shouldSendCounterEmail ? { appendMessage: {
        type: "offer_update",
        sender: "seller",
        amount: input.counterAmount,
        createdAt: nowIso
      } } : {}),
      buyerViewed: shouldSendCounterEmail ? false : offer.buyerViewed,
      sellerViewed: true,
      contactUnlocked: false,
      contactUnlockedAt: null,
      contactUnlockedBy: null,
      contactVisibilityState: "hidden",
      lastUpdatedBy: shouldSendCounterEmail ? "seller" : offer.lastUpdatedBy,
      respondedAt: shouldSendCounterEmail ? nowIso : offer.respondedAt ?? null,
      shouldTouchRespondedAt: shouldSendCounterEmail,
      ...(shouldSendCounterEmail ? { emailEvent: "seller_countered_offer" as const } : {}),
      counterOfferUnchanged: !shouldSendCounterEmail
    };
  }

  const basePlan: AdminOfferUpdatePlan = {
    status: input.status,
    buyerViewed: offer.buyerViewed,
    sellerViewed: offer.sellerViewed,
    contactUnlocked: offer.contactUnlocked,
    contactUnlockedAt: offer.contactUnlockedAt ?? null,
    contactUnlockedBy: offer.contactUnlockedBy ?? null,
    contactVisibilityState,
    lastUpdatedBy: offer.lastUpdatedBy,
    respondedAt: offer.respondedAt ?? null,
    shouldTouchRespondedAt: false
  };

  if (input.status === "accepted") {
    return {
      ...basePlan,
      buyerViewed: false,
      sellerViewed: true,
      contactUnlocked: true,
      contactUnlockedAt: nowIso,
      contactUnlockedBy: "seller_accept",
      contactVisibilityState: "shared_after_accept",
      lastUpdatedBy: "seller",
      respondedAt: nowIso,
      shouldTouchRespondedAt: true,
      emailEvent: "seller_accepted_offer"
    };
  }

  if (input.status === "declined" || input.status === "rejected") {
    return {
      ...basePlan,
      buyerViewed: false,
      sellerViewed: true,
      contactUnlocked: false,
      contactUnlockedAt: null,
      contactUnlockedBy: null,
      contactVisibilityState: "hidden",
      lastUpdatedBy: "seller",
      respondedAt: nowIso,
      shouldTouchRespondedAt: true
    };
  }

  if (input.status === "countered" || input.status === "accepted_pending_buyer_confirmation") {
    return {
      ...basePlan,
      buyerViewed: false,
      sellerViewed: true,
      lastUpdatedBy: "seller",
      respondedAt: nowIso,
      shouldTouchRespondedAt: true,
      ...(input.status === "countered" && offer.status !== "countered" ? { emailEvent: "seller_countered_offer" as const } : {})
    };
  }

  if (input.status === "buyer_confirmed") {
    return {
      ...basePlan,
      buyerViewed: true,
      sellerViewed: true,
      contactUnlocked: true,
      contactUnlockedAt: nowIso,
      contactUnlockedBy: "buyer_confirm",
      contactVisibilityState: "shared_after_accept",
      lastUpdatedBy: "buyer"
    };
  }

  if (input.status === "buyer_declined") {
    return {
      ...basePlan,
      buyerViewed: true,
      sellerViewed: true,
      contactUnlocked: false,
      contactUnlockedAt: null,
      contactUnlockedBy: null,
      contactVisibilityState: "hidden",
      lastUpdatedBy: "buyer"
    };
  }

  return input.status === "pending"
    ? {
        ...basePlan,
        contactUnlocked: false,
        contactUnlockedAt: null,
        contactUnlockedBy: null,
        contactVisibilityState: "hidden",
        respondedAt: null,
        shouldTouchRespondedAt: true
      }
    : basePlan;
}
