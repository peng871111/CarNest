"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { DEALER_OFFER_STATUS_OPTIONS } from "@/lib/dealer-offer-validation";
import { DealerOffer, DealerOfferStatus } from "@/types";

export function DealerOfferStatusActions({ offer, onUpdated }: { offer: DealerOffer; onUpdated: (offer: DealerOffer) => void }) {
  const { firebaseUser } = useAuth();
  const [status, setStatus] = useState<DealerOfferStatus>(offer.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(offer.status);
    setError("");
  }, [offer.id, offer.status]);

  async function save() {
    if (!firebaseUser || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/dealer-offers/${encodeURIComponent(offer.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${await firebaseUser.getIdToken(true)}` },
        body: JSON.stringify({ status })
      });
      const payload = await response.json().catch(() => ({} as { offer?: DealerOffer; error?: string }));
      if (!response.ok || !payload.offer) throw new Error(payload.error || "Unable to update dealer offer.");
      onUpdated(payload.offer);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update dealer offer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(event) => setStatus(event.target.value as DealerOfferStatus)} disabled={busy} className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink">
          {DEALER_OFFER_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <button type="button" onClick={() => void save()} disabled={busy || status === offer.status} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
