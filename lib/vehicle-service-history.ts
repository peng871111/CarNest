import type { VehicleServiceHistoryRecord } from "@/types";

export const VEHICLE_SERVICE_HISTORY_MONTH_OPTIONS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
] as const;

export const VEHICLE_SERVICE_HISTORY_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: value };
});

function createServiceHistoryRecordId() {
  return `service-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDatePart(value?: string | null, maxLength = 2) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, maxLength) : "";
}

function parseVehicleServiceHistoryDate(record: Pick<VehicleServiceHistoryRecord, "serviceDateDay" | "serviceDateMonth" | "serviceDateYear">) {
  const day = Number(record.serviceDateDay);
  const month = Number(record.serviceDateMonth);
  const year = Number(record.serviceDateYear);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 9999) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function createEmptyVehicleServiceHistoryRecord(
  overrides?: Partial<VehicleServiceHistoryRecord>
): VehicleServiceHistoryRecord {
  return {
    id: overrides?.id || createServiceHistoryRecordId(),
    serviceDateDay: normalizeDatePart(overrides?.serviceDateDay),
    serviceDateMonth: normalizeDatePart(overrides?.serviceDateMonth),
    serviceDateYear: normalizeDatePart(overrides?.serviceDateYear, 4),
    odometer: typeof overrides?.odometer === "string" ? overrides.odometer : "",
    notes: typeof overrides?.notes === "string" ? overrides.notes : "",
  };
}

export function isVehicleServiceHistoryRecordMeaningful(record?: Partial<VehicleServiceHistoryRecord> | null) {
  if (!record) return false;

  return Boolean(
    (record.serviceDateDay ?? "").trim()
    || (record.serviceDateMonth ?? "").trim()
    || (record.serviceDateYear ?? "").trim()
    || (record.odometer ?? "").trim()
    || (record.notes ?? "").trim()
  );
}

export function sortVehicleServiceHistoryRecords(
  records: VehicleServiceHistoryRecord[],
  direction: "asc" | "desc" = "asc"
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    const leftDate = parseVehicleServiceHistoryDate(left);
    const rightDate = parseVehicleServiceHistoryDate(right);

    if (leftDate && rightDate) {
      const difference = leftDate.getTime() - rightDate.getTime();
      if (difference !== 0) return difference * multiplier;
    } else if (leftDate || rightDate) {
      return (leftDate ? -1 : 1) * multiplier;
    }

    const leftYear = left.serviceDateYear.localeCompare(right.serviceDateYear);
    if (leftYear !== 0) return leftYear * multiplier;

    const leftMonth = left.serviceDateMonth.localeCompare(right.serviceDateMonth);
    if (leftMonth !== 0) return leftMonth * multiplier;

    const leftDay = left.serviceDateDay.localeCompare(right.serviceDateDay);
    if (leftDay !== 0) return leftDay * multiplier;

    return left.id.localeCompare(right.id);
  });
}

export function formatVehicleServiceHistoryDate(record?: Partial<VehicleServiceHistoryRecord> | null) {
  if (!record) return "Not provided";

  const parsed = parseVehicleServiceHistoryDate({
    serviceDateDay: record.serviceDateDay ?? "",
    serviceDateMonth: record.serviceDateMonth ?? "",
    serviceDateYear: record.serviceDateYear ?? "",
  });
  if (parsed) {
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed);
  }

  const parts = [record.serviceDateDay, record.serviceDateMonth, record.serviceDateYear]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return parts.length ? parts.join(" / ") : "Not provided";
}

export function formatVehicleServiceHistoryOdometer(value?: string | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "Not provided";
  if (/km/i.test(normalized)) return normalized;

  const digits = normalized.replace(/[^\d]/g, "");
  if (!digits) return normalized;

  return `${Number(digits).toLocaleString("en-AU")} km`;
}
