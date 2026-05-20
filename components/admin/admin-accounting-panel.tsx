"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildAccountingCashSummary,
  formatMelbourneDateHeading,
  getAccountingEntryGstPortion,
  getAccountingEntryNetPortion,
  getEntryMelbourneDateKey,
  getMelbourneMonthKeyFromDate,
  getMelbourneYearKeyFromDate,
  getOutstandingAgeLabel,
  getOutstandingDays,
  getTodayMelbourneDateKey
} from "@/lib/admin-accounting-utils";
import {
  createEmptyAdminAccountingEntry,
  deleteAdminAccountingEntry,
  getAdminAccountingEntriesData,
  getCustomerProfilesData,
  getVehicleRecordsData,
  getVehiclesData,
  saveAdminAccountingEntry
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { AdminAccountingEntry, CustomerProfile, Vehicle, VehicleActor, VehicleRecord } from "@/types";

const ACCOUNTING_CATEGORY_OPTIONS = [
  "Storage fee",
  "Detailing",
  "Transport",
  "Photography",
  "Carsales",
  "Facebook ads",
  "Xiaohongshu ads",
  "Repair",
  "Cleaning",
  "Commission",
  "Fuel",
  "Reimbursement",
  "Miscellaneous"
] as const;

type SearchableVehicleOption = {
  vehicle: Vehicle;
  vehicleRecord: VehicleRecord | null;
  customerName: string;
  searchText: string;
  title: string;
  subtitle: string;
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

function sortAccountingEntries(entries: AdminAccountingEntry[]) {
  return [...entries].sort((left, right) => {
    const leftKey = left.updatedAt || left.createdAt || left.date || "";
    const rightKey = right.updatedAt || right.createdAt || right.date || "";
    return rightKey.localeCompare(leftKey);
  });
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
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(createEmptyAdminAccountingEntry());
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false);
  const [expandedDateGroups, setExpandedDateGroups] = useState<Record<string, boolean>>({});

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
        const [entriesResult, vehiclesResult, customerProfilesResult, vehicleRecordsResult] = await Promise.all([
          getAdminAccountingEntriesData(),
          getVehiclesData(),
          getCustomerProfilesData(),
          getVehicleRecordsData()
        ]);
        if (cancelled) return;
        setEntries(sortAccountingEntries(entriesResult.items));
        setVehicles(vehiclesResult.items);
        setCustomerProfiles(customerProfilesResult.items);
        setVehicleRecords(vehicleRecordsResult.items);
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

  const vehicleSearchOptions = useMemo(() => {
    const customerMap = new Map(customerProfiles.map((profile) => [profile.id, profile]));
    const recordByListingId = new Map(
      vehicleRecords
        .filter((record) => record.publicListingId)
        .map((record) => [record.publicListingId as string, record] as const)
    );

    return vehicles.map((vehicle) => {
      const vehicleRecord = recordByListingId.get(vehicle.id) ?? null;
      const customer = vehicleRecord?.customerProfileId ? customerMap.get(vehicleRecord.customerProfileId) ?? null : null;
      const customerName = customer?.fullName || vehicle.customerName || "";
      const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`.trim();
      const subtitle = [
        getVehicleDisplayReference(vehicle),
        vehicle.rego || "",
        customerName || ""
      ].filter(Boolean).join(" · ");
      const searchText = [
        getVehicleDisplayReference(vehicle),
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.variant,
        vehicle.rego,
        customerName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return {
        vehicle,
        vehicleRecord,
        customerName,
        searchText,
        title,
        subtitle
      } satisfies SearchableVehicleOption;
    });
  }, [customerProfiles, vehicleRecords, vehicles]);

  const selectedVehicleOption = useMemo(
    () => vehicleSearchOptions.find((option) => option.vehicle.id === draft.relatedVehicleId) ?? null,
    [draft.relatedVehicleId, vehicleSearchOptions]
  );

  const filteredVehicleOptions = useMemo(() => {
    const term = vehicleSearch.trim().toLowerCase();
    const filtered = term
      ? vehicleSearchOptions.filter((option) => option.searchText.includes(term))
      : vehicleSearchOptions;
    return filtered.slice(0, 8);
  }, [vehicleSearch, vehicleSearchOptions]);

  const todayKey = useMemo(() => getTodayMelbourneDateKey(), []);

  useEffect(() => {
    setExpandedDateGroups((current) => {
      const next = { ...current };
      const keys = new Set(entries.map((entry) => getEntryMelbourneDateKey(entry)).filter(Boolean));
      keys.forEach((key) => {
        if (!(key in next)) {
          next[key] = key === todayKey;
        }
      });
      return next;
    });
  }, [entries, todayKey]);

  const todaySummary = useMemo(
    () => buildAccountingCashSummary(entries.filter((entry) => getEntryMelbourneDateKey(entry) === todayKey)),
    [entries, todayKey]
  );
  const monthSummary = useMemo(() => {
    const monthKey = getMelbourneMonthKeyFromDate(new Date());
    return buildAccountingCashSummary(entries.filter((entry) => getEntryMelbourneDateKey(entry).slice(0, 7) === monthKey));
  }, [entries]);
  const yearSummary = useMemo(() => {
    const yearKey = getMelbourneYearKeyFromDate(new Date());
    return buildAccountingCashSummary(entries.filter((entry) => getEntryMelbourneDateKey(entry).slice(0, 4) === yearKey));
  }, [entries]);
  const outstandingSummary = useMemo(() => {
    const summary = buildAccountingCashSummary(entries);
    return { receivables: summary.receivables, payables: summary.payables };
  }, [entries]);
  const gstPreview = useMemo(
    () => ({
      gross: draft.amount,
      gst: getAccountingEntryGstPortion(draft),
      net: getAccountingEntryNetPortion(draft)
    }),
    [draft]
  );

  const groupedEntries = useMemo(() => {
    const groupedMap = new Map<string, AdminAccountingEntry[]>();
    entries.forEach((entry) => {
      const key = getEntryMelbourneDateKey(entry) || "pending";
      const existing = groupedMap.get(key) ?? [];
      existing.push(entry);
      groupedMap.set(key, existing);
    });

    return [...groupedMap.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([dateKey, items]) => ({
        dateKey,
        items,
        summary: buildAccountingCashSummary(items)
      }));
  }, [entries]);

  if (!canManageVehicles) {
    return null;
  }

  function resetDraft() {
    setDraft(createEmptyAdminAccountingEntry());
    setEditingEntryId(null);
    setVehicleSearch("");
    setVehicleSearchOpen(false);
  }

  function startEdit(entry: AdminAccountingEntry) {
    setDraft({
      type: entry.type,
      date: entry.date,
      amount: entry.amount,
      category: entry.category,
      paymentMethod: entry.paymentMethod,
      gstIncluded: entry.gstIncluded,
      relatedVehicleId: entry.relatedVehicleId || "",
      relatedVehicleRecordId: entry.relatedVehicleRecordId || "",
      relatedDisplayReference: entry.relatedDisplayReference || "",
      relatedVehicleTitle: entry.relatedVehicleTitle || "",
      note: entry.note,
      status: entry.status,
      createdByUid: entry.createdByUid || "",
      createdByName: entry.createdByName || "",
      createdAt: entry.createdAt || "",
      updatedAt: entry.updatedAt || ""
    });
    setEditingEntryId(entry.id);
    setVehicleSearch("");
    setVehicleSearchOpen(false);
    setNotice("");
    setErrorMessage("");
  }

  function selectVehicleOption(option: SearchableVehicleOption) {
    setDraft((current) => ({
      ...current,
      relatedVehicleId: option.vehicle.id,
      relatedVehicleRecordId: option.vehicleRecord?.id || "",
      relatedDisplayReference: getVehicleDisplayReference(option.vehicle),
      relatedVehicleTitle: option.title
    }));
    setVehicleSearch(option.title);
    setVehicleSearchOpen(false);
  }

  function clearVehicleSelection() {
    setDraft((current) => ({
      ...current,
      relatedVehicleId: "",
      relatedVehicleRecordId: "",
      relatedDisplayReference: "",
      relatedVehicleTitle: ""
    }));
    setVehicleSearch("");
    setVehicleSearchOpen(false);
  }

  async function handleSaveEntry() {
    if (!actor) return;

    try {
      setSaving(true);
      setErrorMessage("");
      setNotice("");
      const linkedVehicle = draft.relatedVehicleId
        ? vehicleSearchOptions.find((option) => option.vehicle.id === draft.relatedVehicleId) ?? null
        : null;
      const result = await saveAdminAccountingEntry(
        {
          ...draft,
          category: draft.category || "Miscellaneous",
          relatedVehicleId: linkedVehicle?.vehicle.id || "",
          relatedVehicleRecordId: linkedVehicle?.vehicleRecord?.id || "",
          relatedDisplayReference: linkedVehicle ? getVehicleDisplayReference(linkedVehicle.vehicle) : draft.relatedDisplayReference,
          relatedVehicleTitle: linkedVehicle ? linkedVehicle.title : draft.relatedVehicleTitle
        },
        actor,
        editingEntryId || undefined
      );
      setEntries((current) => sortAccountingEntries([result.entry, ...current.filter((entry) => entry.id !== result.entry.id)]));
      resetDraft();
      setNotice(editingEntryId ? "Accounting entry updated." : "Accounting entry saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't save the accounting entry.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(entry: AdminAccountingEntry) {
    if (!actor) return;
    const confirmed = window.confirm(`Delete the accounting entry "${entry.category || entry.type}" for ${formatCurrency(entry.amount)}?`);
    if (!confirmed) return;

    try {
      setBusyDeleteId(entry.id);
      setErrorMessage("");
      setNotice("");
      await deleteAdminAccountingEntry(entry.id, actor);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      if (editingEntryId === entry.id) {
        resetDraft();
      }
      setNotice("Accounting entry deleted.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't delete the accounting entry.");
    } finally {
      setBusyDeleteId(null);
    }
  }

  function toggleDateGroup(dateKey: string) {
    setExpandedDateGroups((current) => ({
      ...current,
      [dateKey]: !current[dateKey]
    }));
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Accounting</p>
            <h2 className="mt-2 font-display text-2xl text-ink">Cashflow and outstanding balances</h2>
            <p className="mt-2 text-sm text-ink/60">Track real CarNest income, expenses, receivables, and payables without affecting public listings.</p>
          </div>
        </div>
      </div>

      {notice ? <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {errorMessage ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Daily"
          value={loading ? "Loading..." : formatCurrency(todaySummary.netCashflow)}
          helper={loading ? "Calculating today’s local cashflow..." : `${formatCurrency(todaySummary.totalIncome)} income · ${formatCurrency(todaySummary.totalExpense)} expense`}
        />
        <SummaryCard
          label="Monthly"
          value={loading ? "Loading..." : formatCurrency(monthSummary.netCashflow)}
          helper={loading ? "Calculating this month..." : `${formatCurrency(monthSummary.totalIncome)} income · ${formatCurrency(monthSummary.totalExpense)} expense · GST est. ${formatCurrency(monthSummary.gstPayable)}`}
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">{editingEntryId ? "Edit entry" : "New entry"}</p>
              <p className="mt-2 text-sm text-ink/60">Record real CarNest cashflow and outstanding amounts in one place.</p>
            </div>
            {editingEntryId ? (
              <button
                type="button"
                onClick={resetDraft}
                className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Entry type</label>
              <select
                value={draft.type}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  type: event.target.value as AdminAccountingEntry["type"],
                  status:
                    event.target.value === "income" || event.target.value === "expense"
                      ? "paid"
                      : current.status
                }))}
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
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Category</label>
              <select
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                <option value="">Select a category</option>
                {ACCOUNTING_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
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
              <div className="rounded-[22px] border border-black/10 bg-white p-3">
                <input
                  value={selectedVehicleOption && vehicleSearch === "" ? selectedVehicleOption.title : vehicleSearch}
                  onChange={(event) => {
                    setVehicleSearch(event.target.value);
                    setVehicleSearchOpen(true);
                    if (draft.relatedVehicleId && event.target.value !== selectedVehicleOption?.title) {
                      setDraft((current) => ({
                        ...current,
                        relatedVehicleId: "",
                        relatedVehicleRecordId: "",
                        relatedDisplayReference: "",
                        relatedVehicleTitle: ""
                      }));
                    }
                  }}
                  onFocus={() => setVehicleSearchOpen(true)}
                  placeholder="Search listing ID, year, make, model, variant, rego, or customer"
                  className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-ink/58">
                    {selectedVehicleOption
                      ? `${selectedVehicleOption.subtitle || "Linked vehicle selected"}`
                      : "No linked vehicle"}
                  </p>
                  {(draft.relatedVehicleId || vehicleSearch) ? (
                    <button
                      type="button"
                      onClick={clearVehicleSelection}
                      className="text-xs font-semibold text-ink/60 transition hover:text-bronze"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                {vehicleSearchOpen ? (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={clearVehicleSelection}
                      className="w-full rounded-2xl border border-dashed border-black/10 px-3 py-3 text-left text-sm text-ink/60 transition hover:border-[#C6A87D] hover:text-ink"
                    >
                      No linked vehicle
                    </button>
                    {filteredVehicleOptions.map((option) => (
                      <button
                        key={option.vehicle.id}
                        type="button"
                        onClick={() => selectVehicleOption(option)}
                        className="w-full rounded-2xl border border-black/6 px-3 py-3 text-left transition hover:border-[#C6A87D] hover:bg-shell"
                      >
                        <p className="text-sm font-semibold text-ink">{option.title}</p>
                        <p className="mt-1 text-xs text-ink/58">{option.subtitle || "No extra details available"}</p>
                      </button>
                    ))}
                    {!filteredVehicleOptions.length ? (
                      <div className="rounded-2xl border border-dashed border-black/10 px-3 py-3 text-sm text-ink/58">
                        No matching vehicles found.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
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
            <div className="grid gap-3 rounded-[22px] border border-black/6 bg-shell px-4 py-4 text-sm text-ink md:col-span-2 md:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/48">Gross amount</p>
                <p className="mt-1 font-semibold text-ink">{formatCurrency(gstPreview.gross)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/48">GST payable</p>
                <p className="mt-1 font-semibold text-ink">{formatCurrency(gstPreview.gst)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/48">Net amount</p>
                <p className="mt-1 font-semibold text-ink">{formatCurrency(gstPreview.net)}</p>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">
                {draft.category === "Miscellaneous" ? "Miscellaneous note" : "Note"}
              </label>
              <textarea
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                className="min-h-[96px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
                placeholder={
                  draft.category === "Miscellaneous"
                    ? "Optional note for this miscellaneous accounting item"
                    : "Add internal accounting context"
                }
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
              {saving ? "Saving..." : editingEntryId ? "Update accounting entry" : "Save accounting entry"}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.22em] text-bronze">Recent entries</p>
          <div className="mt-4 space-y-3">
            {groupedEntries.map((group) => {
              const isExpanded = expandedDateGroups[group.dateKey] ?? false;
              return (
                <div key={group.dateKey} className="rounded-[20px] border border-black/6 bg-shell">
                  <button
                    type="button"
                    onClick={() => toggleDateGroup(group.dateKey)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{formatMelbourneDateHeading(group.dateKey)}</p>
                      <p className="mt-1 text-xs text-ink/58">
                        {formatCurrency(group.summary.totalIncome)} income · {formatCurrency(group.summary.totalExpense)} expense · Net {formatCurrency(group.summary.netCashflow)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-ink/60">{isExpanded ? "Hide" : "Show"}</span>
                  </button>
                  {isExpanded ? (
                    <div className="space-y-3 border-t border-black/6 px-4 py-4">
                      {group.items.map((entry) => {
                        const daysOutstanding = getOutstandingDays(entry);
                        const ageLabel = getOutstandingAgeLabel(daysOutstanding);
                        const isOverdue = daysOutstanding != null && daysOutstanding > 7;
                        return (
                          <div key={entry.id} className="rounded-[18px] border border-black/6 bg-white px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink">
                                  {entry.category || entry.type} · {formatCurrency(entry.amount)}
                                </p>
                                <p className="mt-1 text-xs text-ink/56">
                                  {entry.type.replace(/_/g, " ")} · {entry.paymentMethod === "bank_transfer" ? "Bank transfer" : "Cash"} · {entry.status.replace(/_/g, " ")}
                                </p>
                                <p className="mt-1 text-xs text-ink/56">
                                  {entry.relatedDisplayReference || "No linked listing"}{entry.relatedVehicleTitle ? ` · ${entry.relatedVehicleTitle}` : ""}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/62">
                                  <span>Gross {formatCurrency(entry.amount)}</span>
                                  <span>GST {formatCurrency(getAccountingEntryGstPortion(entry))}</span>
                                  <span>Net {formatCurrency(getAccountingEntryNetPortion(entry))}</span>
                                  {ageLabel ? (
                                    <span className={isOverdue ? "font-semibold text-amber-700" : ""}>
                                      {ageLabel}{daysOutstanding != null ? ` · ${daysOutstanding} day${daysOutstanding === 1 ? "" : "s"} outstanding` : ""}
                                    </span>
                                  ) : null}
                                </div>
                                {entry.note ? <p className="mt-2 text-sm text-ink/68">{entry.note}</p> : null}
                              </div>
                              <div className="text-right text-xs text-ink/55">
                                <p className="font-semibold text-ink">{entry.createdByName || "CarNest Admin"}</p>
                                <p className="mt-1">{entry.gstIncluded ? "GST inclusive" : "No GST"}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(entry)}
                                className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteEntry(entry)}
                                disabled={busyDeleteId === entry.id}
                                className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-[#B42318] transition hover:border-[#B42318]/35 disabled:opacity-50"
                              >
                                {busyDeleteId === entry.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!groupedEntries.length && !loading ? (
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
