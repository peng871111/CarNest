"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { VehicleInsightsPanel } from "@/components/analytics/vehicle-insights-panel";
import { VehicleForm } from "@/components/forms/vehicle-form";
import { SellerShell } from "@/components/layout/seller-shell";
import { SellerVehicleActions } from "@/components/vehicles/seller-vehicle-actions";
import { SellerVehicleStatusBadge } from "@/components/vehicles/seller-vehicle-status-badge";
import { useAuth } from "@/lib/auth";
import { createQuoteRequest, getVehicleById, getVehicleWarehouseQuoteRequest } from "@/lib/data";
import { Vehicle } from "@/types";

function SellerEditVehiclePageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const { appUser } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [error, setError] = useState("");
  const [quoteNotice, setQuoteNotice] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteRequested, setQuoteRequested] = useState(false);
  const writeStatus =
    searchParams.get("write") === "success"
      ? searchParams.get("sellerStatus")
        ? `Listing updated to ${searchParams.get("sellerStatus")?.replaceAll("_", " ").toLowerCase()}.`
        : "Vehicle updated successfully."
      : "";

  useEffect(() => {
    let cancelled = false;

    async function loadVehicle() {
      if (!appUser || appUser.role !== "seller" || !params?.id) return;

      const item = await getVehicleById(params.id);
      if (cancelled) return;

      if (!item) {
        setError("Vehicle not found.");
        setLoadingVehicle(false);
        return;
      }

      if (item.ownerUid !== appUser.id) {
        setError("You cannot edit a vehicle you do not own.");
        setLoadingVehicle(false);
        return;
      }

      setVehicle(item);
      const existingQuote = await getVehicleWarehouseQuoteRequest(item.id, appUser.id);
      if (!cancelled && existingQuote) {
        setQuoteRequested(true);
        setQuoteNotice("Quote request already submitted. Our team will contact you shortly.");
      }
      setLoadingVehicle(false);
    }

    void loadVehicle();
    return () => {
      cancelled = true;
    };
  }, [appUser, params?.id, searchParamsKey]);

  return (
    <SellerShell
      title="Edit Vehicle"
      description="Update your listing details, manage availability, and request support when you want a more guided selling experience."
    >
      {loadingVehicle ? <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Loading vehicle...</div> : null}
      {error ? <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">{error}</div> : null}
      {writeStatus ? <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">{writeStatus}</div> : null}
      {!loadingVehicle && !error && vehicle ? (
        <>
          <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.26em] text-bronze">Listing availability</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <SellerVehicleStatusBadge status={vehicle.sellerStatus} />
                <p className="text-sm leading-6 text-ink/68">
                  Control whether this approved listing is live, paused, withdrawn, or marked sold.
                </p>
              </div>
              <SellerVehicleActions vehicle={vehicle} redirectPath={`/seller/vehicles/${vehicle.id}/edit`} />
            </div>
          </section>
          <VehicleInsightsPanel vehicleId={vehicle.id} sellerOwnerUid={vehicle.ownerUid} audience="seller" />
          <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.26em] text-bronze">Need help selling?</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Request Secure Warehouse Storage Quote</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/68">
              If you'd like CarNest to assist with secure warehouse storage, flexible inspections, and a more managed selling process, you can request a tailored quote below.
            </p>
            {quoteNotice ? <div className="mt-5 rounded-[22px] border border-sand bg-shell px-4 py-3 text-sm leading-6 text-ink/75">{quoteNotice}</div> : null}
            <div className="mt-6">
              <button
                type="button"
                disabled={quoteBusy || quoteRequested}
                onClick={async () => {
                  if (!appUser || !vehicle) return;
                  setQuoteBusy(true);
                  setQuoteNotice("");

                  try {
                    const existingQuote = await getVehicleWarehouseQuoteRequest(vehicle.id, appUser.id);
                    if (existingQuote) {
                      setQuoteRequested(true);
                      setQuoteNotice("Quote request already submitted. Our team will contact you shortly.");
                      return;
                    }

                    await createQuoteRequest({
                      ownerId: appUser.id,
                      sellerUid: appUser.id,
                      sellerName: appUser.displayName,
                      sellerEmail: appUser.email,
                      vehicleId: vehicle.id,
                      vehicleYear: vehicle.year,
                      vehicleMake: vehicle.make,
                      vehicleModel: vehicle.model,
                      quoteType: "WAREHOUSE_UPGRADE",
                      source: "seller_edit",
                      notes: "Requested secure warehouse storage and assisted sale support from seller edit page."
                    });

                    setQuoteRequested(true);
                    setQuoteNotice("Your request has been sent. CarNest will contact you to arrange secure warehouse storage and assisted sale.");
                  } catch (quoteError) {
                    setQuoteNotice("Something went wrong. Please try again.");
                  } finally {
                    setQuoteBusy(false);
                  }
                }}
                className="rounded-full border border-ink bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-shell disabled:cursor-not-allowed disabled:opacity-60"
              >
                {quoteBusy ? "Sending..." : "Request Secure Warehouse Storage Quote"}
              </button>
            </div>
          </section>
          <VehicleForm vehicle={vehicle} listingTypeReadOnly />
        </>
      ) : null}
    </SellerShell>
  );
}

export default function SellerEditVehiclePage() {
  return (
    <Suspense
      fallback={
        <SellerShell title="Edit Vehicle" description="Update your listing details, manage availability, and request support when you want a more guided selling experience.">
          <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Loading vehicle...</div>
        </SellerShell>
      }
    >
      <SellerEditVehiclePageContent />
    </Suspense>
  );
}
