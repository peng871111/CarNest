"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getAdminAccountingEntriesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { AdminAccountingEntry } from "@/types";

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

function isOnOrAfter(dateValue: string | undefined, startTime: number) {
  if (!dateValue) return false;
  const time = new Date(dateValue).getTime();
  return Number.isFinite(time) && time >= startTime;
}

function getGstPortion(entry: AdminAccountingEntry) {
  return entry.gstIncluded ? entry.amount / 11 : 0;
}

function buildAccountingSummary(entries: AdminAccountingEntry[]) {
  const totalIncome = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const receivables = entries
    .filter((entry) => entry.type === "receivable" && entry.status !== "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const payables = entries
    .filter((entry) => entry.type === "payable" && entry.status !== "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gstPayable = entries.reduce((sum, entry) => {
    const gst = getGstPortion(entry);
    if (entry.type === "income" || entry.type === "receivable") return sum + gst;
    if (entry.type === "expense" || entry.type === "payable") return sum - gst;
    return sum;
  }, 0);

  return {
    netCashflow: totalIncome - totalExpense,
    totalIncome,
    totalExpense,
    receivables,
    payables,
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
        const result = await getAdminAccountingEntriesData();
        if (!cancelled) {
          setAccountingEntries(result.items);
        }
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
    const today = buildAccountingSummary(
      accountingEntries.filter((entry) => isOnOrAfter(entry.date, getStartOfTodayTime()))
    );
    const month = buildAccountingSummary(
      accountingEntries.filter((entry) => isOnOrAfter(entry.date, getStartOfMonthTime()))
    );
    const year = buildAccountingSummary(
      accountingEntries.filter((entry) => isOnOrAfter(entry.date, getStartOfYearTime()))
    );
    const all = buildAccountingSummary(accountingEntries);

    return {
      today,
      month,
      year,
      receivables: all.receivables,
      payables: all.payables,
      gstPayable: all.gstPayable
    };
  }, [accountingEntries]);

  if (!canManageVehicles) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Today Net Cashflow"
        value={loading ? "Loading..." : formatCurrency(metrics.today.netCashflow)}
        helper={loading ? "Checking today’s entries..." : `${formatCurrency(metrics.today.totalIncome)} income · ${formatCurrency(metrics.today.totalExpense)} expense`}
      />
      <MetricCard
        label="Month Net Cashflow"
        value={loading ? "Loading..." : formatCurrency(metrics.month.netCashflow)}
        helper={loading ? "Calculating month-to-date..." : `${formatCurrency(metrics.month.totalIncome)} income · ${formatCurrency(metrics.month.totalExpense)} expense`}
      />
      <MetricCard
        label="Year-To-Date Net"
        value={loading ? "Loading..." : formatCurrency(metrics.year.netCashflow)}
        helper={loading ? "Calculating year-to-date..." : `${formatCurrency(metrics.year.totalIncome)} income · ${formatCurrency(metrics.year.totalExpense)} expense`}
      />
      <MetricCard
        label="Total Receivables"
        value={loading ? "Loading..." : formatCurrency(metrics.receivables)}
        helper="Outstanding money owed to CarNest"
      />
      <MetricCard
        label="Total Payables"
        value={loading ? "Loading..." : formatCurrency(metrics.payables)}
        helper="Outstanding money CarNest still owes"
      />
      <MetricCard
        label="GST Payable Estimate"
        value={loading ? "Loading..." : formatCurrency(metrics.gstPayable)}
        helper="GST-inclusive income less GST-inclusive expenses"
      />
    </div>
  );
}
