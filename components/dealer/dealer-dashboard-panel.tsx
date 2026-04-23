"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DealerTermsGate } from "@/components/dealer/dealer-terms-gate";
import { useAuth } from "@/lib/auth";
import { getDealerApplicationByUserId, getOwnedVehiclesData, getSellerInspectionRequestsData, getSellerOffersData } from "@/lib/data";
import { DealerApplication, InspectionRequest, Offer, Vehicle } from "@/types";

type DealerDashboardState = {
  application: DealerApplication | null;
  vehicles: Vehicle[];
  offers: Offer[];
  inspections: InspectionRequest[];
};

export function DealerDashboardPanel() {
  const { appUser, loading } = useAuth();
  const [dashboard, setDashboard] = useState<DealerDashboardState>({
    application: null,
    vehicles: [],
    offers: [],
    inspections: []
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!appUser?.id) return;
      const [application, vehiclesResult, offersResult, inspectionsResult] = await Promise.all([
        getDealerApplicationByUserId(appUser.id).catch(() => null),
        getOwnedVehiclesData(appUser.id),
        getSellerOffersData(appUser.id),
        getSellerInspectionRequestsData(appUser.id)
      ]);
      if (!cancelled) {
        setDashboard({
          application,
          vehicles: vehiclesResult.items,
          offers: offersResult.items,
          inspections: inspectionsResult.items
        });
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [appUser?.id]);

  if (loading) {
    return <p className="text-sm text-ink/60">Loading dealer dashboard...</p>;
  }

  const businessName = dashboard.application?.legalBusinessName || dashboard.application?.tradingName || "Dealer business details pending";
  const status = appUser?.dealerStatus ?? dashboard.application?.status ?? "approved";
  const activeListings = dashboard.vehicles.filter((vehicle) => vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER");
  const pendingListings = dashboard.vehicles.filter((vehicle) => vehicle.status === "pending");
  const soldListings = dashboard.vehicles.filter((vehicle) => vehicle.sellerStatus === "SOLD");
  const recentVehicles = dashboard.vehicles.slice(0, 4);
  const recentLeads = dashboard.offers.slice(0, 4);

  return (
    <DealerTermsGate>
      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer</p>
        <h1 className="mt-4 font-display text-4xl text-ink">Dealer Dashboard</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
          Manage your dealer inventory, leads, and shop profile from a dedicated CarNest dealer workspace.
        </p>

        <div className="mt-6 grid gap-3 rounded-[24px] border border-black/5 bg-shell px-5 py-4 text-sm text-ink/65 md:grid-cols-2">
          <p>Status: {status.replaceAll("_", " ")}</p>
          <p>Business: {businessName}</p>
          {dashboard.application?.contactEmail ? <p>Contact email: {dashboard.application.contactEmail}</p> : null}
          {dashboard.application?.licenceState || dashboard.application?.lmctNumber ? (
            <p>Licence: {[dashboard.application.lmctNumber, dashboard.application.licenceState].filter(Boolean).join(" · ")}</p>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Active listings</p>
            <p className="mt-2 font-display text-3xl text-ink">{activeListings.length}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Pending listings</p>
            <p className="mt-2 font-display text-3xl text-ink">{pendingListings.length}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Sold listings</p>
            <p className="mt-2 font-display text-3xl text-ink">{soldListings.length}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Enquiries received</p>
            <p className="mt-2 font-display text-3xl text-ink">{dashboard.offers.length}</p>
          </div>
          <div className="rounded-[24px] bg-shell px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Inspections booked</p>
            <p className="mt-2 font-display text-3xl text-ink">{dashboard.inspections.length}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
            <p className="text-xs uppercase tracking-[0.18em] text-bronze">Inventory snapshot</p>
            <div className="mt-4 space-y-3">
              {recentVehicles.length ? recentVehicles.map((vehicle) => (
                <p key={vehicle.id} className="text-sm text-ink/70">
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")} · {vehicle.sellerStatus}
                </p>
              )) : <p className="text-sm text-ink/60">No inventory yet.</p>}
            </div>
          </div>
          <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
            <p className="text-xs uppercase tracking-[0.18em] text-bronze">Recent leads</p>
            <div className="mt-4 space-y-3">
              {recentLeads.length ? recentLeads.map((offer) => (
                <p key={offer.id} className="text-sm text-ink/70">{offer.buyerName} · {offer.vehicleTitle}</p>
              )) : <p className="text-sm text-ink/60">No recent leads yet.</p>}
            </div>
          </div>
          <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
            <p className="text-xs uppercase tracking-[0.18em] text-bronze">Shop profile status</p>
            <p className="mt-4 text-sm text-ink/70">Plan: {(dashboard.application?.dealerPlan || "free").replaceAll("_", " ")}</p>
            <p className="mt-2 text-sm text-ink/70">Shop visible: {dashboard.application?.shopPublicVisible ? "Yes" : "No"}</p>
            <p className="mt-2 text-sm text-ink/70">
              Compliance terms: {dashboard.application?.agreedToDealerTerms || dashboard.application?.agreedToTerms || appUser?.agreedToDealerTerms || appUser?.agreedToTerms ? "Accepted" : "Required"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link href="/dealer/inventory/new" className="rounded-[24px] border border-black/5 bg-white p-5 text-sm font-semibold text-ink shadow-panel transition hover:-translate-y-0.5">
            Add vehicle
          </Link>
          <Link href="/dealer/inventory" className="rounded-[24px] border border-black/5 bg-white p-5 text-sm font-semibold text-ink shadow-panel transition hover:-translate-y-0.5">
            Inventory
          </Link>
          <Link href="/dealer/leads" className="rounded-[24px] border border-black/5 bg-white p-5 text-sm font-semibold text-ink shadow-panel transition hover:-translate-y-0.5">
            Leads
          </Link>
        </div>
      </section>
    </DealerTermsGate>
  );
}
