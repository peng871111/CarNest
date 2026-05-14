"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getVehiclesData, getWarehouseIntakesData, saveWarehouseIntake } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatCurrency, formatAdminDateTime, getVehicleDisplayReference } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Vehicle, VehicleActor, WarehouseIntakeRecord } from "@/types";

function getIntakeStatusLabel(intake: WarehouseIntakeRecord) {
  if (intake.status === "signed") return "Signed";
  if (intake.status === "review_ready") return "Ready for agreement";
  return "Draft";
}

function isWarehouseIntakePermissionError(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("missing or insufficient permissions")
    || normalized.includes("permission-denied")
    || normalized.includes("unauthenticated");
}

function SectionCard({
  title,
  eyebrow,
  summary,
  open,
  onToggle,
  children
}: {
  title: string;
  eyebrow: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[28px] md:p-6">
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-bronze md:text-xs">{eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-ink md:text-xl">{title}</h3>
          {summary ? <p className="mt-1 text-sm text-ink/58">{summary}</p> : null}
        </div>
        <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/8 bg-shell text-ink/68">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}>
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="mt-4 md:mt-5">{children}</div> : null}
    </section>
  );
}

export function WarehouseIntakeDashboard() {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [intakes, setIntakes] = useState<WarehouseIntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sectionState, setSectionState] = useState({
    listings: false,
    recent: true
  });
  const [listingSearch, setListingSearch] = useState("");
  const [intakeSearch, setIntakeSearch] = useState("");
  const [assigningIntakeId, setAssigningIntakeId] = useState("");
  const [listingSelectionByIntakeId, setListingSelectionByIntakeId] = useState<Record<string, string>>({});
  const canManageVehicles = hasAdminPermission(appUser, "manageVehicles");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!canManageVehicles) {
        setLoading(false);
        return;
      }
      if (!firebaseUser) {
        setLoading(false);
        setErrorMessage("Admin authentication is still loading. Please refresh and try again.");
        return;
      }

      setLoading(true);

      const runLoad = async () => {
        const [vehiclesResult, intakesResult] = await Promise.all([
          getVehiclesData(),
          getWarehouseIntakesData()
        ]);
        return { vehiclesResult, intakesResult };
      };

      try {
        await firebaseUser.getIdToken();
        let { vehiclesResult, intakesResult } = await runLoad();

        if (isWarehouseIntakePermissionError(intakesResult.error)) {
          await firebaseUser.getIdToken(true);
          ({ vehiclesResult, intakesResult } = await runLoad());
        }

        if (cancelled) return;

        setVehicles(vehiclesResult.items);
        setIntakes(intakesResult.items);
        setErrorMessage(intakesResult.error && !intakesResult.items.length ? intakesResult.error : "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "We couldn't load warehouse intake records.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, canManageVehicles, firebaseUser]);

  if (!canManageVehicles) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm text-ink/60">You need vehicle-management permission to use the warehouse intake workspace.</p>
      </div>
    );
  }
  const actor = appUser
    ? ({
        id: appUser.id,
        role: appUser.role,
        email: appUser.email,
        displayName: appUser.displayName,
        name: appUser.name,
        adminPermissions: appUser.adminPermissions
      } satisfies VehicleActor)
    : null;
  const activeListings = vehicles
    .filter((vehicle) => !vehicle.deleted && vehicle.status === "approved" && vehicle.sellerStatus !== "SOLD" && vehicle.sellerStatus !== "WITHDRAWN")
    .sort((left, right) => getVehicleDisplayReference(left).localeCompare(getVehicleDisplayReference(right)));
  const listingSearchTerm = listingSearch.trim().toLowerCase();
  const filteredListings = activeListings
    .filter((vehicle) => {
      if (!listingSearchTerm) return true;
      const searchText = [
        getVehicleDisplayReference(vehicle),
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.variant,
        vehicle.rego,
        vehicle.vin,
        vehicle.customerName,
        vehicle.customerEmail
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchText.includes(listingSearchTerm);
    })
    .slice(0, 12);
  const intakeSearchTerm = intakeSearch.trim().toLowerCase();
  const filteredIntakes = [...intakes]
    .filter((intake) => {
      if (!intakeSearchTerm) return true;
      const linkedListing = intake.vehicleId ? vehicles.find((vehicle) => vehicle.id === intake.vehicleId) ?? null : null;
      const searchText = [
        intake.id,
        intake.vehicleReference,
        intake.vehicleTitle,
        intake.vehicleDetails.registrationPlate,
        intake.vehicleDetails.make,
        intake.vehicleDetails.model,
        intake.vehicleDetails.year,
        intake.ownerDetails.fullName,
        intake.ownerDetails.phone,
        intake.ownerDetails.email,
        linkedListing ? getVehicleDisplayReference(linkedListing) : ""
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchText.includes(intakeSearchTerm);
    })
    .slice(0, 24);

  async function handleAssignListing(intake: WarehouseIntakeRecord) {
    if (!actor) return;
    const nextVehicleId = listingSelectionByIntakeId[intake.id] ?? intake.vehicleId ?? "";
    const linkedListing = activeListings.find((vehicle) => vehicle.id === nextVehicleId) ?? null;
    if (!nextVehicleId || !linkedListing) return;

    const { id: _id, updatedAt: _updatedAt, photoCount: _photoCount, ...input } = intake;

    try {
      setAssigningIntakeId(intake.id);
      setErrorMessage("");
      const result = await saveWarehouseIntake(
        {
          ...input,
          vehicleId: linkedListing.id,
          vehicleReference: getVehicleDisplayReference(linkedListing),
          vehicleTitle: `${linkedListing.year} ${linkedListing.make} ${linkedListing.model} ${linkedListing.variant}`.trim()
        },
        actor,
        intake.id
      );
      setIntakes((current) =>
        current
          .map((item) => (item.id === intake.id ? result.intake : item))
          .sort((left, right) => (right.updatedAt ?? right.createdAt ?? "").localeCompare(left.updatedAt ?? left.createdAt ?? ""))
      );
      setListingSelectionByIntakeId((current) => ({ ...current, [intake.id]: linkedListing.id }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't link that intake to the selected listing.");
    } finally {
      setAssigningIntakeId("");
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[28px] md:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">iPad workflow</p>
          <h2 className="mt-2 font-display text-2xl text-ink md:text-3xl">Warehouse Intake & Storage</h2>
          <p className="mt-2 text-sm text-ink/58">Use an existing listing to start paperwork, or reopen a recent intake to continue it.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
        {[
          ["Intake events", String(intakes.length)],
          ["Active listings", String(activeListings.length)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[22px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[24px] md:p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      {errorMessage ? (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <SectionCard
          eyebrow="Active listings"
          title="Attach onboarding to an existing listing"
          summary={`${activeListings.length} listings available`}
          open={sectionState.listings}
          onToggle={() => setSectionState((current) => ({ ...current, listings: !current.listings }))}
        >
          <div className="space-y-3">
            <input
              value={listingSearch}
              onChange={(event) => setListingSearch(event.target.value)}
              placeholder="Search CN/listing ID, make, model, rego, VIN, or customer"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
            />
            {filteredListings.map((vehicle) => (
              <div key={vehicle.id} className="rounded-[20px] border border-black/5 bg-shell p-4 md:rounded-[24px]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-bronze">{getVehicleDisplayReference(vehicle)}</p>
                    <h4 className="mt-1 text-base font-semibold text-ink">
                      {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.variant}
                    </h4>
                    <p className="mt-1 text-sm text-ink/62">
                      {formatCurrency(vehicle.price)} · {vehicle.mileage.toLocaleString()} km · {vehicle.rego || "Rego pending"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-3">
                    <Link
                      href={`/admin/warehouse-intake/new?vehicleId=${vehicle.id}`}
                      className="rounded-full bg-ink px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-ink/92"
                    >
                      Start intake
                    </Link>
                    <Link
                      href={`/admin/vehicles/${vehicle.id}`}
                      className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                    >
                      View listing
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {!filteredListings.length && !loading ? (
              <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm leading-6 text-ink/60 md:rounded-[24px] md:px-5 md:py-8">
                No active listings match this search right now.
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Intake contracts"
          title="Recent intake records"
          summary={`${intakes.length} records available to continue`}
          open={sectionState.recent}
          onToggle={() => setSectionState((current) => ({ ...current, recent: !current.recent }))}
        >
          <div className="space-y-3">
            <input
              value={intakeSearch}
              onChange={(event) => setIntakeSearch(event.target.value)}
              placeholder="Search rego, make, model, year, customer, phone, email, CN/listing ID, or intake reference"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
            />
            {filteredIntakes.map((intake) => {
              const linkedListing = intake.vehicleId ? activeListings.find((vehicle) => vehicle.id === intake.vehicleId) ?? vehicles.find((vehicle) => vehicle.id === intake.vehicleId) ?? null : null;
              const signatureReady = Boolean(intake.signature.signatureStoragePath && intake.signature.signedAt);
              const pdfReady = Boolean(intake.signedPdfStoragePath);
              const selectedListingId = listingSelectionByIntakeId[intake.id] ?? intake.vehicleId ?? "";

              return (
                <div
                  key={intake.id}
                  className="rounded-[20px] border border-black/6 bg-shell px-4 py-4 md:rounded-[22px]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">{intake.vehicleReference || intake.id}</p>
                      <h4 className="mt-1 text-sm font-semibold text-ink">
                        {intake.ownerDetails.fullName || intake.ownerDetails.email || "Customer pending"} · {intake.vehicleDetails.year || "Year pending"} {intake.vehicleDetails.make} {intake.vehicleDetails.model}
                      </h4>
                      <p className="mt-1 text-sm text-ink/58">
                        {intake.vehicleDetails.registrationPlate || "Rego pending"} · Listing {linkedListing ? getVehicleDisplayReference(linkedListing) : "Not linked"}
                      </p>
                      <p className="mt-1 text-xs text-ink/52">
                        {intake.ownerDetails.phone || "Phone pending"} · {intake.ownerDetails.email || "Email pending"} · {formatAdminDateTime(intake.updatedAt || intake.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${signatureReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                        {signatureReady ? "Signature captured" : "Signature pending"}
                      </span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${pdfReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-black/8 bg-white text-ink/62"}`}>
                        {pdfReady ? "PDF ready" : "PDF pending"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr),auto]">
                    <select
                      value={selectedListingId}
                      onChange={(event) => setListingSelectionByIntakeId((current) => ({ ...current, [intake.id]: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
                    >
                      <option value="">No linked listing</option>
                      {activeListings.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {getVehicleDisplayReference(vehicle)} · {vehicle.year} {vehicle.make} {vehicle.model}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/admin/warehouse-intake/${intake.id}`}
                        className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                      >
                        Continue intake
                      </Link>
                      <Link
                        href={`/admin/warehouse-intake/${intake.id}`}
                        className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                      >
                        {pdfReady ? "View PDF" : "Generate PDF"}
                      </Link>
                      <button
                        type="button"
                        disabled={!selectedListingId || assigningIntakeId === intake.id}
                        onClick={() => void handleAssignListing(intake)}
                        className="rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {assigningIntakeId === intake.id ? "Saving..." : linkedListing ? "Change listing" : "Assign listing"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!filteredIntakes.length && !loading ? (
              <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm leading-6 text-ink/60 md:rounded-[24px] md:px-5 md:py-8">
                No intake contracts match this search right now.
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
