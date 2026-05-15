"use client";

import { useEffect, useMemo, useState } from "react";
import { readAdminGrossAmountDrafts } from "@/components/admin/admin-gross-amount-storage";
import { useAuth } from "@/lib/auth";
import { getVehiclesData, getWarehouseIntakesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { Vehicle, WarehouseIntakeRecord } from "@/types";

function formatAverageDays(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "Not enough new sold data yet";
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

function getStartOfTodayTime() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function isOnOrAfterToday(dateValue?: string) {
  if (!dateValue) return false;
  const time = new Date(dateValue).getTime();
  return Number.isFinite(time) && time >= getStartOfTodayTime();
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
  const [grossDraftsUpdatedAt, setGrossDraftsUpdatedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const canManageVehicles = hasAdminPermission(appUser, "manageVehicles");

  useEffect(() => {
    function refreshGrossDrafts() {
      setGrossDraftsUpdatedAt(Date.now());
    }

    refreshGrossDrafts();
    window.addEventListener("storage", refreshGrossDrafts);
    window.addEventListener("focus", refreshGrossDrafts);
    return () => {
      window.removeEventListener("storage", refreshGrossDrafts);
      window.removeEventListener("focus", refreshGrossDrafts);
    };
  }, []);

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
    const grossDrafts = readAdminGrossAmountDrafts();
    const intakesByVehicleId = new Map<string, WarehouseIntakeRecord[]>();
    intakes.forEach((intake) => {
      if (!intake.vehicleId) return;
      const existing = intakesByVehicleId.get(intake.vehicleId) ?? [];
      existing.push(intake);
      intakesByVehicleId.set(intake.vehicleId, existing);
    });

    const listingsFromToday = vehicles.filter((vehicle) => {
      if (vehicle.deleted) return false;
      const startDate = getListingStartDate(vehicle, intakesByVehicleId.get(vehicle.id) ?? []);
      return isOnOrAfterToday(startDate);
    });

    const soldDurations = vehicles
      .filter((vehicle) => !vehicle.deleted && vehicle.sellerStatus === "SOLD" && vehicle.soldAt)
      .map((vehicle) => {
        const startDate = getListingStartDate(vehicle, intakesByVehicleId.get(vehicle.id) ?? []);
        if (!isOnOrAfterToday(startDate)) return null;
        return getDaysBetweenIsoDates(startDate, vehicle.soldAt);
      })
      .filter((value): value is number => value != null);

    const listingsWithGrossDrafts = listingsFromToday
      .map((vehicle) => {
        const draft = grossDrafts[vehicle.id];
        if (!draft || draft.grossInclusiveAmount <= 0) return null;
        const grossAmount = draft.displayMode === "gst_inclusive"
          ? draft.grossInclusiveAmount
          : draft.grossInclusiveAmount / 1.1;
        const gstPayable = draft.displayMode === "gst_inclusive"
          ? draft.grossInclusiveAmount / 11
          : 0;
        return { grossAmount, gstPayable };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    const averageDaysToSold = soldDurations.length
      ? soldDurations.reduce((sum, value) => sum + value, 0) / soldDurations.length
      : null;
    const totalListingGrossRevenue = listingsWithGrossDrafts.reduce((sum, item) => sum + item.grossAmount, 0);
    const averageGrossRevenuePerListing = listingsWithGrossDrafts.length
      ? totalListingGrossRevenue / listingsWithGrossDrafts.length
      : null;
    const estimatedGstPayable = listingsWithGrossDrafts.reduce((sum, item) => sum + item.gstPayable, 0);

    return {
      averageDaysToSold,
      totalListingGrossRevenue,
      averageGrossRevenuePerListing,
      estimatedGstPayable,
      soldCount: soldDurations.length,
      listingCount: listingsWithGrossDrafts.length
    };
  }, [grossDraftsUpdatedAt, intakes, vehicles]);

  if (!canManageVehicles) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard
        label="Average Time To Sold"
        value={loading ? "Loading..." : formatAverageDays(metrics.averageDaysToSold)}
        helper={loading ? "Checking new sold listing history..." : metrics.soldCount ? `${metrics.soldCount} new sold listing${metrics.soldCount === 1 ? "" : "s"} with usable dates` : "Not enough new sold data yet"}
      />
      <MetricCard
        label="Total Listing Gross Revenue"
        value={loading ? "Loading..." : formatCurrency(metrics.totalListingGrossRevenue)}
        helper={loading ? "Calculating new listing gross totals..." : metrics.listingCount ? `${metrics.listingCount} new listing${metrics.listingCount === 1 ? "" : "s"} with gross amounts · Estimated GST payable ${formatCurrency(metrics.estimatedGstPayable)}` : "No new gross amounts available yet"}
      />
      <MetricCard
        label="Average Gross Per Listing"
        value={loading ? "Loading..." : metrics.averageGrossRevenuePerListing != null ? formatCurrency(metrics.averageGrossRevenuePerListing) : "No new gross amounts available yet"}
        helper={loading ? "Calculating average gross amount..." : metrics.listingCount ? "Derived from the admin row gross amount field only" : "No new gross amounts available yet"}
      />
    </div>
  );
}
