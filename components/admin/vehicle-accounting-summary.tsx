"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getAdminAccountingEntriesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { AdminAccountingEntry } from "@/types";

function getLinkedAccountingEntries(
  entries: AdminAccountingEntry[],
  vehicleId: string,
  vehicleRecordId?: string | null
) {
  return entries.filter((entry) =>
    entry.relatedVehicleId === vehicleId
    || (vehicleRecordId ? entry.relatedVehicleRecordId === vehicleRecordId : false)
  );
}

function calculateGstPortion(entry: AdminAccountingEntry) {
  return entry.gstIncluded ? entry.amount / 11 : 0;
}

function buildVehicleAccountingSummary(entries: AdminAccountingEntry[]) {
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const receivables = entries
    .filter((entry) => entry.type === "receivable" && entry.status !== "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const payables = entries
    .filter((entry) => entry.type === "payable" && entry.status !== "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gstEstimate = entries.reduce((sum, entry) => {
    const gst = calculateGstPortion(entry);
    if (entry.type === "income" || entry.type === "receivable") return sum + gst;
    if (entry.type === "expense" || entry.type === "payable") return sum - gst;
    return sum;
  }, 0);

  return {
    income,
    expense,
    netProfit: income - expense,
    receivables,
    payables,
    gstEstimate
  };
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[108px]">
      <p className="text-[10px] uppercase tracking-[0.16em] text-ink/48">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

export function VehicleAccountingSummary({
  vehicleId,
  vehicleRecordId,
  entries,
  compact = false
}: {
  vehicleId: string;
  vehicleRecordId?: string | null;
  entries?: AdminAccountingEntry[];
  compact?: boolean;
}) {
  const { appUser, firebaseUser, loading } = useAuth();
  const canManageVehicles = hasAdminPermission(appUser, "manageVehicles");
  const [loadedEntries, setLoadedEntries] = useState<AdminAccountingEntry[]>(entries ?? []);

  useEffect(() => {
    if (entries) {
      setLoadedEntries(entries);
    }
  }, [entries]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      if (entries || loading || !canManageVehicles || !firebaseUser) return;
      const result = await getAdminAccountingEntriesData();
      if (!cancelled) {
        setLoadedEntries(result.items);
      }
    }

    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [canManageVehicles, entries, firebaseUser, loading]);

  const linkedEntries = useMemo(
    () => getLinkedAccountingEntries(loadedEntries, vehicleId, vehicleRecordId),
    [loadedEntries, vehicleId, vehicleRecordId]
  );
  const summary = useMemo(() => buildVehicleAccountingSummary(linkedEntries), [linkedEntries]);

  if (!canManageVehicles || !linkedEntries.length) {
    return null;
  }

  if (compact) {
    return (
      <div className="rounded-[18px] border border-black/6 bg-shell px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-bronze">Accounting preview</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink/62">
          <span>Income {formatCurrency(summary.income)}</span>
          <span>Expense {formatCurrency(summary.expense)}</span>
          <span>Net {formatCurrency(summary.netProfit)}</span>
          <span>Receivables {formatCurrency(summary.receivables)}</span>
          <span>Payables {formatCurrency(summary.payables)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.25em] text-bronze">Accounting preview</p>
      <div className="mt-4 flex flex-wrap gap-4">
        <SummaryValue label="Income" value={formatCurrency(summary.income)} />
        <SummaryValue label="Expense" value={formatCurrency(summary.expense)} />
        <SummaryValue label="Net profit" value={formatCurrency(summary.netProfit)} />
        <SummaryValue label="Receivables" value={formatCurrency(summary.receivables)} />
        <SummaryValue label="Payables" value={formatCurrency(summary.payables)} />
        <SummaryValue label="GST est." value={formatCurrency(summary.gstEstimate)} />
      </div>
    </div>
  );
}
