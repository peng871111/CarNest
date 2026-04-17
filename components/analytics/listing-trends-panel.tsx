"use client";

import { useEffect, useState } from "react";
import { SellerListingStatusBadge } from "@/components/vehicles/seller-listing-status-badge";
import { getVehicleAnalytics } from "@/lib/data";
import { getListingLabel } from "@/lib/permissions";
import { Vehicle, VehicleAnalytics } from "@/types";

type ListingTrendsPanelProps = {
  ownerUid: string;
  vehicles: Vehicle[];
};

type TrendSignal = {
  lineToneClassName: string;
  label: string;
  labelToneClassName: string;
  series: number[];
};

function buildFallbackAnalytics(vehicleId: string, ownerUid: string): VehicleAnalytics {
  return {
    id: vehicleId,
    vehicleId,
    sellerOwnerUid: ownerUid,
    totalViews: 0,
    uniqueVisitors: 0,
    views7d: 0,
    views30d: 0,
    saves: 0,
    saves7d: 0,
    saves30d: 0,
    offers: 0,
    offers7d: 0,
    offers30d: 0,
    inspections: 0,
    inspections7d: 0,
    inspections30d: 0,
    topCities: [],
    topStates: [],
    topSources: []
  };
}

function resolveTrendSignal(recent: number, trailing30d: number, total: number): TrendSignal {
  const previousWindowTotal = Math.max(trailing30d - recent, 0);
  const previousWeeklyPace = previousWindowTotal > 0 ? (previousWindowTotal / 23) * 7 : 0;
  const hasEnoughData = trailing30d >= 2 || total >= 3;

  if ((recent === 0 && trailing30d === 0 && total === 0) || (!hasEnoughData && recent <= 1 && previousWindowTotal === 0)) {
    return {
      label: "Collecting trend data",
      labelToneClassName: "text-ink/45",
      lineToneClassName: "text-ink/35",
      series: [0.55, 0.56, 0.56, 0.57, 0.57]
    };
  }

  if (previousWeeklyPace === 0) {
    return {
      label: recent > 0 ? "Rising" : "Stable",
      labelToneClassName: recent > 0 ? "text-bronze" : "text-ink/60",
      lineToneClassName: recent > 0 ? "text-bronze" : "text-ink/55",
      series: recent > 0 ? [0.35, 0.52, 0.7, 0.84, 1] : [0.58, 0.59, 0.6, 0.6, 0.61]
    };
  }

  if (recent === 0 && previousWindowTotal > 0) {
    return {
      label: "Cooling",
      labelToneClassName: "text-ink/55",
      lineToneClassName: "text-ink/45",
      series: [1, 0.84, 0.66, 0.44, 0.3]
    };
  }

  if (recent >= previousWeeklyPace * 1.35 + 0.35) {
    return {
      label: "Rising",
      labelToneClassName: "text-bronze",
      lineToneClassName: "text-bronze",
      series: [0.42, 0.5, 0.66, 0.82, 1]
    };
  }

  if (recent <= previousWeeklyPace * 0.65 && previousWindowTotal >= 2) {
    return {
      label: "Cooling",
      labelToneClassName: "text-ink/55",
      lineToneClassName: "text-ink/45",
      series: [1, 0.88, 0.72, 0.56, 0.42]
    };
  }

  return {
    label: "Stable",
    labelToneClassName: "text-ink/60",
    lineToneClassName: "text-ink/55",
    series: [0.66, 0.69, 0.68, 0.7, 0.71]
  };
}

function buildSparklinePath(series: number[]) {
  const maxValue = Math.max(...series, 1);

  return series
    .map((value, index) => {
      const x = (index / Math.max(series.length - 1, 1)) * 100;
      const y = 28 - (value / maxValue) * 18;
      return `${x},${y}`;
    })
    .join(" ");
}

function TrendMetric({
  label,
  recent,
  trailing30d,
  total
}: {
  label: string;
  recent: number;
  trailing30d: number;
  total: number;
}) {
  const signal = resolveTrendSignal(recent, trailing30d, total);

  return (
    <div className="rounded-[22px] border border-black/5 bg-shell/70 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">{label}</p>
          <p className={`mt-2 text-sm font-medium ${signal.labelToneClassName}`}>{signal.label}</p>
        </div>
        <div className={`w-24 ${signal.lineToneClassName}`}>
          <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden="true">
            <path d="M0 28 H100" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
            <polyline
              fill="none"
              points={buildSparklinePath(signal.series)}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function ListingTrendsPanel({ ownerUid, vehicles }: ListingTrendsPanelProps) {
  const [analyticsByVehicleId, setAnalyticsByVehicleId] = useState<Record<string, VehicleAnalytics>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      if (!ownerUid || !vehicles.length) {
        setAnalyticsByVehicleId({});
        setLoading(false);
        return;
      }

      setLoading(true);
      const entries = await Promise.all(
        vehicles.map(async (vehicle) => {
          const result = await getVehicleAnalytics(vehicle.id, ownerUid);
          return [vehicle.id, result.analytics] as const;
        })
      );

      if (cancelled) return;

      setAnalyticsByVehicleId(Object.fromEntries(entries));
      setLoading(false);
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [ownerUid, vehicles]);

  if (!vehicles.length) return null;

  return (
    <section className="rounded-[32px] border border-black/5 bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">Listing performance</p>
          <h2 className="mt-3 font-display text-3xl text-ink">Trend signals across your listings</h2>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            A lightweight read on how buyer attention is moving, designed to stay useful even while activity is still building.
          </p>
        </div>
        {loading ? <p className="text-sm text-ink/50">Refreshing trend signals...</p> : null}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {vehicles.map((vehicle) => {
          const analytics = analyticsByVehicleId[vehicle.id] ?? buildFallbackAnalytics(vehicle.id, ownerUid);

          return (
            <article key={vehicle.id} className="rounded-[28px] border border-black/5 bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-ink">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <p className="mt-2 text-sm text-ink/55">{getListingLabel(vehicle.listingType)}</p>
                </div>
                <SellerListingStatusBadge vehicle={vehicle} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <TrendMetric
                  label="Views trend"
                  recent={analytics.views7d}
                  trailing30d={analytics.views30d}
                  total={analytics.totalViews}
                />
                <TrendMetric
                  label="Enquiry trend"
                  recent={analytics.inspections7d}
                  trailing30d={analytics.inspections30d}
                  total={analytics.inspections}
                />
                <TrendMetric
                  label="Offer activity"
                  recent={analytics.offers7d}
                  trailing30d={analytics.offers30d}
                  total={analytics.offers}
                />
                <TrendMetric
                  label="Saved activity"
                  recent={analytics.saves7d}
                  trailing30d={analytics.saves30d}
                  total={analytics.saves}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
