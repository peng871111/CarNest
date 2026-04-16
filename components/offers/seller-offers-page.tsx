"use client";

import { useEffect, useState } from "react";
import { SellerShell } from "@/components/layout/seller-shell";
import { OfferStatusActions } from "@/components/offers/offer-status-actions";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { useAuth } from "@/lib/auth";
import { getSellerOffersData } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Offer } from "@/types";

export function SellerOffersPageClient({
  initialWrite,
  initialStatus
}: {
  initialWrite?: string;
  initialStatus?: string;
}) {
  const { appUser, loading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      if (!appUser || appUser.role !== "seller") return;
      const result = await getSellerOffersData(appUser.id);
      if (cancelled) return;
      setOffers(result.items);
      setError(result.error ?? "");
    }

    void loadOffers();
    return () => {
      cancelled = true;
    };
  }, [appUser]);

  const writeStatus =
    initialWrite === "success"
      ? `Offer status updated to ${initialStatus?.replaceAll("_", " ") ?? "saved"}`
      : "";

  return (
    <SellerShell title="Offers" description="Review incoming offers only for vehicles you own and manage their current status.">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          {loading ? "Loading offers..." : `${offers.length} offer${offers.length === 1 ? "" : "s"} received`}
        </div>
        {writeStatus ? <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">{writeStatus}</div> : null}
      </div>
      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          We couldn't load your offers right now. Please try again shortly.
        </div>
      ) : null}
      <section className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1.4fr,1fr,1fr,1fr,280px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Vehicle</span>
          <span>Buyer</span>
          <span>Offer</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        <div>
          {offers.length ? (
            offers.map((offer) => (
              <div key={offer.id} className="grid grid-cols-[1.4fr,1fr,1fr,1fr,280px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0">
                <div>
                  <p className="font-semibold text-ink">{offer.vehicleTitle}</p>
                  <p className="mt-1 text-ink/55">Asking price: {formatCurrency(offer.vehiclePrice)}</p>
                </div>
                <div>
                  <p className="font-medium text-ink">{offer.buyerName}</p>
                  <p className="mt-1 text-ink/55">{offer.buyerEmail}</p>
                  <p className="mt-1 text-ink/55">{offer.buyerPhone}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink">{formatCurrency(offer.offerAmount)}</p>
                  <p className="mt-1 line-clamp-3 text-ink/55">{offer.message}</p>
                </div>
                <div>
                  <OfferStatusBadge status={offer.status} />
                </div>
                <div>
                  <OfferStatusActions offer={offer} basePath="/seller/offers" />
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              No offers yet.
            </div>
          )}
        </div>
      </section>
    </SellerShell>
  );
}
