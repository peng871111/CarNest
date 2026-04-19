import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatLocation(suburb?: string, postcode?: string, state?: string) {
  return [suburb, postcode, state].filter(Boolean).join(", ") || "Location withheld";
}

function parseIsoDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getVehicleLiveTimingLabel(vehicle: { approvedAt?: string; soldAt?: string; status?: string; sellerStatus?: string }) {
  const approvedAt = parseIsoDate(vehicle.approvedAt);
  if (!approvedAt) return "Timing unavailable";

  const endDate =
    vehicle.sellerStatus === "SOLD"
      ? parseIsoDate(vehicle.soldAt)
      : vehicle.status === "approved"
        ? new Date()
        : null;

  if (!endDate) return "Timing unavailable";

  const diff = endDate.getTime() - approvedAt.getTime();
  if (diff < 0) return "Timing unavailable";

  const dayCount = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  return vehicle.sellerStatus === "SOLD" ? `Sold after ${dayCount} day${dayCount === 1 ? "" : "s"}` : `Live for ${dayCount} day${dayCount === 1 ? "" : "s"}`;
}

export function formatAdminDateTime(value?: string) {
  if (!value) return "Just now";

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
    .format(new Date(value))
    .replace(",", " ·");
}

export function formatMonthYear(value?: string) {
  if (!value) return "Recently joined";

  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatCalendarDate(value?: string) {
  if (!value) return "Not provided";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const normalized = `${value}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getVehicleDisplayReference(input: string | { id: string; displayReference?: string }) {
  if (typeof input !== "string" && input.displayReference) {
    return input.displayReference;
  }

  const id = typeof input === "string" ? input : input.id;
  const numericPart = id.match(/\d+/g)?.join("").slice(-4);

  if (numericPart) {
    return `CN-${numericPart.padStart(4, "0")}`;
  }

  const hash = Array.from(id).reduce((accumulator, character) => {
    return (accumulator * 31 + character.charCodeAt(0)) % 10000;
  }, 0);

  return `CN-${String(hash || 1).padStart(4, "0")}`;
}

export function getAccountDisplayReference(
  input: string | { id: string; accountReference?: string; role?: string }
) {
  if (typeof input !== "string" && input.accountReference) {
    return input.accountReference;
  }

  const id = typeof input === "string" ? input : input.id;
  const numericPart = id.match(/\d+/g)?.join("").slice(-3);
  const prefix = typeof input !== "string" && input.role === "seller" ? "CN-S" : "CN-U";

  if (numericPart) {
    return `${prefix}${numericPart.padStart(3, "0")}`;
  }

  const hash = Array.from(id).reduce((accumulator, character) => {
    return (accumulator * 31 + character.charCodeAt(0)) % 1000;
  }, 0);

  return `${prefix}${String(hash || 1).padStart(3, "0")}`;
}
