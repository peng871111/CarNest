"use client";

import { useEffect, useState } from "react";
import { DealerTermsGate } from "@/components/dealer/dealer-terms-gate";
import { useAuth } from "@/lib/auth";
import { getSellerInspectionRequestsData, getSellerOffersData } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { InspectionRequest, Offer } from "@/types";

export function DealerLeadsPanel() {
  const { appUser, loading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [inspections, setInspections] = useState<InspectionRequest[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadLeads() {
      if (!appUser?.id) return;
      const [offersResult, inspectionsResult] = await Promise.all([
        getSellerOffersData(appUser.id),
        getSellerInspectionRequestsData(appUser.id)
      ]);
      if (!cancelled) {
        setOffers(offersResult.items);
        setInspections(inspectionsResult.items);
      }
    }

    void loadLeads();

    return () => {
      cancelled = true;
    };
  }, [appUser?.id]);

  if (loading) {
    return <p className="text-sm text-ink/60">Loading dealer leads...</p>;
  }

  return (
    <DealerTermsGate>
      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer leads</p>
        <h1 className="mt-4 font-display text-4xl text-ink">Leads</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
          Track buyer offer and inspection activity across your dealer inventory.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Offer enquiries</p>
            <p className="mt-2 font-display text-3xl text-ink">{offers.length}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Inspection requests</p>
            <p className="mt-2 font-display text-3xl text-ink">{inspections.length}</p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {offers.length ? offers.slice(0, 8).map((offer) => (
            <div key={offer.id} className="rounded-[24px] border border-black/5 bg-shell px-5 py-4 text-sm text-ink/70">
              <p className="font-semibold text-ink">{offer.vehicleTitle}</p>
              <p className="mt-1">{offer.buyerName} · {formatCurrency(offer.amount)} · {offer.status.replaceAll("_", " ")}</p>
            </div>
          )) : (
            <p className="rounded-[24px] border border-dashed border-black/10 bg-shell px-5 py-8 text-sm text-ink/60">
              No dealer leads yet.
            </p>
          )}
        </div>
      </section>
    </DealerTermsGate>
  );
}
