"use client";

import Link from "next/link";
import { KeyboardEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SellerShell } from "@/components/layout/seller-shell";
import { useAuth } from "@/lib/auth";
import { getOwnedVehiclesData, updateVehicle } from "@/lib/data";
import { getListingLabel } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { Vehicle, VehicleFormInput } from "@/types";
import { ListingTrendsPanel } from "@/components/analytics/listing-trends-panel";
import { SellerListingStatusBadge } from "@/components/vehicles/seller-listing-status-badge";
import { SellerVehicleStatusEditor } from "@/components/vehicles/seller-vehicle-status-editor";
import { Input } from "@/components/ui/input";

function buildVehicleFormInput(vehicle: Vehicle, price: number): VehicleFormInput {
  return {
    listingType: vehicle.listingType,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    price,
    mileage: vehicle.mileage,
    transmission: vehicle.transmission,
    fuelType: vehicle.fuelType,
    drivetrain: vehicle.drivetrain,
    bodyType: vehicle.bodyType,
    colour: vehicle.colour,
    serviceHistory: vehicle.serviceHistory ?? "",
    keyCount: vehicle.keyCount ?? "",
    sellerLocationSuburb: vehicle.sellerLocationSuburb ?? "",
    sellerLocationState: vehicle.sellerLocationState ?? "",
    description: vehicle.description,
    coverImage: vehicle.coverImage ?? vehicle.coverImageUrl ?? vehicle.imageUrls[0] ?? vehicle.images[0] ?? "",
    coverImageUrl: vehicle.coverImageUrl ?? vehicle.imageUrls[0] ?? vehicle.images[0] ?? "",
    imageUrls: vehicle.imageUrls?.length ? vehicle.imageUrls : vehicle.images,
    images: vehicle.imageUrls?.length ? vehicle.imageUrls : vehicle.images,
    submissionPreference: vehicle.submissionPreference,
    serviceQuoteNotes: vehicle.serviceQuoteNotes ?? ""
  };
}

function SellerVehiclesPageContent() {
  const { appUser } = useAuth();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState("");
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const [editingPriceVehicleId, setEditingPriceVehicleId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [savingPriceVehicleId, setSavingPriceVehicleId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVehicles() {
      if (!appUser || (appUser.role !== "seller" && appUser.role !== "buyer")) return;
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

  function beginPriceEdit(vehicle: Vehicle) {
    if (!appUser || appUser.role !== "seller") return;
    setWorkspaceNotice("");
    setEditingPriceVehicleId(vehicle.id);
    setPriceDraft(String(vehicle.price));
  }

  function cancelPriceEdit(vehicle: Vehicle) {
    setEditingPriceVehicleId(null);
    setPriceDraft(String(vehicle.price));
  }

  async function savePrice(vehicle: Vehicle) {
    if (!appUser || appUser.role !== "seller") return;

    const normalizedPrice = Number(priceDraft.trim());
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      setWorkspaceNotice("Please enter a valid listing price.");
      return;
    }

    if (normalizedPrice === vehicle.price) {
      setEditingPriceVehicleId(null);
      return;
    }

    setSavingPriceVehicleId(vehicle.id);
    setWorkspaceNotice("");

    try {
      const result = await updateVehicle(vehicle.id, buildVehicleFormInput(vehicle, normalizedPrice), appUser, vehicle);
      setVehicles((current) => current.map((item) => (item.id === vehicle.id ? result.vehicle : item)));
      setEditingPriceVehicleId(null);
      setWorkspaceNotice("Listing price updated.");
    } catch (priceError) {
      setWorkspaceNotice(priceError instanceof Error ? priceError.message : "We couldn't update the listing price.");
    } finally {
      setSavingPriceVehicleId(null);
    }
  }

  async function handlePriceKeyDown(event: KeyboardEvent<HTMLInputElement>, vehicle: Vehicle) {
    if (event.key === "Enter") {
      event.preventDefault();
      await savePrice(vehicle);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelPriceEdit(vehicle);
    }
  }

  return (
    <SellerShell
      title="My Vehicles"
      description="Manage your vehicles, revisit saved listings, and keep your CarNest activity in one place."
      allowedRoles={["seller", "buyer"]}
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
        <Link href="/dashboard/saved" className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink">
          Saved Vehicles
        </Link>
        <Link href="/sell" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
          Add vehicle
        </Link>
      </div>
      {writeStatus || workspaceNotice ? (
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">{workspaceNotice || writeStatus}</div>
      ) : null}
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
                <div className="text-ink/70">
                  {editingPriceVehicleId === vehicle.id ? (
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={priceDraft}
                      onChange={(event) => setPriceDraft(event.target.value)}
                      onKeyDown={(event) => void handlePriceKeyDown(event, vehicle)}
                      onBlur={() => cancelPriceEdit(vehicle)}
                      autoFocus
                      disabled={savingPriceVehicleId === vehicle.id}
                      className="h-11 rounded-[18px] px-3 py-2"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginPriceEdit(vehicle)}
                      disabled={appUser?.role !== "seller" || savingPriceVehicleId === vehicle.id}
                      className="rounded-[18px] px-2 py-1 text-left text-sm font-medium text-ink transition hover:bg-shell disabled:cursor-default disabled:px-0 disabled:hover:bg-transparent"
                    >
                      {formatCurrency(vehicle.price)}
                    </button>
                  )}
                </div>
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
      {appUser ? <ListingTrendsPanel ownerUid={appUser.id} vehicles={vehicles} /> : null}
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
