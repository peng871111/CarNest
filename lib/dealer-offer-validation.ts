import {
  isReasonablyValidPhoneNumber,
  isValidEmailAddress,
  normalizeEmailAddress,
  normalizeIdempotencyKey,
  normalizePhoneNumber,
  sanitizePlainText,
  sanitizeSingleLineText
} from "@/lib/public-vehicle-action-validation";
import { DealerOfferStatus } from "@/types";

export const DEALER_OFFER_STATUS_OPTIONS: DealerOfferStatus[] = ["new", "reviewing", "closed"];
export const DEALER_OFFER_DEALERSHIP_MAX_LENGTH = 160;
export const DEALER_OFFER_CONTACT_NAME_MAX_LENGTH = 120;
export const DEALER_OFFER_EMAIL_MAX_LENGTH = 254;
export const DEALER_OFFER_PHONE_MAX_LENGTH = 32;
export const DEALER_OFFER_COMMENT_MAX_LENGTH = 1200;
export const DEALER_OFFER_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{12,120}$/;

export interface DealerOfferInput {
  vehicleId: string;
  dealershipName: string;
  contactName: string;
  phone: string;
  offerAmount: number;
  email?: string;
  preferredInspectionDate?: string;
  comments?: string;
  idempotencyKey: string;
}

export interface NormalizedDealerOfferInput extends Omit<DealerOfferInput, "email" | "preferredInspectionDate" | "comments"> {
  email: string;
  preferredInspectionDate: string;
  comments: string;
  normalizedPhone: string;
  normalizedEmail: string;
}

function isValidDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

export function normalizeDealerOfferInput(input: DealerOfferInput): NormalizedDealerOfferInput {
  return {
    vehicleId: sanitizeSingleLineText(input.vehicleId ?? "", 120),
    dealershipName: sanitizeSingleLineText(input.dealershipName ?? "", DEALER_OFFER_DEALERSHIP_MAX_LENGTH),
    contactName: sanitizeSingleLineText(input.contactName ?? "", DEALER_OFFER_CONTACT_NAME_MAX_LENGTH),
    phone: sanitizeSingleLineText(input.phone ?? "", DEALER_OFFER_PHONE_MAX_LENGTH),
    offerAmount: Number(input.offerAmount),
    email: sanitizeSingleLineText(input.email ?? "", DEALER_OFFER_EMAIL_MAX_LENGTH),
    preferredInspectionDate: sanitizeSingleLineText(input.preferredInspectionDate ?? "", 10),
    comments: sanitizePlainText(input.comments ?? "", DEALER_OFFER_COMMENT_MAX_LENGTH),
    idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey ?? ""),
    normalizedPhone: normalizePhoneNumber(input.phone ?? ""),
    normalizedEmail: normalizeEmailAddress(input.email ?? "")
  };
}

export function getDealerOfferValidationErrors(input: DealerOfferInput): Record<string, string> {
  const value = normalizeDealerOfferInput(input);
  const errors: Record<string, string> = {};

  if (!value.vehicleId) errors.vehicleId = "This vehicle is unavailable.";
  if (!value.dealershipName) errors.dealershipName = "Please enter the dealership name.";
  if (!value.contactName) errors.contactName = "Please enter the buyer or contact name.";
  if (!value.phone) errors.phone = "Please enter a phone number.";
  else if (!isReasonablyValidPhoneNumber(value.phone)) errors.phone = "Please enter a valid phone number.";
  if (!Number.isFinite(value.offerAmount) || value.offerAmount <= 0 || value.offerAmount > 100_000_000) {
    errors.offerAmount = "Please enter a valid offer amount.";
  }
  if (value.email && !isValidEmailAddress(value.email)) errors.email = "Please enter a valid email address.";
  if (value.preferredInspectionDate && !isValidDateOnly(value.preferredInspectionDate)) {
    errors.preferredInspectionDate = "Please choose a valid inspection date.";
  }
  if (!DEALER_OFFER_IDEMPOTENCY_KEY_PATTERN.test(value.idempotencyKey)) {
    errors.idempotencyKey = "Unable to submit this offer. Please refresh and try again.";
  }

  return errors;
}

export function isDealerOfferStatus(value: unknown): value is DealerOfferStatus {
  return typeof value === "string" && DEALER_OFFER_STATUS_OPTIONS.includes(value as DealerOfferStatus);
}
