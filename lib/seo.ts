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

export function getVehicleSeoTitle(vehicle: Pick<Vehicle, "year" | "make" | "model" | "sellerLocationSuburb" | "sellerLocationState">) {
  const baseTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const location = getVehicleSeoLocation(vehicle);

  return location ? `${baseTitle} for sale in ${location}` : `${baseTitle} for sale`;
}

export function getVehicleSeoDescription(
  vehicle: Pick<Vehicle, "year" | "make" | "model" | "sellerLocationSuburb" | "sellerLocationState">
) {
  const baseTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const location = getVehicleSeoLocation(vehicle);

  return location
    ? `Explore this ${baseTitle} available in ${location}. View photos, details, pricing, and submit an offer on CarNest.`
    : `Explore this ${baseTitle}. View photos, details, pricing, and submit an offer on CarNest.`;
}

export function getRobotsRules(): MetadataRoute.Robots["rules"] {
  return {
    userAgent: "*",
    allow: ["/", "/inventory", "/sold", "/about", "/contact", "/faq", "/how-it-works", "/warehouse", "/sell", "/pricing-advice"],
    disallow: ["/admin", "/seller", "/dashboard", "/login", "/register"]
  };
}
