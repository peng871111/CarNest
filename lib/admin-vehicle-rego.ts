const MELBOURNE_TIMEZONE = "Australia/Melbourne";
const DAY_MS = 24 * 60 * 60 * 1000;

export const REGO_EXPIRING_VEHICLES_FILTER = "Rego Expiring (Within 30 Days)" as const;

export type RegoExpiryReminder = {
  status: "expired" | "urgent" | "expiring";
  expiryDateKey: string;
  daysUntilExpiry: number;
  label: string;
};

type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

function getCalendarDateParts(dateKey: string): CalendarDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function toCalendarTimestamp({ year, month, day }: CalendarDateParts) {
  return Date.UTC(year, month - 1, day);
}

function getDayLabel(dayCount: number, suffix: string) {
  return `${dayCount} day${dayCount === 1 ? "" : "s"} ${suffix}`;
}

export function getMelbourneCalendarDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

export function getRegoExpiryDateKey(regoExpiry?: string) {
  const dateKey = regoExpiry?.trim() ?? "";
  return getCalendarDateParts(dateKey) ? dateKey : null;
}

export function getRegoExpiryReminder(regoExpiry?: string, todayKey = getMelbourneCalendarDateKey()): RegoExpiryReminder | null {
  const expiryDateKey = getRegoExpiryDateKey(regoExpiry);
  const expiryParts = expiryDateKey ? getCalendarDateParts(expiryDateKey) : null;
  const todayParts = getCalendarDateParts(todayKey);
  if (!expiryDateKey || !expiryParts || !todayParts) return null;

  const daysUntilExpiry = Math.round((toCalendarTimestamp(expiryParts) - toCalendarTimestamp(todayParts)) / DAY_MS);
  if (daysUntilExpiry < 0) {
    return {
      status: "expired",
      expiryDateKey,
      daysUntilExpiry,
      label: `EXPIRED · ${getDayLabel(Math.abs(daysUntilExpiry), "ago")}`
    };
  }
  if (daysUntilExpiry <= 7) {
    return {
      status: "urgent",
      expiryDateKey,
      daysUntilExpiry,
      label: daysUntilExpiry === 0 ? "URGENT · Today" : `URGENT · ${getDayLabel(daysUntilExpiry, "left")}`
    };
  }
  if (daysUntilExpiry <= 30) {
    return {
      status: "expiring",
      expiryDateKey,
      daysUntilExpiry,
      label: `EXPIRING · ${getDayLabel(daysUntilExpiry, "left")}`
    };
  }
  return null;
}

export function isRegoExpiringWithinThirtyDays(regoExpiry?: string, todayKey = getMelbourneCalendarDateKey()) {
  return Boolean(getRegoExpiryReminder(regoExpiry, todayKey));
}

export function compareRegoExpiryDateKeys(left?: string, right?: string) {
  const leftDateKey = getRegoExpiryDateKey(left);
  const rightDateKey = getRegoExpiryDateKey(right);
  if (leftDateKey && rightDateKey) return leftDateKey.localeCompare(rightDateKey);
  if (leftDateKey) return -1;
  if (rightDateKey) return 1;
  return 0;
}
