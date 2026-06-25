"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildAccountingCashSummary,
  buildAccountingReportSummary,
  filterEntriesByMelbourneDateRange,
  formatMelbourneDateHeading,
  getAccountingEntryGstPortion,
  getAccountingEntryNetPortion,
  getAccountingPaymentMethodLabel,
  getAccountingPeriodLabel,
  getMelbourneDateRangeForPeriod,
  getEntryMelbourneDateKey,
  getMelbourneMonthKeyFromDate,
  getMelbourneYearKeyFromDate,
  getOutstandingAgeLabel,
  getOutstandingDays,
  getTodayMelbourneDateKey,
  type AccountingPeriodOption
} from "@/lib/admin-accounting-utils";
import {
  exportAccountingCsv,
  exportAccountingPdf,
  exportAccountingXlsx,
  type AccountingExportFormat
} from "@/lib/admin-accounting-export";
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
import { formatAccountingCurrency, getVehicleDisplayReference } from "@/lib/utils";
import {
  AdminAccountingEntry,
  AdminAccountingGstMode,
  AdminAccountingPaymentMethod,
  CustomerProfile,
  Vehicle,
  VehicleActor,
  VehicleRecord
} from "@/types";

const INCOME_CATEGORY_OPTIONS = [
  "Listing fee",
  "Storage fee",
  "Photography",
  "Detailing",
  "Ceramic coating",
  "Inspection",
  "Transport",
  "Platform fee",
  "Cleaning",
  "Other income"
] as const;

const EXPENSE_CATEGORY_OPTIONS = [
  "Repair",
  "RWC",
  "Detailing expense",
  "Transport expense",
  "Advertising",
  "Fuel",
  "Contractor payment",
  "Refund",
  "Cleaning expense",
  "Office Supplies",
  "Office Furniture",
  "Office Equipment",
  "Office Consumables",
  "Team Meals",
  "Staff Welfare",
  "Software & Subscriptions",
  "Phone & Internet",
  "Bank Fees",
  "Merchant Fees",
  "Insurance",
  "Other expense"
] as const;

const BALANCE_CATEGORY_OPTIONS = ["Receivable", "Payable", "Other"] as const;

const PAYMENT_METHOD_OPTIONS: Array<{ value: AdminAccountingPaymentMethod; label: string }> = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" }
];

const DATE_FILTER_OPTIONS: Array<{ value: AccountingPeriodOption; label: string }> = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" }
];

const EXPORT_PERIOD_OPTIONS: Array<{ value: AccountingPeriodOption; label: string }> = [
  { value: "today", label: "Daily" },
  { value: "this_week", label: "Weekly" },
  { value: "this_month", label: "Monthly" },
  { value: "this_year", label: "Yearly" },
  { value: "custom", label: "Custom Date Range" }
];

const GST_MODE_OPTIONS: Array<{ value: Exclude<AdminAccountingGstMode, "none">; label: string }> = [
  { value: "inclusive", label: "GST Inclusive (Supplier Purchase)" },
  { value: "exclusive", label: "GST Exclusive (Customer Invoice)" }
];

type SearchableVehicleOption = {
  vehicle: Vehicle;
  vehicleRecord: VehicleRecord | null;
  customerProfileId: string;
  customerName: string;
  searchText: string;
  title: string;
  subtitle: string;
};

type AccountingFilterState = {
  period: AccountingPeriodOption;
  customStart: string;
  customEnd: string;
  category: string;
  paymentMethod: "" | AdminAccountingPaymentMethod;
  status: "" | AdminAccountingEntry["status"];
  vehicle: string;
  customer: string;
};

function getAccountingCategoryOptions(type: AdminAccountingEntry["type"]) {
  if (type === "income") return INCOME_CATEGORY_OPTIONS;
  if (type === "expense") return EXPENSE_CATEGORY_OPTIONS;
  return BALANCE_CATEGORY_OPTIONS;
}

function isOtherCategory(category: string) {
  return category === "Other income" || category === "Other expense" || category === "Other";
}

function getEntryTypeLabel(type: AdminAccountingEntry["type"]) {
  if (type === "receivable") return "Receivable";
  if (type === "payable") return "Payable";
  return type === "income" ? "Income" : "Expense";
}

function getEntryTypeStyles(type: AdminAccountingEntry["type"]) {
  if (type === "income") {
    return {
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      card: "border-emerald-100 bg-emerald-50/40"
    };
  }
  if (type === "expense") {
    return {
      badge: "bg-rose-50 text-rose-700 border-rose-200",
      card: "border-rose-100 bg-rose-50/35"
    };
  }
  if (type === "receivable") {
    return {
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      card: "border-amber-100 bg-amber-50/35"
    };
  }
  return {
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    card: "border-sky-100 bg-sky-50/35"
  };
}

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

function roundCurrencyAmount(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function parseAccountingAmountInput(value: string) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function normalizeDraftGstMode(entry: Pick<AdminAccountingEntry, "gstIncluded" | "gstCalculationMode">): AdminAccountingGstMode {
  if (entry.gstIncluded === false) return "none";
  return entry.gstCalculationMode === "exclusive" ? "exclusive" : "inclusive";
}

function buildStoredAmountFromInput(inputAmount: number, mode: AdminAccountingGstMode) {
  if (mode === "exclusive") {
    return roundCurrencyAmount(inputAmount * 1.1);
  }

  return roundCurrencyAmount(inputAmount);
}

function getEditableAmountFromEntry(entry: Pick<AdminAccountingEntry, "amount" | "gstIncluded" | "gstCalculationMode">) {
  const mode = normalizeDraftGstMode(entry);
  if (mode === "exclusive") {
    return roundCurrencyAmount(getAccountingEntryNetPortion({ amount: entry.amount, gstIncluded: true }));
  }

  return roundCurrencyAmount(entry.amount);
}

function formatAmountInputValue(value: number) {
  if (!value) return "";
  return roundCurrencyAmount(value).toString();
}

function getGstModeDisplayLabel(entry: Pick<AdminAccountingEntry, "gstIncluded" | "gstCalculationMode">) {
  const mode = normalizeDraftGstMode(entry);
  if (mode === "exclusive") return "GST exclusive";
  if (mode === "inclusive") return "GST inclusive";
  return "No GST";
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

function ReportKpiCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-black/6 bg-shell p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/48">{label}</p>
      <p className="mt-3 text-xl font-semibold text-ink">{value}</p>
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
  const [amountInput, setAmountInput] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false);
  const [expandedDateGroups, setExpandedDateGroups] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<AccountingFilterState>({
    period: "all",
    customStart: "",
    customEnd: "",
    category: "",
    paymentMethod: "",
    status: "",
    vehicle: "",
    customer: ""
  });
  const [exportFormat, setExportFormat] = useState<AccountingExportFormat>("xlsx");
  const [exportPeriod, setExportPeriod] = useState<AccountingPeriodOption>("this_month");
  const [exportCustomStart, setExportCustomStart] = useState("");
  const [exportCustomEnd, setExportCustomEnd] = useState("");
  const [exporting, setExporting] = useState(false);

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
      const customerProfileId = customer?.id || vehicleRecord?.customerProfileId || "";
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
        customerProfileId,
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

  const enrichedEntries = useMemo(() => {
    const vehicleOptionMap = new Map(vehicleSearchOptions.map((option) => [option.vehicle.id, option]));
    const vehicleRecordMap = new Map(vehicleSearchOptions.map((option) => [option.vehicleRecord?.id || "", option]));
    return entries.map((entry) => {
      const linkedOption =
        (entry.relatedVehicleId ? vehicleOptionMap.get(entry.relatedVehicleId) : null)
        || (entry.relatedVehicleRecordId ? vehicleRecordMap.get(entry.relatedVehicleRecordId) : null)
        || null;
      if (!linkedOption) return entry;
      return {
        ...entry,
        relatedDisplayReference: entry.relatedDisplayReference || getVehicleDisplayReference(linkedOption.vehicle),
        relatedVehicleTitle: entry.relatedVehicleTitle || linkedOption.title,
        relatedCustomerProfileId: entry.relatedCustomerProfileId || linkedOption.customerProfileId,
        relatedCustomerName: entry.relatedCustomerName || linkedOption.customerName
      };
    });
  }, [entries, vehicleSearchOptions]);

  const currentCategoryOptions = useMemo(() => getAccountingCategoryOptions(draft.type), [draft.type]);

  const todayKey = useMemo(() => getTodayMelbourneDateKey(), []);
  const activeDateRange = useMemo(
    () => getMelbourneDateRangeForPeriod(filters.period, filters.customStart, filters.customEnd),
    [filters.customEnd, filters.customStart, filters.period]
  );
  const exportDateRange = useMemo(
    () => getMelbourneDateRangeForPeriod(exportPeriod, exportCustomStart, exportCustomEnd),
    [exportCustomEnd, exportCustomStart, exportPeriod]
  );

  const categoryFilterOptions = useMemo(() => {
    const set = new Set<string>([
      ...INCOME_CATEGORY_OPTIONS,
      ...EXPENSE_CATEGORY_OPTIONS,
      ...BALANCE_CATEGORY_OPTIONS,
      ...enrichedEntries.map((entry) => entry.category).filter(Boolean)
    ]);
    return [...set].sort((left, right) => left.localeCompare(right));
  }, [enrichedEntries]);

  const customerFilterOptions = useMemo(() => {
    const set = new Set<string>(
      enrichedEntries
        .map((entry) => entry.relatedCustomerName?.trim() || "")
        .filter(Boolean)
    );
    return [...set].sort((left, right) => left.localeCompare(right));
  }, [enrichedEntries]);

  const vehicleFilterOptions = useMemo(() => {
    const set = new Set<string>(
      enrichedEntries
        .map((entry) => [entry.relatedDisplayReference, entry.relatedVehicleTitle].filter(Boolean).join(" · "))
        .filter(Boolean)
    );
    return [...set].sort((left, right) => left.localeCompare(right));
  }, [enrichedEntries]);

  const filteredEntriesWithoutDate = useMemo(() => {
    const vehicleTerm = filters.vehicle.trim().toLowerCase();
    const customerTerm = filters.customer.trim().toLowerCase();
    return enrichedEntries.filter((entry) => {
      if (filters.category && entry.category !== filters.category) return false;
      if (filters.paymentMethod && entry.paymentMethod !== filters.paymentMethod) return false;
      if (filters.status && entry.status !== filters.status) return false;
      if (vehicleTerm) {
        const vehicleHaystack = `${entry.relatedDisplayReference || ""} ${entry.relatedVehicleTitle || ""}`.toLowerCase();
        if (!vehicleHaystack.includes(vehicleTerm)) return false;
      }
      if (customerTerm) {
        const customerHaystack = (entry.relatedCustomerName || "").toLowerCase();
        if (!customerHaystack.includes(customerTerm)) return false;
      }
      return true;
    });
  }, [enrichedEntries, filters.category, filters.customer, filters.paymentMethod, filters.status, filters.vehicle]);

  const filteredEntries = useMemo(
    () => filterEntriesByMelbourneDateRange(filteredEntriesWithoutDate, activeDateRange),
    [activeDateRange, filteredEntriesWithoutDate]
  );

  const exportEntries = useMemo(
    () => filterEntriesByMelbourneDateRange(filteredEntriesWithoutDate, exportDateRange),
    [exportDateRange, filteredEntriesWithoutDate]
  );

  useEffect(() => {
    setExpandedDateGroups((current) => {
      const next = { ...current };
      const keys = new Set(filteredEntries.map((entry) => getEntryMelbourneDateKey(entry)).filter(Boolean));
      keys.forEach((key) => {
        if (!(key in next)) {
          next[key] = key === todayKey;
        }
      });
      return next;
    });
  }, [filteredEntries, todayKey]);

  const todaySummary = useMemo(
    () => buildAccountingCashSummary(filteredEntries.filter((entry) => getEntryMelbourneDateKey(entry) === todayKey)),
    [filteredEntries, todayKey]
  );
  const monthSummary = useMemo(() => {
    const monthKey = getMelbourneMonthKeyFromDate(new Date());
    return buildAccountingCashSummary(filteredEntries.filter((entry) => getEntryMelbourneDateKey(entry).slice(0, 7) === monthKey));
  }, [filteredEntries]);
  const yearSummary = useMemo(() => {
    const yearKey = getMelbourneYearKeyFromDate(new Date());
    return buildAccountingCashSummary(filteredEntries.filter((entry) => getEntryMelbourneDateKey(entry).slice(0, 4) === yearKey));
  }, [filteredEntries]);
  const outstandingSummary = useMemo(() => {
    const summary = buildAccountingCashSummary(filteredEntries);
    return { receivables: summary.receivables, payables: summary.payables };
  }, [filteredEntries]);
  const filteredReportSummary = useMemo(() => buildAccountingReportSummary(filteredEntries), [filteredEntries]);
  const exportSummary = useMemo(() => buildAccountingReportSummary(exportEntries), [exportEntries]);
  const gstPreview = useMemo(
    () => {
      const mode = normalizeDraftGstMode(draft);
      const inputAmount = parseAccountingAmountInput(amountInput);

      if (mode === "exclusive") {
        const gst = roundCurrencyAmount(inputAmount * 0.1);
        const total = roundCurrencyAmount(inputAmount + gst);
        return {
          primaryLabel: "Net amount",
          primaryValue: inputAmount,
          gstLabel: "GST amount",
          gstValue: gst,
          secondaryLabel: "Total amount",
          secondaryValue: total
        };
      }

      if (mode === "inclusive") {
        const gst = roundCurrencyAmount(inputAmount / 11);
        const net = roundCurrencyAmount(inputAmount - gst);
        return {
          primaryLabel: "Gross amount",
          primaryValue: inputAmount,
          gstLabel: "GST amount",
          gstValue: gst,
          secondaryLabel: "Net amount",
          secondaryValue: net
        };
      }

      return {
        primaryLabel: "Amount",
        primaryValue: inputAmount,
        gstLabel: "GST amount",
        gstValue: 0,
        secondaryLabel: "Net amount",
        secondaryValue: inputAmount
      };
    },
    [amountInput, draft]
  );

  const groupedEntries = useMemo(() => {
    const groupedMap = new Map<string, AdminAccountingEntry[]>();
    filteredEntries.forEach((entry) => {
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
  }, [filteredEntries]);

  if (!canManageVehicles) {
    return null;
  }

  function resetDraft() {
    const emptyDraft = createEmptyAdminAccountingEntry();
    setDraft(emptyDraft);
    setAmountInput(formatAmountInputValue(getEditableAmountFromEntry(emptyDraft)));
    setEditingEntryId(null);
    setVehicleSearch("");
    setVehicleSearchOpen(false);
  }

  function startEdit(entry: AdminAccountingEntry) {
    const nextDraft = {
      type: entry.type,
      date: entry.date,
      amount: entry.amount,
      category: entry.category,
      paymentMethod: entry.paymentMethod,
      gstIncluded: entry.gstIncluded,
      gstCalculationMode: normalizeDraftGstMode(entry),
      relatedVehicleId: entry.relatedVehicleId || "",
      relatedVehicleRecordId: entry.relatedVehicleRecordId || "",
      relatedDisplayReference: entry.relatedDisplayReference || "",
      relatedVehicleTitle: entry.relatedVehicleTitle || "",
      relatedCustomerProfileId: entry.relatedCustomerProfileId || "",
      relatedCustomerName: entry.relatedCustomerName || "",
      note: entry.note,
      status: entry.status,
      createdByUid: entry.createdByUid || "",
      createdByName: entry.createdByName || "",
      updatedByUid: entry.updatedByUid || "",
      updatedByName: entry.updatedByName || "",
      createdAt: entry.createdAt || "",
      updatedAt: entry.updatedAt || ""
    };
    setDraft(nextDraft);
    setAmountInput(formatAmountInputValue(getEditableAmountFromEntry(nextDraft)));
    setEditingEntryId(entry.id);
    setVehicleSearch("");
    setVehicleSearchOpen(false);
    setNotice("");
    setErrorMessage("");
  }

  function updateDraftAmount(nextInput: string, nextMode?: AdminAccountingGstMode) {
    setAmountInput(nextInput);
    setDraft((current) => {
      const mode = nextMode ?? normalizeDraftGstMode(current);
      const parsedAmount = parseAccountingAmountInput(nextInput);

      return {
        ...current,
        amount: buildStoredAmountFromInput(parsedAmount, mode),
        gstIncluded: mode !== "none",
        gstCalculationMode: mode
      };
    });
  }

  function selectVehicleOption(option: SearchableVehicleOption) {
    setDraft((current) => ({
      ...current,
      relatedVehicleId: option.vehicle.id,
      relatedVehicleRecordId: option.vehicleRecord?.id || "",
      relatedDisplayReference: getVehicleDisplayReference(option.vehicle),
      relatedVehicleTitle: option.title,
      relatedCustomerProfileId: option.customerProfileId,
      relatedCustomerName: option.customerName
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
      relatedVehicleTitle: "",
      relatedCustomerProfileId: "",
      relatedCustomerName: ""
    }));
    setVehicleSearch("");
    setVehicleSearchOpen(false);
  }

  function resetFilters() {
    setFilters({
      period: "all",
      customStart: "",
      customEnd: "",
      category: "",
      paymentMethod: "",
      status: "",
      vehicle: "",
      customer: ""
    });
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
          category:
            draft.category
            || (draft.type === "income"
              ? "Other income"
              : draft.type === "expense"
                ? "Other expense"
                : draft.type === "receivable"
                  ? "Receivable"
                  : "Payable"),
          relatedVehicleId: linkedVehicle?.vehicle.id || "",
          relatedVehicleRecordId: linkedVehicle?.vehicleRecord?.id || "",
          relatedDisplayReference: linkedVehicle ? getVehicleDisplayReference(linkedVehicle.vehicle) : draft.relatedDisplayReference,
          relatedVehicleTitle: linkedVehicle ? linkedVehicle.title : draft.relatedVehicleTitle,
          relatedCustomerProfileId: linkedVehicle?.customerProfileId || draft.relatedCustomerProfileId,
          relatedCustomerName: linkedVehicle?.customerName || draft.relatedCustomerName
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
      const confirmed = window.confirm(`Delete the accounting entry "${entry.category || entry.type}" for ${formatAccountingCurrency(entry.amount)}?`);
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

  async function handleExport() {
    try {
      setExporting(true);
      setErrorMessage("");
      if (exportFormat === "csv") {
        await exportAccountingCsv(exportEntries, exportPeriod);
      } else if (exportFormat === "pdf") {
        await exportAccountingPdf(exportEntries, exportPeriod);
      } else {
        await exportAccountingXlsx(exportEntries, exportPeriod);
      }
      setNotice(`Accounting report exported as ${exportFormat.toUpperCase()}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't export the accounting report.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">Accounting</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Cashflow and outstanding balances</h2>
          <p className="mt-2 text-sm text-ink/60">Track real CarNest income, expenses, receivables, and payables without affecting public listings.</p>
        </div>
      </div>

      {notice ? <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {errorMessage ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Daily"
          value={loading ? "Loading..." : formatAccountingCurrency(todaySummary.netCashflow)}
          helper={loading ? "Calculating today’s local cashflow..." : `${formatAccountingCurrency(todaySummary.totalIncome)} income · ${formatAccountingCurrency(todaySummary.totalExpense)} expense`}
        />
        <SummaryCard
          label="Monthly"
          value={loading ? "Loading..." : formatAccountingCurrency(monthSummary.netCashflow)}
          helper={loading ? "Calculating this month..." : `${formatAccountingCurrency(monthSummary.totalIncome)} income · ${formatAccountingCurrency(monthSummary.totalExpense)} expense · GST est. ${formatAccountingCurrency(monthSummary.gstPayable)}`}
        />
        <SummaryCard
          label="Year To Date"
          value={loading ? "Loading..." : formatAccountingCurrency(yearSummary.netCashflow)}
          helper={loading ? "Calculating year-to-date..." : `${formatAccountingCurrency(yearSummary.totalIncome)} income · ${formatAccountingCurrency(yearSummary.totalExpense)} expense`}
        />
        <SummaryCard
          label="Outstanding"
          value={loading ? "Loading..." : formatAccountingCurrency(outstandingSummary.receivables - outstandingSummary.payables)}
          helper={loading ? "Checking receivables and payables..." : `${formatAccountingCurrency(outstandingSummary.receivables)} receivables · ${formatAccountingCurrency(outstandingSummary.payables)} payables`}
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
                onChange={(event) =>
                  setDraft((current) => {
                    const nextType = event.target.value as AdminAccountingEntry["type"];
                    const nextOptions = getAccountingCategoryOptions(nextType);
                    const categoryStillValid = nextOptions.includes(current.category as never);
                    return {
                      ...current,
                      type: nextType,
                      category: categoryStillValid ? current.category : "",
                      status: nextType === "income" || nextType === "expense" ? "paid" : current.status
                    };
                  })
                }
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
                {currentCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">
                {normalizeDraftGstMode(draft) === "exclusive"
                  ? "Net amount (before GST)"
                  : normalizeDraftGstMode(draft) === "inclusive"
                    ? "Gross amount (includes GST)"
                    : "Amount"}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountInput}
                onChange={(event) => updateDraftAmount(event.target.value)}
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
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                        relatedVehicleTitle: "",
                        relatedCustomerProfileId: "",
                        relatedCustomerName: ""
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
                      : "Business expense (not linked to a vehicle)"}
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
                      Business expense (not linked to a vehicle)
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
            <div className="grid gap-4 md:col-span-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={normalizeDraftGstMode(draft) !== "none"}
                  onChange={(event) => {
                    const nextMode: AdminAccountingGstMode = event.target.checked
                      ? draft.gstCalculationMode === "exclusive"
                        ? "exclusive"
                        : "inclusive"
                      : "none";
                    updateDraftAmount(amountInput, nextMode);
                  }}
                  className="h-4 w-4 rounded border-black/20 text-ink"
                />
                <span>Apply GST</span>
              </label>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">GST mode</label>
                <select
                  value={normalizeDraftGstMode(draft) === "exclusive" ? "exclusive" : "inclusive"}
                  onChange={(event) => updateDraftAmount(event.target.value, event.target.value as Exclude<AdminAccountingGstMode, "none">)}
                  disabled={normalizeDraftGstMode(draft) === "none"}
                  className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D] disabled:bg-shell disabled:text-ink/45"
                >
                  {GST_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 rounded-[22px] border border-black/6 bg-shell px-4 py-4 text-sm text-ink md:col-span-2 md:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/48">{gstPreview.primaryLabel}</p>
                <p className="mt-1 font-semibold text-ink">{formatAccountingCurrency(gstPreview.primaryValue)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/48">{gstPreview.gstLabel}</p>
                <p className="mt-1 font-semibold text-ink">{formatAccountingCurrency(gstPreview.gstValue)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink/48">{gstPreview.secondaryLabel}</p>
                <p className="mt-1 font-semibold text-ink">{formatAccountingCurrency(gstPreview.secondaryValue)}</p>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">
                {isOtherCategory(draft.category) ? "Supporting note" : "Note"}
              </label>
              <textarea
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                className="min-h-[96px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
                placeholder={
                  isOtherCategory(draft.category)
                    ? "Optional note for this other accounting item"
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
          <div className="mt-4 max-h-[840px] space-y-3 overflow-y-auto pr-1">
            {groupedEntries.map((group) => {
              const isExpanded = expandedDateGroups[group.dateKey] ?? false;
              return (
                <div key={group.dateKey} className="rounded-[20px] border border-black/6 bg-shell">
                  <button
                    type="button"
                    onClick={() => toggleDateGroup(group.dateKey)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{formatMelbourneDateHeading(group.dateKey)}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                          Income {formatAccountingCurrency(group.summary.totalIncome)}
                        </span>
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                          Expense {formatAccountingCurrency(group.summary.totalExpense)}
                        </span>
                        <span className="rounded-full bg-ink/5 px-2.5 py-1 font-semibold text-ink">
                          Net {formatAccountingCurrency(group.summary.netCashflow)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-ink/60">{isExpanded ? "Hide" : "Show"}</span>
                  </button>
                  {isExpanded ? (
                    <div className="space-y-3 border-t border-black/6 px-4 py-4">
                      {group.items.map((entry) => {
                        const daysOutstanding = getOutstandingDays(entry);
                        const ageLabel = getOutstandingAgeLabel(daysOutstanding);
                        const isOverdue = daysOutstanding != null && daysOutstanding > 7;
                        const typeStyles = getEntryTypeStyles(entry.type);
                        return (
                          <div key={entry.id} className={`rounded-[18px] border px-4 py-4 ${typeStyles.card}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeStyles.badge}`}>
                                    {getEntryTypeLabel(entry.type)}
                                  </span>
                                  <p className="text-sm font-semibold text-ink">
                                    {entry.category || getEntryTypeLabel(entry.type)} · {formatAccountingCurrency(entry.amount)}
                                  </p>
                                </div>
                                <p className="mt-1 text-xs text-ink/56">
                                  {getAccountingPaymentMethodLabel(entry.paymentMethod)} · {entry.status.replace(/_/g, " ")}
                                </p>
                                <p className="mt-1 text-xs text-ink/56">
                                  {entry.relatedDisplayReference || "Business expense"}{entry.relatedVehicleTitle ? ` · ${entry.relatedVehicleTitle}` : ""}{entry.relatedCustomerName ? ` · ${entry.relatedCustomerName}` : ""}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/62">
                                  <span>Gross {formatAccountingCurrency(entry.amount)}</span>
                                  <span>GST {formatAccountingCurrency(getAccountingEntryGstPortion(entry))}</span>
                                  <span>Net {formatAccountingCurrency(getAccountingEntryNetPortion(entry))}</span>
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
                                <p className="mt-1">{getGstModeDisplayLabel(entry)}</p>
                                <p className="mt-2">
                                  Created {entry.createdAt ? new Date(entry.createdAt).toLocaleString("en-AU") : "pending"}
                                </p>
                                <p className="mt-1">
                                  Updated {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString("en-AU") : "pending"}
                                </p>
                                <p className="mt-1">
                                  Updated by {entry.updatedByName || entry.createdByName || "CarNest Admin"}
                                </p>
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
                No accounting entries match the current filters.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Export report</p>
            <p className="mt-2 text-sm text-ink/60">Export the accounting ledger for BAS preparation, tax reporting, and internal profit tracking without changing the daily bookkeeping workflow.</p>
            <p className="mt-4 text-sm font-medium text-ink/68">
              {exportEntries.length} export entr{exportEntries.length === 1 ? "y" : "ies"} in {getAccountingPeriodLabel(exportPeriod)}.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:max-w-[720px] xl:justify-end">
            <select
              value={exportPeriod}
              onChange={(event) => setExportPeriod(event.target.value as AccountingPeriodOption)}
              className="min-h-[42px] min-w-[200px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#C6A87D] xl:flex-none"
            >
              {EXPORT_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={exportFormat}
              onChange={(event) => setExportFormat(event.target.value as AccountingExportFormat)}
              className="min-h-[42px] min-w-[200px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#C6A87D] xl:flex-none"
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
            </select>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || !exportEntries.length}
              className="min-h-[42px] rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:opacity-50"
            >
              {exporting ? "Exporting..." : exportEntries.length ? "Export report" : "No data to export"}
            </button>
          </div>
        </div>

        {exportPeriod === "custom" ? (
          <div className="mt-4 grid gap-3 md:max-w-[560px] md:grid-cols-2">
            <input
              type="date"
              value={exportCustomStart}
              onChange={(event) => setExportCustomStart(event.target.value)}
              className="min-h-[42px] rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
            />
            <input
              type="date"
              value={exportCustomEnd}
              onChange={(event) => setExportCustomEnd(event.target.value)}
              className="min-h-[42px] rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
            />
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReportKpiCard label="Total Income" value={formatAccountingCurrency(exportSummary.totalIncome)} />
          <ReportKpiCard label="Total Expenses" value={formatAccountingCurrency(exportSummary.totalExpense)} />
          <ReportKpiCard label="Net Profit / Loss" value={formatAccountingCurrency(exportSummary.netCashflow)} />
          <ReportKpiCard label="GST Collected" value={formatAccountingCurrency(exportSummary.gstCollected)} />
          <ReportKpiCard label="GST Paid" value={formatAccountingCurrency(exportSummary.gstPaid)} />
          <ReportKpiCard label="GST Payable" value={formatAccountingCurrency(exportSummary.gstPayable)} />
          <ReportKpiCard label="Vehicle Reports" value={String(exportSummary.vehicleProfitBreakdown.length)} />
          <ReportKpiCard label="Payment Methods" value={String(exportSummary.paymentMethodBreakdown.length)} />
        </div>

        <div className="mt-5 rounded-[22px] border border-black/6 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/48">Filters</p>
              <p className="mt-2 text-sm text-ink/60">Refine the ledger view by date, category, payment method, status, vehicle, or customer.</p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
            >
              Clear filters
            </button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Date</label>
              <select
                value={filters.period}
                onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value as AccountingPeriodOption }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                {DATE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Category</label>
              <select
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                <option value="">All categories</option>
                {categoryFilterOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Payment method</label>
              <select
                value={filters.paymentMethod}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    paymentMethod: event.target.value as AccountingFilterState["paymentMethod"]
                  }))
                }
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                <option value="">All payment methods</option>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Status</label>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as AccountingFilterState["status"]
                  }))
                }
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              >
                <option value="">All statuses</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially paid</option>
              </select>
            </div>
            {filters.period === "custom" ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Custom start</label>
                  <input
                    type="date"
                    value={filters.customStart}
                    onChange={(event) => setFilters((current) => ({ ...current, customStart: event.target.value }))}
                    className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Custom end</label>
                  <input
                    type="date"
                    value={filters.customEnd}
                    onChange={(event) => setFilters((current) => ({ ...current, customEnd: event.target.value }))}
                    className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Vehicle</label>
              <input
                list="accounting-vehicle-filter-options"
                value={filters.vehicle}
                onChange={(event) => setFilters((current) => ({ ...current, vehicle: event.target.value }))}
                placeholder="Search listing or vehicle"
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              />
              <datalist id="accounting-vehicle-filter-options">
                {vehicleFilterOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Customer</label>
              <input
                list="accounting-customer-filter-options"
                value={filters.customer}
                onChange={(event) => setFilters((current) => ({ ...current, customer: event.target.value }))}
                placeholder="Search customer"
                className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
              />
              <datalist id="accounting-customer-filter-options">
                {customerFilterOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Vehicle Profit Report</p>
            <p className="mt-2 text-sm text-ink/60">See income, expenses, and net profit by listing so it’s easy to spot the strongest and weakest performers.</p>
          </div>
          <span className="rounded-full bg-shell px-3 py-1 text-xs font-semibold text-ink/60">
            {filteredReportSummary.vehicleProfitBreakdown.length} listing{filteredReportSummary.vehicleProfitBreakdown.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-4 max-h-[420px] overflow-y-auto rounded-[22px] border border-black/6">
          {filteredReportSummary.vehicleProfitBreakdown.length ? (
            <div className="divide-y divide-black/6">
              <div className="hidden bg-shell/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/48 sm:grid sm:grid-cols-[1.6fr,0.8fr,0.8fr,0.8fr] sm:items-center">
                <span>Vehicle / Listing</span>
                <span>Income</span>
                <span>Expenses</span>
                <span>Profit</span>
              </div>
              {filteredReportSummary.vehicleProfitBreakdown.map((item) => (
                <div key={item.vehicleId || `${item.displayReference}-${item.vehicleTitle}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[1.6fr,0.8fr,0.8fr,0.8fr] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {[item.displayReference, item.vehicleTitle].filter(Boolean).join(" · ") || "General business entry"}
                    </p>
                    <p className="mt-1 truncate text-xs text-ink/56">{item.customerName || "No customer linked"}</p>
                  </div>
                  <p className="text-sm font-medium text-emerald-700">{formatAccountingCurrency(item.totalIncome)}</p>
                  <p className="text-sm font-medium text-rose-700">{formatAccountingCurrency(item.totalExpense)}</p>
                  <p className={`text-sm font-semibold ${item.netProfit >= 0 ? "text-ink" : "text-amber-700"}`}>
                    {formatAccountingCurrency(item.netProfit)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-ink/58">No vehicle-linked accounting entries match the current filters.</div>
          )}
        </div>
      </div>
    </section>
  );
}
