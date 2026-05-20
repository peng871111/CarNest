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
  netCashflow: number;
  gstPayable: number;
  receivables: number;
  payables: number;
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
  const receivables = entries
    .filter(isOutstandingReceivable)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const payables = entries
    .filter(isOutstandingPayable)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gstPayable = entries.reduce((sum, entry) => {
    if (entry.status !== "paid") return sum;
    const gst = getAccountingEntryGstPortion(entry);
    if (entry.type === "income") return sum + gst;
    if (entry.type === "expense") return sum - gst;
    return sum;
  }, 0);

  return {
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    gstPayable,
    receivables,
    payables
  };
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
