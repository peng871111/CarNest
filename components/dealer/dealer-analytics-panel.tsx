"use client";

import { useEffect, useState } from "react";
import { DealerTermsGate } from "@/components/dealer/dealer-terms-gate";
import { useAuth } from "@/lib/auth";
import { getOwnedVehiclesData, getSellerInspectionRequestsData, getSellerOffersData } from "@/lib/data";
import { Vehicle } from "@/types";

type DealerAnalyticsState = {
  vehicles: Vehicle[];
  enquiries: number;
  inspections: number;
};

export function DealerAnalyticsPanel() {
  const { appUser, loading } = useAuth();
  const [analytics, setAnalytics] = useState<DealerAnalyticsState>({
    vehicles: [],
    enquiries: 0,
    inspections: 0
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      if (!appUser?.id) return;
      const [vehiclesResult, offersResult, inspectionsResult] = await Promise.all([
        getOwnedVehiclesData(appUser.id),
        getSellerOffersData(appUser.id),
        getSellerInspectionRequestsData(appUser.id)
      ]);

      if (!cancelled) {
        setAnalytics({
          vehicles: vehiclesResult.items,
          enquiries: offersResult.items.length,
          inspections: inspectionsResult.items.length
        });
      }
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [appUser?.id]);

  if (loading) {
    return <p className="text-sm text-ink/60">Loading dealer analytics...</p>;
  }

  const activeListings = analytics.vehicles.filter((vehicle) => vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER").length;
  const soldListings = analytics.vehicles.filter((vehicle) => vehicle.sellerStatus === "SOLD").length;

  return (
    <DealerTermsGate>
      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer analytics</p>
        <h1 className="mt-4 font-display text-4xl text-ink">Analytics</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
          Basic dealer performance counts using currently available CarNest activity data.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Total listings</p>
            <p className="mt-2 font-display text-3xl text-ink">{analytics.vehicles.length}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Active listings</p>
            <p className="mt-2 font-display text-3xl text-ink">{activeListings}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Sold listings</p>
            <p className="mt-2 font-display text-3xl text-ink">{soldListings}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Total enquiries</p>
            <p className="mt-2 font-display text-3xl text-ink">{analytics.enquiries}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Total inspections</p>
            <p className="mt-2 font-display text-3xl text-ink">{analytics.inspections}</p>
          </div>
        </div>

        <div className="mt-8 rounded-[24px] border border-dashed border-black/10 bg-shell px-5 py-6 text-sm text-ink/60">
          Detailed listing views, lead conversion, and shop storefront analytics will appear here once dealer storefront tracking is connected.
        </div>
      </section>
    </DealerTermsGate>
  );
}
