import { AdminAccountingEntry } from "@/types";

const MELBOURNE_TIMEZONE = "Australia/Melbourne";

type MelbourneDateParts = {
  year: number;
  month: number;
  day: number;
};

export type AccountingCashSummary = {
  totalIncome: number;
  totalExpense: number;
  incomeByCash: number;
  expenseByCash: number;
  netCashflow: number;
  gstCollected: number;
  gstPaid: number;
  gstPayable: number;
  receivables: number;
  payables: number;
};

export type AccountingPeriodOption = "all" | "today" | "this_week" | "this_month" | "this_year" | "custom";

export type AccountingDateRange = {
  startKey: string;
  endKey: string;
};

export type AccountingPaymentMethodBreakdown = {
  paymentMethod: AdminAccountingEntry["paymentMethod"];
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
};

export type AccountingExpenseCategoryBreakdown = {
  category: string;
  totalExpense: number;
};

export type AccountingVehicleProfitBreakdown = {
  vehicleId: string;
  displayReference: string;
  vehicleTitle: string;
  customerName: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

export type AccountingCustomerProfitBreakdown = {
  customerId: string;
  customerName: string;
  totalIncome: number;
  totalExpense: number;
  profitContribution: number;
};

export type AccountingReportSummary = AccountingCashSummary & {
  paymentMethodBreakdown: AccountingPaymentMethodBreakdown[];
  expenseCategoryBreakdown: AccountingExpenseCategoryBreakdown[];
  vehicleProfitBreakdown: AccountingVehicleProfitBreakdown[];
  customerProfitBreakdown: AccountingCustomerProfitBreakdown[];
};

function getFormatterParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.formatToParts(date);
}

function getMelbourneDatePartsFromDate(date: Date): MelbourneDateParts {
  const parts = getFormatterParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 0);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 0);
  return { year, month, day };
}

function toDateKey({ year, month, day }: MelbourneDateParts) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string): MelbourneDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function shiftDateKey(dateKey: string, offsetDays: number) {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return toDateKey({
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate()
  });
}

export function getTodayMelbourneDateKey() {
  return getMelbourneDateKeyFromDate(new Date());
}

export function getMelbourneDateKeyFromDate(date: Date) {
  const { year, month, day } = getMelbourneDatePartsFromDate(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getMelbourneMonthKeyFromDate(date: Date) {
  const { year, month } = getMelbourneDatePartsFromDate(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getMelbourneYearKeyFromDate(date: Date) {
  return String(getMelbourneDatePartsFromDate(date).year);
}

export function getMelbourneDateRangeForPeriod(
  period: AccountingPeriodOption,
  customStart = "",
  customEnd = ""
): AccountingDateRange | null {
  const todayKey = getTodayMelbourneDateKey();

  if (period === "all") return null;
  if (period === "today") {
    return { startKey: todayKey, endKey: todayKey };
  }
  if (period === "this_month") {
    const parts = parseDateKey(todayKey);
    if (!parts) return null;
    return {
      startKey: toDateKey({ year: parts.year, month: parts.month, day: 1 }),
      endKey: todayKey
    };
  }
  if (period === "this_year") {
    const parts = parseDateKey(todayKey);
    if (!parts) return null;
    return {
      startKey: toDateKey({ year: parts.year, month: 1, day: 1 }),
      endKey: todayKey
    };
  }
  if (period === "this_week") {
    const parts = parseDateKey(todayKey);
    if (!parts) return null;
    const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const dayOfWeek = utcDate.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return {
      startKey: shiftDateKey(todayKey, mondayOffset),
      endKey: todayKey
    };
  }
  if (period === "custom") {
    if (!customStart && !customEnd) return null;
    const startKey = customStart || customEnd;
    const endKey = customEnd || customStart;
    if (!startKey || !endKey) return null;
    return startKey <= endKey ? { startKey, endKey } : { startKey: endKey, endKey: startKey };
  }
  return null;
}

export function isEntryInMelbourneDateRange(
  entry: Pick<AdminAccountingEntry, "date" | "createdAt">,
  range: AccountingDateRange | null
) {
  if (!range) return true;
  const dateKey = getEntryMelbourneDateKey(entry);
  if (!dateKey) return false;
  return dateKey >= range.startKey && dateKey <= range.endKey;
}

export function filterEntriesByMelbourneDateRange<
  T extends Pick<AdminAccountingEntry, "date" | "createdAt">
>(entries: T[], range: AccountingDateRange | null) {
  return entries.filter((entry) => isEntryInMelbourneDateRange(entry, range));
}

export function getEntryMelbourneDateKey(entry: Pick<AdminAccountingEntry, "date" | "createdAt">) {
  if (typeof entry.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    return entry.date;
  }
  if (entry.date) {
    const parsed = new Date(entry.date);
    if (Number.isFinite(parsed.getTime())) {
      return getMelbourneDateKeyFromDate(parsed);
    }
  }
  if (entry.createdAt) {
    const parsed = new Date(entry.createdAt);
    if (Number.isFinite(parsed.getTime())) {
      return getMelbourneDateKeyFromDate(parsed);
    }
  }
  return "";
}

export function getEntryMelbourneMonthKey(entry: Pick<AdminAccountingEntry, "date" | "createdAt">) {
  const dateKey = getEntryMelbourneDateKey(entry);
  return dateKey ? dateKey.slice(0, 7) : "";
}

export function getEntryMelbourneYearKey(entry: Pick<AdminAccountingEntry, "date" | "createdAt">) {
  const dateKey = getEntryMelbourneDateKey(entry);
  return dateKey ? dateKey.slice(0, 4) : "";
}

export function getAccountingEntryGstPortion(entry: Pick<AdminAccountingEntry, "amount" | "gstIncluded">) {
  return entry.gstIncluded ? entry.amount / 11 : 0;
}

export function getAccountingEntryNetPortion(entry: Pick<AdminAccountingEntry, "amount" | "gstIncluded">) {
  return entry.amount - getAccountingEntryGstPortion(entry);
}

export function isAccountingCashflowEntry(entry: AdminAccountingEntry) {
  return (entry.type === "income" || entry.type === "expense") && entry.status === "paid";
}

export function isOutstandingReceivable(entry: AdminAccountingEntry) {
  return entry.type === "receivable" && entry.status !== "paid";
}

export function isOutstandingPayable(entry: AdminAccountingEntry) {
  return entry.type === "payable" && entry.status !== "paid";
}

export function buildAccountingCashSummary(entries: AdminAccountingEntry[]): AccountingCashSummary {
  const totalIncome = entries
    .filter((entry) => entry.type === "income" && entry.status === "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = entries
    .filter((entry) => entry.type === "expense" && entry.status === "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const incomeByCash = entries
    .filter((entry) => entry.type === "income" && entry.status === "paid" && normalizeAccountingPaymentMethod(entry.paymentMethod) === "cash")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expenseByCash = entries
    .filter((entry) => entry.type === "expense" && entry.status === "paid" && normalizeAccountingPaymentMethod(entry.paymentMethod) === "cash")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const receivables = entries
    .filter(isOutstandingReceivable)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const payables = entries
    .filter(isOutstandingPayable)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gstCollected = entries.reduce((sum, entry) => {
    if (entry.status !== "paid" || entry.type !== "income") return sum;
    return sum + getAccountingEntryGstPortion(entry);
  }, 0);
  const gstPaid = entries.reduce((sum, entry) => {
    if (entry.status !== "paid" || entry.type !== "expense") return sum;
    return sum + getAccountingEntryGstPortion(entry);
  }, 0);
  const gstPayable = gstCollected - gstPaid;

  return {
    totalIncome,
    totalExpense,
    incomeByCash,
    expenseByCash,
    netCashflow: totalIncome - totalExpense,
    gstCollected,
    gstPaid,
    gstPayable,
    receivables,
    payables
  };
}

export function normalizeAccountingPaymentMethod(
  paymentMethod: AdminAccountingEntry["paymentMethod"]
): "bank_transfer" | "cash" | "credit_card" | "other" {
  const normalized =
    typeof paymentMethod === "string"
      ? paymentMethod.trim().toLowerCase().replace(/[\s-]+/g, "_")
      : "";

  if (normalized === "bank_transfer" || normalized === "cash" || normalized === "credit_card") {
    return normalized;
  }
  return "other";
}

export function buildAccountingReportSummary(entries: AdminAccountingEntry[]): AccountingReportSummary {
  const base = buildAccountingCashSummary(entries);
  const paymentMethodMap = new Map<AdminAccountingEntry["paymentMethod"], AccountingPaymentMethodBreakdown>();
  const expenseCategoryMap = new Map<string, AccountingExpenseCategoryBreakdown>();
  const vehicleProfitMap = new Map<string, AccountingVehicleProfitBreakdown>();
  const customerProfitMap = new Map<string, AccountingCustomerProfitBreakdown>();

  entries.forEach((entry) => {
    if (entry.status === "paid" && (entry.type === "income" || entry.type === "expense")) {
      const normalizedPaymentMethod = normalizeAccountingPaymentMethod(entry.paymentMethod);
      const currentPaymentBreakdown = paymentMethodMap.get(normalizedPaymentMethod) ?? {
        paymentMethod: normalizedPaymentMethod,
        totalIncome: 0,
        totalExpense: 0,
        netCashflow: 0
      };
      if (entry.type === "income") {
        currentPaymentBreakdown.totalIncome += entry.amount;
      } else {
        currentPaymentBreakdown.totalExpense += entry.amount;
      }
      currentPaymentBreakdown.netCashflow = currentPaymentBreakdown.totalIncome - currentPaymentBreakdown.totalExpense;
      paymentMethodMap.set(normalizedPaymentMethod, currentPaymentBreakdown);
    }

    if (entry.type === "expense" && entry.status === "paid") {
      const category = entry.category || "Uncategorised";
      const currentExpenseBreakdown = expenseCategoryMap.get(category) ?? {
        category,
        totalExpense: 0
      };
      currentExpenseBreakdown.totalExpense += entry.amount;
      expenseCategoryMap.set(category, currentExpenseBreakdown);
    }

    if (
      entry.status === "paid"
      && (entry.type === "income" || entry.type === "expense")
      && (entry.relatedVehicleId || entry.relatedDisplayReference || entry.relatedVehicleTitle)
    ) {
      const vehicleKey = entry.relatedVehicleId || entry.relatedDisplayReference || entry.relatedVehicleTitle || "unknown-vehicle";
      const currentVehicleBreakdown = vehicleProfitMap.get(vehicleKey) ?? {
        vehicleId: entry.relatedVehicleId || "",
        displayReference: entry.relatedDisplayReference || "",
        vehicleTitle: entry.relatedVehicleTitle || "Unlinked vehicle",
        customerName: entry.relatedCustomerName || "",
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0
      };
      if (entry.type === "income") {
        currentVehicleBreakdown.totalIncome += entry.amount;
      } else {
        currentVehicleBreakdown.totalExpense += entry.amount;
      }
      if (!currentVehicleBreakdown.customerName && entry.relatedCustomerName) {
        currentVehicleBreakdown.customerName = entry.relatedCustomerName;
      }
      currentVehicleBreakdown.netProfit =
        currentVehicleBreakdown.totalIncome - currentVehicleBreakdown.totalExpense;
      vehicleProfitMap.set(vehicleKey, currentVehicleBreakdown);
    }

    if (
      entry.status === "paid"
      && (entry.type === "income" || entry.type === "expense")
      && (entry.relatedCustomerProfileId || entry.relatedCustomerName)
    ) {
      const customerKey = entry.relatedCustomerProfileId || entry.relatedCustomerName || "unknown-customer";
      const currentCustomerBreakdown = customerProfitMap.get(customerKey) ?? {
        customerId: entry.relatedCustomerProfileId || "",
        customerName: entry.relatedCustomerName || "Unassigned customer",
        totalIncome: 0,
        totalExpense: 0,
        profitContribution: 0
      };
      if (entry.type === "income") {
        currentCustomerBreakdown.totalIncome += entry.amount;
      } else {
        currentCustomerBreakdown.totalExpense += entry.amount;
      }
      currentCustomerBreakdown.profitContribution =
        currentCustomerBreakdown.totalIncome - currentCustomerBreakdown.totalExpense;
      customerProfitMap.set(customerKey, currentCustomerBreakdown);
    }
  });

  return {
    ...base,
    paymentMethodBreakdown: [...paymentMethodMap.values()].sort((left, right) => right.netCashflow - left.netCashflow),
    expenseCategoryBreakdown: [...expenseCategoryMap.values()].sort((left, right) => right.totalExpense - left.totalExpense),
    vehicleProfitBreakdown: [...vehicleProfitMap.values()].sort((left, right) => right.netProfit - left.netProfit),
    customerProfitBreakdown: [...customerProfitMap.values()].sort(
      (left, right) => right.profitContribution - left.profitContribution
    )
  };
}

export function getAccountingPaymentMethodLabel(paymentMethod: AdminAccountingEntry["paymentMethod"]) {
  const normalized = normalizeAccountingPaymentMethod(paymentMethod);
  if (normalized === "bank_transfer") return "Bank transfer";
  if (normalized === "credit_card") return "Credit card";
  if (normalized === "cash") return "Cash";
  return "Other";
}

export function getAccountingPeriodLabel(period: AccountingPeriodOption) {
  if (period === "today") return "Daily";
  if (period === "this_week") return "Weekly";
  if (period === "this_month") return "Monthly";
  if (period === "this_year") return "Yearly";
  if (period === "custom") return "Custom Date Range";
  return "All Dates";
}

export function getOutstandingDays(entry: AdminAccountingEntry) {
  if (!isOutstandingReceivable(entry) && !isOutstandingPayable(entry)) return null;
  const dateKey = getEntryMelbourneDateKey(entry);
  if (!dateKey) return null;
  const startTime = new Date(`${dateKey}T00:00:00+10:00`).getTime();
  if (!Number.isFinite(startTime)) return null;
  const todayKey = getTodayMelbourneDateKey();
  const todayTime = new Date(`${todayKey}T00:00:00+10:00`).getTime();
  return Math.max(Math.floor((todayTime - startTime) / (1000 * 60 * 60 * 24)), 0);
}

export function getOutstandingAgeLabel(daysOutstanding: number | null) {
  if (daysOutstanding == null) return null;
  if (daysOutstanding >= 60) return "60+ days";
  if (daysOutstanding >= 30) return "30+ days";
  if (daysOutstanding >= 7) return "7+ days";
  return "Current";
}

export function formatMelbourneDateHeading(dateKey: string) {
  if (!dateKey) return "Pending date";
  const parsed = new Date(`${dateKey}T12:00:00+10:00`);
  if (!Number.isFinite(parsed.getTime())) return dateKey;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(parsed);
}
