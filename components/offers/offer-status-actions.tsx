"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { updateOfferStatus } from "@/lib/data";
import { Offer, OfferStatus } from "@/types";

const OFFER_STATUS_OPTIONS: OfferStatus[] = ["new", "under_review", "accepted", "declined", "withdrawn"];

export function OfferStatusActions({ offer, basePath }: { offer: Offer; basePath: "/admin/offers" | "/seller/offers" }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OfferStatus>(offer.status);

  useEffect(() => {
    setStatus(offer.status);
  }, [offer.status]);

  async function handleSave() {
    if (!appUser) return;
    setBusy(true);

    try {
      const result = await updateOfferStatus(offer.id, status, appUser, offer);
      router.replace(
        `${basePath}?write=${result.writeSucceeded ? "success" : "mock"}&status=${status}&offerId=${offer.id}`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
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
