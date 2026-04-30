import { MetadataRoute } from "next";
import { Vehicle } from "@/types";

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  return rawUrl.includes("localhost") ? `http://${rawUrl}` : `https://${rawUrl}`;
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
