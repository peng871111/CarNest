"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getVehiclesData, getWarehouseIntakesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { Vehicle, WarehouseIntakeRecord } from "@/types";

function formatAverageDays(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "Not enough sold data yet";
  return `${value.toFixed(1)} days`;
}

function getListingStartDate(vehicle: Vehicle, intakes: WarehouseIntakeRecord[]) {
  const intakeDates = intakes
    .map((intake) => intake.intakeDate || intake.createdAt || "")
    .filter(Boolean)
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => left.time - right.time);

  return intakeDates[0]?.value || vehicle.approvedAt || vehicle.createdAt || "";
}

function getDaysBetweenIsoDates(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return null;
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
  return Math.max(Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)), 0);
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-5 shadow-panel">
      <p className="text-xs uppercase tracking-[0.22em] text-bronze">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
      {helper ? <p className="mt-2 text-sm text-ink/56">{helper}</p> : null}
    </div>
  );
}

export function AdminOverviewMetrics() {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [intakes, setIntakes] = useState<WarehouseIntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const canManageVehicles = hasAdminPermission(appUser, "manageVehicles");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!canManageVehicles || !firebaseUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await firebaseUser.getIdToken();
        const [vehiclesResult, intakesResult] = await Promise.all([
          getVehiclesData(),
          getWarehouseIntakesData()
        ]);
        if (cancelled) return;
        setVehicles(vehiclesResult.items);
        setIntakes(intakesResult.items);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, canManageVehicles, firebaseUser]);

  const metrics = useMemo(() => {
    const intakesByVehicleId = new Map<string, WarehouseIntakeRecord[]>();
    intakes.forEach((intake) => {
      if (!intake.vehicleId) return;
      const existing = intakesByVehicleId.get(intake.vehicleId) ?? [];
      existing.push(intake);
      intakesByVehicleId.set(intake.vehicleId, existing);
    });

    const eligibleListings = vehicles.filter((vehicle) => !vehicle.deleted && vehicle.price > 0);
    const soldDurations = vehicles
      .filter((vehicle) => !vehicle.deleted && vehicle.sellerStatus === "SOLD" && vehicle.soldAt)
      .map((vehicle) => {
        const startDate = getListingStartDate(vehicle, intakesByVehicleId.get(vehicle.id) ?? []);
        return getDaysBetweenIsoDates(startDate, vehicle.soldAt);
      })
      .filter((value): value is number => value != null);

    const averageDaysToSold = soldDurations.length
      ? soldDurations.reduce((sum, value) => sum + value, 0) / soldDurations.length
      : null;
    const totalListingGrossRevenue = eligibleListings.reduce((sum, vehicle) => sum + (vehicle.price || 0), 0);
    const averageGrossRevenuePerListing = eligibleListings.length
      ? totalListingGrossRevenue / eligibleListings.length
      : null;

    return {
      averageDaysToSold,
      totalListingGrossRevenue,
      averageGrossRevenuePerListing,
      soldCount: soldDurations.length,
      listingCount: eligibleListings.length
    };
  }, [intakes, vehicles]);

  if (!canManageVehicles) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard
        label="Average Time To Sold"
        value={loading ? "Loading..." : formatAverageDays(metrics.averageDaysToSold)}
        helper={loading ? "Checking sold listing history..." : metrics.soldCount ? `${metrics.soldCount} sold listing${metrics.soldCount === 1 ? "" : "s"} with usable dates` : "Not enough sold data yet"}
      />
      <MetricCard
        label="Total Listing Gross Revenue"
        value={loading ? "Loading..." : formatCurrency(metrics.totalListingGrossRevenue)}
        helper={loading ? "Calculating active and sold listing totals..." : metrics.listingCount ? `${metrics.listingCount} listings with gross value` : "No listing gross values available yet"}
      />
      <MetricCard
        label="Average Gross Per Listing"
        value={loading ? "Loading..." : metrics.averageGrossRevenuePerListing != null ? formatCurrency(metrics.averageGrossRevenuePerListing) : "Not enough sold data yet"}
        helper={loading ? "Calculating average listing gross..." : metrics.listingCount ? "Derived from existing listing price data" : "Not enough sold data yet"}
      />
    </div>
  );
}
