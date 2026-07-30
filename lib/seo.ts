import type { MetadataRoute } from "next";
import type { Vehicle } from "@/types";

export const PUBLIC_SITE_ORIGIN = "https://www.carnest.au";
const LOCAL_SITE_ORIGIN = "http://localhost:3000";

function normalizeOrigin(value?: string) {
  const rawUrl = value?.trim() ?? "";
  if (!rawUrl) return "";

  const urlWithProtocol = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
    ? rawUrl
    : `https://${rawUrl}`;

  try {
    return new URL(urlWithProtocol).origin;
  } catch {
    return "";
  }
}

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getSiteUrl() {
  const configuredOrigin = normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  );

  if (process.env.NODE_ENV !== "production") {
    if (configuredOrigin && isLocalDevelopmentOrigin(configuredOrigin)) {
      return configuredOrigin;
    }
    return LOCAL_SITE_ORIGIN;
  }

  return PUBLIC_SITE_ORIGIN;
}

export function buildAbsoluteUrl(pathname: string) {
  return new URL(pathname, getSiteUrl()).toString();
}

export function getVehicleSeoLocation(vehicle: Pick<Vehicle, "sellerLocationSuburb" | "sellerLocationState">) {
  return vehicle.sellerLocationSuburb || vehicle.sellerLocationState || "";
}

export function getVehicleSeoTitle(
  vehicle: Pick<Vehicle, "year" | "make" | "model" | "variant">
) {
  const baseTitle = [vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ");
  return `${baseTitle} for sale | CarNest`;
}

export function getVehicleSeoDescription(
  vehicle: Pick<
    Vehicle,
    | "year"
    | "make"
    | "model"
    | "variant"
    | "bodyType"
    | "fuelType"
    | "transmission"
    | "mileage"
    | "sellerLocationSuburb"
    | "sellerLocationState"
  >
) {
  const location = getVehicleSeoLocation(vehicle);
  const summary = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.variant,
    vehicle.bodyType,
    vehicle.fuelType,
    vehicle.transmission,
    `${vehicle.mileage.toLocaleString()} km`
  ]
    .filter(Boolean)
    .join(", ");

  return location
    ? `${summary}. Located in ${location}. View photos, vehicle details, and next steps on CarNest.`
    : `${summary}. View photos, vehicle details, and next steps on CarNest.`;
}

export function getRobotsRules(): MetadataRoute.Robots["rules"] {
  return {
    userAgent: "*",
    allow: ["/", "/inventory", "/sold", "/about", "/contact", "/faq", "/how-it-works", "/warehouse", "/sell", "/pricing-advice"],
    disallow: ["/admin", "/seller", "/dashboard", "/login", "/register"]
  };
}
