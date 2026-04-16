"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { recordVehicleViewEvent } from "@/lib/data";
import { ListingType } from "@/types";

function getOrCreateSessionId() {
  if (typeof window === "undefined") {
    return `server-${Date.now()}`;
  }

  const existing = window.localStorage.getItem("carnest-session-id");
  if (existing) return existing;

  const created = `cn-session-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  window.localStorage.setItem("carnest-session-id", created);
  return created;
}

function inferDeviceType() {
  if (typeof navigator === "undefined") return "desktop" as const;

  const userAgent = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(userAgent)) return "tablet" as const;
  if (/mobi|iphone|android/.test(userAgent)) return "mobile" as const;
  return "desktop" as const;
}

function deriveCountryFallback() {
  if (typeof navigator === "undefined") return "";

  const locale = navigator.language || "";
  const region = locale.split("-")[1];
  if (!region) return "";

  try {
    const formatter = new Intl.DisplayNames(["en"], { type: "region" });
    return formatter.of(region) || region;
  } catch {
    return region;
  }
}

function deriveSource(searchParamSource: string | null) {
  if (searchParamSource) return searchParamSource;
  if (typeof document === "undefined" || !document.referrer) return "direct";

  try {
    const referrerUrl = new URL(document.referrer);
    if (referrerUrl.origin === window.location.origin) {
      return referrerUrl.pathname.startsWith("/inventory") ? "inventory" : "internal";
    }

    return referrerUrl.hostname.replace(/^www\./, "");
  } catch {
    return "direct";
  }
}

interface VehicleViewTrackerProps {
  vehicleId: string;
  sellerOwnerUid: string;
  listingType: ListingType;
  country?: string;
  state?: string;
  city?: string;
}

export function VehicleViewTracker({
  vehicleId,
  sellerOwnerUid,
  listingType,
  country,
  state,
  city
}: VehicleViewTrackerProps) {
  const { appUser, loading } = useAuth();
  const searchParams = useSearchParams();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (loading || hasTracked.current) return;

    hasTracked.current = true;

    void recordVehicleViewEvent({
      vehicleId,
      sessionId: getOrCreateSessionId(),
      userId: appUser?.id,
      role: appUser?.role ?? "guest",
      source: deriveSource(searchParams.get("source")),
      referrer: typeof document === "undefined" ? "" : document.referrer || "",
      deviceType: inferDeviceType(),
      country: country || deriveCountryFallback(),
      state: state || "",
      city: city || "",
      listingType,
      sellerOwnerUid
    });
  }, [appUser?.id, appUser?.role, city, country, listingType, loading, searchParams, sellerOwnerUid, state, vehicleId]);

  return null;
}
