"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  buildAccountingCashSummary,
  getEntryMelbourneDateKey,
  getEntryMelbourneMonthKey,
  getEntryMelbourneYearKey,
  getTodayMelbourneDateKey,
  getMelbourneMonthKeyFromDate,
  getMelbourneYearKeyFromDate
} from "@/lib/admin-accounting-utils";
import { getAdminAccountingEntriesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatAccountingCurrency } from "@/lib/utils";
import { AdminAccountingEntry } from "@/types";

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
    const todayKey = getTodayMelbourneDateKey();
    const monthKey = getMelbourneMonthKeyFromDate(new Date());
    const yearKey = getMelbourneYearKeyFromDate(new Date());
    const today = buildAccountingCashSummary(
      accountingEntries.filter((entry) => getEntryMelbourneDateKey(entry) === todayKey)
    );
    const month = buildAccountingCashSummary(
      accountingEntries.filter((entry) => getEntryMelbourneMonthKey(entry) === monthKey)
    );
    const year = buildAccountingCashSummary(
      accountingEntries.filter((entry) => getEntryMelbourneYearKey(entry) === yearKey)
    );
    const all = buildAccountingCashSummary(accountingEntries);

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
        value={loading ? "Loading..." : formatAccountingCurrency(metrics.today.netCashflow)}
        helper={loading ? "Checking today’s entries..." : `${formatAccountingCurrency(metrics.today.totalIncome)} income · ${formatAccountingCurrency(metrics.today.totalExpense)} expense`}
      />
      <MetricCard
        label="Month Net Cashflow"
        value={loading ? "Loading..." : formatAccountingCurrency(metrics.month.netCashflow)}
        helper={loading ? "Calculating month-to-date..." : `${formatAccountingCurrency(metrics.month.totalIncome)} income · ${formatAccountingCurrency(metrics.month.totalExpense)} expense`}
      />
      <MetricCard
        label="Year-To-Date Net"
        value={loading ? "Loading..." : formatAccountingCurrency(metrics.year.netCashflow)}
        helper={loading ? "Calculating year-to-date..." : `${formatAccountingCurrency(metrics.year.totalIncome)} income · ${formatAccountingCurrency(metrics.year.totalExpense)} expense`}
      />
      <MetricCard
        label="Total Receivables"
        value={loading ? "Loading..." : formatAccountingCurrency(metrics.receivables)}
        helper="Outstanding money owed to CarNest"
      />
      <MetricCard
        label="Total Payables"
        value={loading ? "Loading..." : formatAccountingCurrency(metrics.payables)}
        helper="Outstanding money CarNest still owes"
      />
      <MetricCard
        label="GST Payable Estimate"
        value={loading ? "Loading..." : formatAccountingCurrency(metrics.gstPayable)}
        helper="GST-inclusive income less GST-inclusive expenses"
      />
    </div>
  );
}
