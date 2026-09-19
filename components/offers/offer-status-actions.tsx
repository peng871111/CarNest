"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { updateOfferStatus } from "@/lib/data";
import { Offer, OfferStatus } from "@/types";

const OFFER_STATUS_OPTIONS: OfferStatus[] = [
  "pending",
  "countered",
  "accepted",
  "declined",
  "accepted_pending_buyer_confirmation",
  "buyer_confirmed",
  "buyer_declined",
  "rejected"
];

export function OfferStatusActions({
  offer,
  basePath,
  onUpdated
}: {
  offer: Offer;
  basePath: "/admin/offers" | "/seller/offers";
  onUpdated?: (offer: Offer) => void;
}) {
  const router = useRouter();
  const { appUser, firebaseUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OfferStatus>(offer.status);
  const [counterAmount, setCounterAmount] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);

  useEffect(() => {
    setStatus(offer.status);
    setCounterAmount("");
    setMessage(null);
  }, [offer.id, offer.status]);

  async function handleSave(nextStatus = status) {
    if (!appUser) return;
    setBusy(true);

    try {
      const result = await updateOfferStatus(offer.id, nextStatus, appUser, offer);
      router.replace(
        `${basePath}?write=${result.writeSucceeded ? "success" : "mock"}&status=${nextStatus}&offerId=${offer.id}`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminSave() {
    if (busy) return;
    if (!firebaseUser) {
      setMessage({ type: "error", text: "Please sign in again before saving this offer." });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const idToken = await firebaseUser.getIdToken(true);
      const trimmedCounterAmount = counterAmount.trim();
      const updateResponse = await fetch(`/api/admin/offers/${encodeURIComponent(offer.id)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          status,
          ...(trimmedCounterAmount ? { counterAmount: Number(trimmedCounterAmount) } : {})
        })
      });

      const payload = await updateResponse.json().catch(() => ({} as { error?: string; offer?: Offer }));
      if (!updateResponse.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to save offer.");
      }
      if (!payload.offer) {
        throw new Error("Offer saved, but the updated offer was not returned.");
      }

      onUpdated?.(payload.offer);
      setStatus(payload.offer.status);
      setCounterAmount("");
      setMessage({ type: "success", text: trimmedCounterAmount ? "Counter offer saved." : "Offer saved." });
      router.replace(
        `${basePath}?write=success&status=${payload.offer.status}&offerId=${offer.id}`
      );
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to save offer."
      });
    } finally {
      setBusy(false);
    }
  }

  if (basePath === "/seller/offers") {
    if (offer.status !== "pending") {
      return <p className="text-sm text-ink/55">Response sent</p>;
    }

    return (
      <>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAcceptConfirm(true)}
            disabled={busy}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && (status === "accepted_pending_buyer_confirmation" || status === "accepted") ? "Saving..." : "Accept"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus("declined");
              void handleSave("declined");
            }}
            disabled={busy}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && (status === "rejected" || status === "declined") ? "Saving..." : "Reject"}
          </button>
        </div>
        {showAcceptConfirm ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-6" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-[28px] bg-white p-7 shadow-panel">
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Confirm acceptance</p>
              <h3 className="mt-3 text-2xl font-semibold text-ink">Accept this offer?</h3>
              <p className="mt-3 text-sm leading-6 text-ink/70">
                Accepting this offer will notify the buyer and reveal the seller contact details for this negotiation.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("accepted");
                    setShowAcceptConfirm(false);
                    void handleSave("accepted");
                  }}
                  disabled={busy}
                  className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirm Accept
                </button>
                <button
                  type="button"
                  onClick={() => setShowAcceptConfirm(false)}
                  disabled={busy}
                  className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  const counterAmountChanged = counterAmount.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as OfferStatus)}
          disabled={busy}
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink"
        >
          {OFFER_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleAdminSave()}
          disabled={busy || (status === offer.status && !counterAmountChanged)}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Counter price</span>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          value={counterAmount}
          onChange={(event) => setCounterAmount(event.target.value)}
          disabled={busy}
          placeholder={String(offer.offerAmount ?? offer.amount)}
          className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink"
        />
      </label>
      {message ? (
        <p
          className={`text-sm ${message.type === "error" ? "text-red-700" : "text-emerald-700"}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
