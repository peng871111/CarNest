"use client";

export type AdminGrossDisplayMode = "gst_inclusive" | "no_gst";
export type AdminPaymentMethod = "bank_transfer" | "cash";

export type AdminGrossAmountDraft = {
  grossInclusiveAmount: number;
  displayMode: AdminGrossDisplayMode;
  paymentMethod: AdminPaymentMethod;
};

export const ADMIN_GROSS_AMOUNT_STORAGE_KEY = "carnest-admin-gross-amounts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readAdminGrossAmountDrafts(): Record<string, AdminGrossAmountDraft> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(ADMIN_GROSS_AMOUNT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([vehicleId, value]) => {
        if (!isRecord(value)) return [];
        const grossInclusiveAmount = Number(value.grossInclusiveAmount);
        const displayMode = value.displayMode === "no_gst" ? "no_gst" : "gst_inclusive";
        const paymentMethod = value.paymentMethod === "cash" ? "cash" : "bank_transfer";

        if (!Number.isFinite(grossInclusiveAmount) || grossInclusiveAmount < 0) return [];
        return [[vehicleId, { grossInclusiveAmount, displayMode, paymentMethod } satisfies AdminGrossAmountDraft]];
      })
    );
  } catch {
    return {};
  }
}

export function writeAdminGrossAmountDrafts(drafts: Record<string, AdminGrossAmountDraft>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_GROSS_AMOUNT_STORAGE_KEY, JSON.stringify(drafts));
}
