"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getVehicleAnalytics } from "@/lib/data";
import { VehicleAnalytics } from "@/types";

interface VehicleInsightsPanelProps {
  vehicleId: string;
  sellerOwnerUid: string;
  audience: "admin" | "seller";
}

function formatBreakdown(items: VehicleAnalytics["topCities"]) {
  return items.map((item) => `${item.label} (${item.count})`).join(" · ");
}

export function VehicleInsightsPanel({ vehicleId, sellerOwnerUid, audience }: VehicleInsightsPanelProps) {
  const { appUser, loading } = useAuth();
  const [analytics, setAnalytics] = useState<VehicleAnalytics | null>(null);
  const [error, setError] = useState("");
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      if (loading) return;
      if (!appUser) {
        setLoadingAnalytics(false);
        return;
      }

      if (audience === "admin" && appUser.role !== "admin") {
        setLoadingAnalytics(false);
        return;
      }

      if (audience === "seller" && (appUser.role !== "seller" || appUser.id !== sellerOwnerUid)) {
        setLoadingAnalytics(false);
        return;
      }

      setLoadingAnalytics(true);
      const result = await getVehicleAnalytics(vehicleId, sellerOwnerUid);
      if (cancelled) return;

      setAnalytics(result.analytics);
      setError("error" in result && result.error ? result.error : "");
      setLoadingAnalytics(false);
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [appUser, audience, loading, sellerOwnerUid, vehicleId]);

  if (loadingAnalytics) {
    return (
      <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.25em] text-bronze">Listing insights</p>
        <p className="mt-3 text-sm leading-6 text-ink/68">Loading performance insights...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.25em] text-bronze">Listing insights</p>
        <p className="mt-3 text-sm leading-6 text-ink/68">We could not load insights right now.</p>
      </section>
    );
  }

  if (!analytics) return null;

  const hasActivity =
    analytics.totalViews > 0 || analytics.saves > 0 || analytics.offers > 0 || analytics.inspections > 0;

  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.25em] text-bronze">Listing insights</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">Audience activity</h2>
      <p className="mt-3 text-sm leading-6 text-ink/68">
        Track how this listing is performing across views, saves, offers, inspections, and top audience locations.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Total views", analytics.totalViews],
          ["Unique visitors", analytics.uniqueVisitors],
          ["Saved count", analytics.saves],
          ["Offer count", analytics.offers],
          ["Inspection count", analytics.inspections],
          ["Views in 30 days", analytics.views30d]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[22px] bg-shell px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      {hasActivity ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-black/5 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Top cities</p>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              {analytics.topCities.length ? formatBreakdown(analytics.topCities) : "Not enough audience data yet."}
            </p>
          </div>
          <div className="rounded-[22px] border border-black/5 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Top states</p>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              {analytics.topStates.length ? formatBreakdown(analytics.topStates) : "Not enough audience data yet."}
            </p>
          </div>
          <div className="rounded-[22px] border border-black/5 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Top sources</p>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              {analytics.topSources.length ? formatBreakdown(analytics.topSources) : "Traffic sources will appear once views are recorded."}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[22px] bg-shell px-4 py-4 text-sm leading-6 text-ink/68">
          Performance insights will appear here once buyers begin interacting with this listing.
        </div>
      )}
    </section>
  );
}
