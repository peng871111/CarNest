"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SellerShell } from "@/components/layout/seller-shell";
import { useAuth } from "@/lib/auth";
import { getOwnedVehiclesData } from "@/lib/data";
import { getListingLabel } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { Vehicle } from "@/types";
import { SellerListingStatusBadge } from "@/components/vehicles/seller-listing-status-badge";
import { SellerVehicleStatusEditor } from "@/components/vehicles/seller-vehicle-status-editor";

function SellerVehiclesPageContent() {
  const { appUser } = useAuth();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVehicles() {
      if (!appUser || appUser.role !== "seller") return;
      const result = await getOwnedVehiclesData(appUser.id);
      if (cancelled) return;
      setVehicles(result.items);
      setError(result.error ?? "");
    }

    void loadVehicles();
    return () => {
      cancelled = true;
    };
  }, [appUser, searchParamsKey]);

  const writeStatus =
    searchParams.get("write") === "success"
      ? searchParams.get("sellerStatus")
        ? `Listing updated to ${searchParams.get("sellerStatus")}`
        : "Vehicle updated successfully"
      : "";

  return (
    <SellerShell
      title="My Vehicles"
      description="Manage your submitted vehicles, update listing details, and control whether a listing is live, paused, withdrawn, or sold."
    >
      <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Manual support</p>
            <h2 className="mt-3 font-display text-3xl text-ink">Not sure how to price your car?</h2>
            <p className="mt-4 text-sm leading-6 text-ink/65">
              Get personalised pricing advice from our team based on real market demand.
            </p>
          </div>
          <Link href="/pricing-advice" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
            Request Pricing Advice
          </Link>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <Link href="/sell" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
          Add vehicle
        </Link>
      </div>
      {writeStatus ? <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">{writeStatus}</div> : null}
      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          We couldn't load your vehicles right now. Please try again shortly.
        </div>
      ) : null}
      <section className="rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1.7fr,1fr,1fr,1fr,220px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Vehicle</span>
          <span>Listing</span>
          <span>Listing status</span>
          <span>Price</span>
          <span>Update status</span>
        </div>
        <div>
          {vehicles.length ? (
            vehicles.map((vehicle) => (
              <div key={vehicle.id} className="grid grid-cols-[1.7fr,1fr,1fr,1fr,220px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0">
                <div>
                  <p className="font-semibold text-ink">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <p className="mt-1 text-ink/55">{vehicle.description}</p>
                </div>
                <div className="text-ink/70">{getListingLabel(vehicle.listingType)}</div>
                <div>
                  <SellerListingStatusBadge vehicle={vehicle} />
                </div>
                <div className="text-ink/70">{formatCurrency(vehicle.price)}</div>
                <div className="flex flex-col items-start gap-3">
                  <Link href={`/seller/vehicles/${vehicle.id}/edit`} className="text-sm font-medium text-ink underline">
                    Edit
                  </Link>
                  <SellerVehicleStatusEditor vehicle={vehicle} />
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              No vehicles yet. Add your first listing.
            </div>
          )}
        </div>
      </section>
    </SellerShell>
  );
}

export default function SellerVehiclesPage() {
  return (
    <Suspense
      fallback={
        <SellerShell title="My Vehicles" description="Manage your submitted vehicles, update listing details, and control whether a listing is live, paused, withdrawn, or sold.">
          <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Loading vehicles...</div>
        </SellerShell>
      }
    >
      <SellerVehiclesPageContent />
    </Suspense>
  );
}
