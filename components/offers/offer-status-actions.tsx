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

export function OfferStatusActions({ offer, basePath }: { offer: Offer; basePath: "/admin/offers" | "/seller/offers" }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OfferStatus>(offer.status);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);

  useEffect(() => {
    setStatus(offer.status);
  }, [offer.status]);

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

  return (
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
        onClick={() => void handleSave()}
        disabled={busy || status === offer.status}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
