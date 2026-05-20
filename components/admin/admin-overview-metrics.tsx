"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getAdminAccountingEntriesData, getVehiclesData, getWarehouseIntakesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { AdminAccountingEntry, Vehicle, WarehouseIntakeRecord } from "@/types";

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

function getStartOfMonthTime() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).getTime();
}

function getStartOfYearTime() {
  const today = new Date();
  return new Date(today.getFullYear(), 0, 1).getTime();
}

function isOnOrAfterToday(dateValue?: string) {
  if (!dateValue) return false;
  const time = new Date(dateValue).getTime();
  return Number.isFinite(time) && time >= getStartOfTodayTime();
}

function isOnOrAfter(dateValue: string | undefined, startTime: number) {
  if (!dateValue) return false;
  const time = new Date(dateValue).getTime();
  return Number.isFinite(time) && time >= startTime;
}

function buildAccountingSummary(entries: AdminAccountingEntry[]) {
  const totalIncome = entries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = entries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const gstPayable = entries
    .filter((entry) => entry.type === "income" && entry.gstIncluded)
    .reduce((sum, entry) => sum + entry.amount / 11, 0);
  return {
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    gstPayable
  };
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
  const [accountingEntries, setAccountingEntries] = useState<AdminAccountingEntry[]>([]);
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
        const [vehiclesResult, intakesResult, accountingResult] = await Promise.all([
          getVehiclesData(),
          getWarehouseIntakesData(),
          getAdminAccountingEntriesData()
        ]);
        if (cancelled) return;
        setVehicles(vehiclesResult.items);
        setIntakes(intakesResult.items);
        setAccountingEntries(accountingResult.items);
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

    const todayAccounting = buildAccountingSummary(
      accountingEntries.filter((entry) => isOnOrAfter(entry.date, getStartOfTodayTime()))
    );
    const monthAccounting = buildAccountingSummary(
      accountingEntries.filter((entry) => isOnOrAfter(entry.date, getStartOfMonthTime()))
    );
    const yearAccounting = buildAccountingSummary(
      accountingEntries.filter((entry) => isOnOrAfter(entry.date, getStartOfYearTime()))
    );
    const outstandingReceivables = accountingEntries
      .filter((entry) => entry.type === "receivable" && entry.status !== "paid")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const outstandingPayables = accountingEntries
      .filter((entry) => entry.type === "payable" && entry.status !== "paid")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const averageDaysToSold = soldDurations.length
      ? soldDurations.reduce((sum, value) => sum + value, 0) / soldDurations.length
      : null;

    return {
      averageDaysToSold,
      soldCount: soldDurations.length,
      listingCount: listingsFromToday.length,
      todayAccounting,
      monthAccounting,
      yearAccounting,
      outstandingReceivables,
      outstandingPayables
    };
  }, [accountingEntries, intakes, vehicles]);

  if (!canManageVehicles) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Average Time To Sold"
        value={loading ? "Loading..." : formatAverageDays(metrics.averageDaysToSold)}
        helper={loading ? "Checking new sold listing history..." : metrics.soldCount ? `${metrics.soldCount} new sold listing${metrics.soldCount === 1 ? "" : "s"} with usable dates` : "Not enough new sold data yet"}
      />
      <MetricCard
        label="Today Net Cashflow"
        value={loading ? "Loading..." : formatCurrency(metrics.todayAccounting.netCashflow)}
        helper={loading ? "Calculating today’s income and expense..." : `${formatCurrency(metrics.todayAccounting.totalIncome)} income · ${formatCurrency(metrics.todayAccounting.totalExpense)} expense`}
      />
      <MetricCard
        label="Month Net Cashflow"
        value={loading ? "Loading..." : formatCurrency(metrics.monthAccounting.netCashflow)}
        helper={loading ? "Calculating this month’s cashflow..." : `${formatCurrency(metrics.monthAccounting.totalIncome)} income · ${formatCurrency(metrics.monthAccounting.totalExpense)} expense · GST est. ${formatCurrency(metrics.monthAccounting.gstPayable)}`}
      />
      <MetricCard
        label="Outstanding Balances"
        value={loading ? "Loading..." : formatCurrency(metrics.outstandingReceivables - metrics.outstandingPayables)}
        helper={loading ? "Checking receivables and payables..." : `${formatCurrency(metrics.outstandingReceivables)} receivables · ${formatCurrency(metrics.outstandingPayables)} payables · YTD net ${formatCurrency(metrics.yearAccounting.netCashflow)}`}
      />
    </div>
  );
}
