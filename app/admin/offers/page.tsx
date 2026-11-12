"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { OfferStatusActions } from "@/components/offers/offer-status-actions";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { DealerOfferStatusActions } from "@/components/offers/dealer-offer-status-actions";
import { getAdminOfferSaveMessageFromQuery } from "@/lib/admin-offers";
import { useAuth } from "@/lib/auth";
import { canAccessRole } from "@/lib/permissions";
import { formatAdminDateTime, formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { DealerOffer, Offer } from "@/types";

export default function AdminOffersPage() {
  const searchParams = useSearchParams();
  const { appUser, firebaseUser, loading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dealerOffers, setDealerOffers] = useState<DealerOffer[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function handleOfferUpdated(updatedOffer: Offer) {
    setOffers((current) => current.map((offer) => (offer.id === updatedOffer.id ? updatedOffer : offer)));
  }

  function handleDealerOfferUpdated(updatedOffer: DealerOffer) {
    setDealerOffers((current) => current.map((offer) => (offer.id === updatedOffer.id ? updatedOffer : offer)));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      if (loading || !canAccessRole("admin", appUser?.role)) return;

      setIsLoading(true);
      setError("");

      try {
        if (!firebaseUser) throw new Error("Please sign in again before loading offers.");
        const idToken = await firebaseUser.getIdToken();
        const response = await fetch("/api/admin/offers", {
          headers: { authorization: `Bearer ${idToken}` },
          cache: "no-store"
        });
        const payload = await response.json().catch(() => ({} as { offers?: Offer[]; dealerOffers?: DealerOffer[]; error?: string }));
        if (!response.ok) throw new Error(payload.error || "Unable to load offers.");
        if (cancelled) return;

        setOffers(payload.offers ?? []);
        setDealerOffers(payload.dealerOffers ?? []);
      } catch (loadError) {
        if (cancelled) return;
        setOffers([]);
        setDealerOffers([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load offers.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadOffers();

    return () => {
      cancelled = true;
    };
  }, [appUser?.role, firebaseUser, loading]);

  const writeStatus = useMemo(() => {
    const write = searchParams.get("write");
    const status = searchParams.get("status");
    const email = searchParams.get("email");

    return write === "success"
      ? getAdminOfferSaveMessageFromQuery(status, email)
      : write === "mock"
        ? "Offer update recorded"
        : "No recent updates";
  }, [searchParams]);

  const offerRows = useMemo(() => [
    ...offers.map((offer) => ({ kind: "private" as const, offer, submittedAt: new Date(offer.createdAt ?? 0).getTime() || 0 })),
    ...dealerOffers.map((offer) => ({ kind: "dealer" as const, offer, submittedAt: new Date(offer.createdAt ?? 0).getTime() || 0 }))
  ].sort((left, right) => right.submittedAt - left.submittedAt), [dealerOffers, offers]);

  return (
    <AdminShell title="Offers" description="Review every incoming offer and update its progression across the marketplace.">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Offers loaded: {isLoading ? "Loading..." : offers.length + dealerOffers.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Recent activity: {writeStatus}
        </div>
      </div>
      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          {error}
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
          {offerRows.map((row) => {
            if (row.kind === "private") {
              const offer = row.offer;
              const vehicleReference = offer.vehicleReference || getVehicleDisplayReference(offer.vehicleId);
              const askingPrice = offer.askingPriceAtSubmission || offer.vehiclePrice;
              const offerAmount = offer.offerAmount ?? offer.amount;
              const offerPercentage = offer.offerPercentage || (askingPrice > 0 ? (offerAmount / askingPrice) * 100 : 0);
              const sourceLabel = offer.source === "guest" ? "Guest" : offer.source === "authenticated" ? "Registered user" : "Existing flow";
              const verificationLabel = offer.emailVerified ? "Email verified" : "Verification not recorded";

              return (
                <div key={`private-${offer.id}`} className="grid grid-cols-[1.4fr,1fr,1fr,1fr,280px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0">
                  <div>
                    <p className="font-semibold text-ink">{offer.vehicleTitle}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">Vehicle Ref: {vehicleReference}</p>
                    <p className="mt-1 text-ink/55">Asking price: {formatCurrency(askingPrice)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-ink">{offer.buyerName}</p>
                    <p className="mt-1 text-ink/55">{offer.buyerEmail}</p>
                    <p className="mt-1 text-ink/55">{offer.buyerPhone}</p>
                    <p className="mt-1 text-ink/55">Submitted {formatAdminDateTime(offer.createdAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">Private Offer</span>
                      <span className="rounded-full bg-shell px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/55">{sourceLabel}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${offer.emailVerified ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                        {verificationLabel}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{formatCurrency(offerAmount)}</p>
                    <p className="mt-1 text-ink/55">{offerPercentage ? `${offerPercentage.toFixed(1)}% of asking` : "Percentage not available"}</p>
                    <p className="mt-1 line-clamp-3 text-ink/55">{offer.message}</p>
                  </div>
                  <div><OfferStatusBadge status={offer.status} /></div>
                  <div><OfferStatusActions offer={offer} basePath="/admin/offers" onUpdated={handleOfferUpdated} /></div>
                </div>
              );
            }

            const offer = row.offer;
            const offerPercentage = offer.askingPriceAtSubmission > 0 ? (offer.offerAmount / offer.askingPriceAtSubmission) * 100 : 0;
            return (
              <div key={`dealer-${offer.id}`} className="grid grid-cols-[1.4fr,1fr,1fr,1fr,280px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0">
                <div>
                  <p className="font-semibold text-ink">{offer.vehicleTitle}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">Vehicle Ref: {offer.vehicleReference || getVehicleDisplayReference(offer.vehicleId)}</p>
                  <p className="mt-1 text-ink/55">Asking price: {formatCurrency(offer.askingPriceAtSubmission)}</p>
                </div>
                <div>
                  <p className="font-medium text-ink">{offer.dealershipName}</p>
                  <p className="mt-1 text-ink/55">{offer.contactName}</p>
                  <p className="mt-1 text-ink/55">{offer.contactPhone}</p>
                  {offer.contactEmail ? <p className="mt-1 text-ink/55">{offer.contactEmail}</p> : null}
                  {offer.preferredInspectionDate ? <p className="mt-1 text-ink/55">Preferred inspection: {offer.preferredInspectionDate}</p> : null}
                  <p className="mt-1 text-ink/55">Submitted {formatAdminDateTime(offer.createdAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">Dealer Offer</span></div>
                </div>
                <div>
                  <p className="font-semibold text-ink">{formatCurrency(offer.offerAmount)}</p>
                  <p className="mt-1 text-ink/55">{offerPercentage ? `${offerPercentage.toFixed(1)}% of asking` : "Percentage not available"}</p>
                  {offer.comments ? <p className="mt-1 line-clamp-3 text-ink/55">{offer.comments}</p> : null}
                </div>
                <div><span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">{offer.status}</span></div>
                <div><DealerOfferStatusActions offer={offer} onUpdated={handleDealerOfferUpdated} /></div>
              </div>
            );
          })}
          {!isLoading && !error && !offerRows.length ? <div className="px-6 py-12 text-sm text-ink/60">No offers yet.</div> : null}
        </div>
      </section>
    </AdminShell>
  );
}
