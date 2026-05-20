"use client";

import { useEffect, useMemo, useState } from "react";
import { createEmptyAdminAccountingEntry, getAdminAccountingEntriesData, getVehiclesData, saveAdminAccountingEntry } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { AdminAccountingEntry, Vehicle, VehicleActor } from "@/types";

type AccountingSummary = {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  gstPayable: number;
};

function createActorFromUser(user: ReturnType<typeof useAuth>["appUser"]): VehicleActor | null {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
    name: user.name,
    adminPermissions: user.adminPermissions
  };
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

function isOnOrAfter(value: string, boundary: Date) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= boundary.getTime();
}

function buildSummary(entries: AdminAccountingEntry[]): AccountingSummary {
  const totalIncome = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
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

function SummaryCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-5 shadow-panel">
      <p className="text-xs uppercase tracking-[0.22em] text-bronze">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink/56">{helper}</p>
    </div>
  );
}

export function AdminAccountingPanel() {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const canManageVehicles = hasAdminPermission(appUser, "manageVehicles");
  const [entries, setEntries] = useState<AdminAccountingEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(createEmptyAdminAccountingEntry());

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
        const [entriesResult, vehiclesResult] = await Promise.all([
          getAdminAccountingEntriesData(),
          getVehiclesData()
        ]);
        if (cancelled) return;
        setEntries(entriesResult.items.sort((left, right) => (right.date || "").localeCompare(left.date || "")));
        setVehicles(vehiclesResult.items);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "We couldn't load accounting entries.");
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

  const todaySummary = useMemo(
    () => buildSummary(entries.filter((entry) => isOnOrAfter(entry.date, startOfToday()))),
    [entries]
  );
  const monthSummary = useMemo(
    () => buildSummary(entries.filter((entry) => isOnOrAfter(entry.date, startOfMonth()))),
    [entries]
  );
  const yearSummary = useMemo(
    () => buildSummary(entries.filter((entry) => isOnOrAfter(entry.date, startOfYear()))),
    [entries]
  );
  const outstandingSummary = useMemo(() => {
    const receivables = entries
      .filter((entry) => entry.type === "receivable" && entry.status !== "paid")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const payables = entries
      .filter((entry) => entry.type === "payable" && entry.status !== "paid")
      .reduce((sum, entry) => sum + entry.amount, 0);
    return { receivables, payables };
  }, [entries]);

  if (!canManageVehicles) {
    return null;
  }

  async function handleSaveEntry() {
    if (!actor) return;

    try {
      setSaving(true);
      setErrorMessage("");
      setNotice("");
      const linkedVehicle = draft.relatedVehicleId
        ? vehicles.find((vehicle) => vehicle.id === draft.relatedVehicleId) ?? null
        : null;
      const result = await saveAdminAccountingEntry(
        {
          ...draft,
          relatedVehicleId: linkedVehicle?.id || "",
          relatedDisplayReference: linkedVehicle ? getVehicleDisplayReference(linkedVehicle) : draft.relatedDisplayReference,
          relatedVehicleTitle: linkedVehicle ? `${linkedVehicle.year} ${linkedVehicle.make} ${linkedVehicle.model}`.trim() : draft.relatedVehicleTitle
        },
        actor
      );
      setEntries((current) => [result.entry, ...current].sort((left, right) => (right.date || "").localeCompare(left.date || "")));
      setDraft(createEmptyAdminAccountingEntry());
      setNotice("Accounting entry saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't save the accounting entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Accounting</p>
            <h2 className="mt-2 font-display text-2xl text-ink">Cashflow and outstanding balances</h2>
            <p className="mt-2 text-sm text-ink/60">Record private admin income, expenses, receivables, and payables without affecting public listings.</p>
          </div>
        </div>
      </div>

      {notice ? <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {errorMessage ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Daily"
          value={loading ? "Loading..." : formatCurrency(todaySummary.netCashflow)}
          helper={loading ? "Calculating today’s net cashflow..." : `${formatCurrency(todaySummary.totalIncome)} income · ${formatCurrency(todaySummary.totalExpense)} expense`}
        />
        <SummaryCard
          label="Monthly"
          value={loading ? "Loading..." : formatCurrency(monthSummary.netCashflow)}
          helper={loading ? "Calculating this month..." : `${formatCurrency(monthSummary.totalIncome)} income · ${formatCurrency(monthSummary.totalExpense)} expense · GST payable est. ${formatCurrency(monthSummary.gstPayable)}`}
        />
        <SummaryCard
          label="Year To Date"
          value={loading ? "Loading..." : formatCurrency(yearSummary.netCashflow)}
          helper={loading ? "Calculating year-to-date..." : `${formatCurrency(yearSummary.totalIncome)} income · ${formatCurrency(yearSummary.totalExpense)} expense`}
        />
        <SummaryCard
          label="Outstanding"
          value={loading ? "Loading..." : formatCurrency(outstandingSummary.receivables - outstandingSummary.payables)}
          helper={loading ? "Checking receivables and payables..." : `${formatCurrency(outstandingSummary.receivables)} receivables · ${formatCurrency(outstandingSummary.payables)} payables`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.22em] text-bronze">New entry</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Entry type</label>
              <select
                value={draft.type}
                onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as AdminAccountingEntry["type"] }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="receivable">Receivable</option>
                <option value="payable">Payable</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Date</label>
              <input
                type="date"
                value={draft.date}
                onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.amount || ""}
                onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value || 0) }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Category</label>
              <input
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                placeholder="Storage fee, sale proceeds, battery, sundry"
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Payment method</label>
              <select
                value={draft.paymentMethod}
                onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value as AdminAccountingEntry["paymentMethod"] }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Status</label>
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AdminAccountingEntry["status"] }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially paid</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Related vehicle / listing</label>
              <select
                value={draft.relatedVehicleId || ""}
                onChange={(event) => setDraft((current) => ({ ...current, relatedVehicleId: event.target.value }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                <option value="">No linked vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {getVehicleDisplayReference(vehicle)} · {vehicle.year} {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink md:col-span-2">
              <input
                type="checkbox"
                checked={draft.gstIncluded}
                onChange={(event) => setDraft((current) => ({ ...current, gstIncluded: event.target.checked }))}
                className="h-4 w-4 rounded border-black/20 text-ink"
              />
              <span>Amount includes GST</span>
            </label>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Note</label>
              <textarea
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                className="min-h-[96px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
                placeholder="Add internal accounting context"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveEntry()}
              disabled={saving}
              className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save accounting entry"}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.22em] text-bronze">Recent entries</p>
          <div className="mt-4 space-y-3">
            {entries.slice(0, 10).map((entry) => (
              <div key={entry.id} className="rounded-[18px] border border-black/6 bg-shell px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {entry.category || entry.type} · {formatCurrency(entry.amount)}
                    </p>
                    <p className="mt-1 text-xs text-ink/56">
                      {entry.date} · {entry.type.replace(/_/g, " ")} · {entry.paymentMethod === "bank_transfer" ? "Bank transfer" : "Cash"} · {entry.status.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-xs text-ink/56">
                      {entry.relatedDisplayReference || "No linked listing"}{entry.relatedVehicleTitle ? ` · ${entry.relatedVehicleTitle}` : ""}
                    </p>
                    {entry.note ? <p className="mt-2 text-sm text-ink/68">{entry.note}</p> : null}
                  </div>
                  <div className="text-right text-xs text-ink/55">
                    <p className="font-semibold text-ink">{entry.createdByName || "CarNest Admin"}</p>
                    <p className="mt-1">{entry.gstIncluded ? "GST inclusive" : "No GST"}</p>
                  </div>
                </div>
              </div>
            ))}
            {!entries.length && !loading ? (
              <div className="rounded-[18px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm text-ink/58">
                No accounting entries yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
