"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { archiveVehicleRecord, getCustomerProfilesData, getVehicleRecordsData, getVehiclesData, getWarehouseIntakesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { getVehicleImage } from "@/lib/permissions";
import { formatCurrency, formatAdminDateTime, getVehicleDisplayReference } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { CustomerProfile, Vehicle, VehicleActor, VehicleRecord, WarehouseIntakeRecord } from "@/types";
import { PublicVehicleImage } from "@/components/vehicles/public-vehicle-image";

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

function hasAnyWarehousePermissionError(messages: Array<string | undefined>) {
  return messages.some((message) => isWarehouseIntakePermissionError(message));
}

function getVehicleRecordLabel(record: VehicleRecord | null | undefined) {
  if (!record) return "Pending vehicle record";
  const title = record.title?.trim();
  if (title) return title;
  return [record.year, record.make, record.model].filter(Boolean).join(" ").trim() || "Vehicle record";
}

function getCustomerProfileLabel(profile: CustomerProfile | null | undefined) {
  if (!profile) return "Pending customer profile";
  return profile.fullName || profile.email || "Customer profile";
}

function StatusPill({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" }) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-black/8 bg-shell text-ink/68";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
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
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sectionState, setSectionState] = useState({
    relationships: true,
    customerTree: false,
    listings: false,
    recent: true
  });
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [archivingRecordId, setArchivingRecordId] = useState("");
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
        const [vehiclesResult, intakesResult, customerProfilesResult, vehicleRecordsResult] = await Promise.all([
          getVehiclesData(),
          getWarehouseIntakesData(),
          getCustomerProfilesData(),
          getVehicleRecordsData()
        ]);
        return { vehiclesResult, intakesResult, customerProfilesResult, vehicleRecordsResult };
      };

      try {
        await firebaseUser.getIdToken();
        let { vehiclesResult, intakesResult, customerProfilesResult, vehicleRecordsResult } = await runLoad();

        if (
          hasAnyWarehousePermissionError([
            intakesResult.error,
            customerProfilesResult.error,
            vehicleRecordsResult.error
          ])
        ) {
          await firebaseUser.getIdToken(true);
          ({ vehiclesResult, intakesResult, customerProfilesResult, vehicleRecordsResult } = await runLoad());
        }

        if (cancelled) return;

        setVehicles(vehiclesResult.items);
        setIntakes(intakesResult.items);
        setCustomerProfiles(customerProfilesResult.items);
        setVehicleRecords(vehicleRecordsResult.items);
        const firstPrivateError = intakesResult.error || customerProfilesResult.error || vehicleRecordsResult.error || "";
        setErrorMessage(firstPrivateError && !intakesResult.items.length && !customerProfilesResult.items.length && !vehicleRecordsResult.items.length ? firstPrivateError : "");
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

  const recentVehicles = vehicles.slice(0, 8);
  const customerProfileMap = new Map(customerProfiles.map((profile) => [profile.id, profile]));
  const vehicleRecordMap = new Map(vehicleRecords.map((record) => [record.id, record]));
  const listingMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const intakeCountsByVehicleRecordId = new Map<string, number>();
  for (const intake of intakes) {
    if (!intake.vehicleRecordId) continue;
    intakeCountsByVehicleRecordId.set(intake.vehicleRecordId, (intakeCountsByVehicleRecordId.get(intake.vehicleRecordId) ?? 0) + 1);
  }
  const relationshipSnapshots = intakes.slice(0, 6).map((intake) => ({
    intake,
    customerProfile: intake.customerProfileId ? customerProfileMap.get(intake.customerProfileId) ?? null : null,
    vehicleRecord: intake.vehicleRecordId ? vehicleRecordMap.get(intake.vehicleRecordId) ?? null : null,
    listing: intake.vehicleId ? listingMap.get(intake.vehicleId) ?? null : null
  }));
  const customerRelationshipCards = customerProfiles.slice(0, 6).map((profile) => {
    const records = vehicleRecords.filter((record) => record.customerProfileId === profile.id);
    return {
      profile,
      activeRecordCount: records.filter((record) => record.status !== "archived").length,
      archivedRecordCount: records.filter((record) => record.status === "archived").length,
      records: records.map((record) => ({
        record,
        listing: record.publicListingId ? listingMap.get(record.publicListingId) ?? null : null,
        intakeCount: intakeCountsByVehicleRecordId.get(record.id) ?? 0
      }))
    };
  });

  async function handleArchiveVehicleRecord(record: VehicleRecord, intakeCount: number) {
    if (!appUser) return;
    const actor = appUser as VehicleActor;
    const message = [
      `Archive ${getVehicleRecordLabel(record)}?`,
      "",
      "This removes it from the active customer relationship list only.",
      record.publicListingId ? "The linked public listing will stay untouched." : "No public listing will be deleted.",
      intakeCount ? `Existing intake history (${intakeCount}) will be preserved.` : "No intake history will be deleted."
    ].join("\n");

    if (!window.confirm(message)) {
      return;
    }

    setArchivingRecordId(record.id);
    setErrorMessage("");

    try {
      await archiveVehicleRecord(record.id, actor);
      setVehicleRecords((current) => current.map((item) => (item.id === record.id ? { ...item, status: "archived" } : item)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't archive this vehicle record right now.");
    } finally {
      setArchivingRecordId("");
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[28px] md:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">iPad workflow</p>
          <h2 className="mt-2 font-display text-2xl text-ink md:text-3xl">Warehouse Intake & Storage</h2>
          <p className="mt-2 text-sm text-ink/58">Customer profiles, vehicle records, intake events, signatures, and PDFs.</p>
        </div>
        <Link
          href="/admin/warehouse-intake/new"
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92"
        >
          Start customer onboarding
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
        {[
          ["Customer profiles", String(customerProfiles.length)],
          ["Vehicle records", String(vehicleRecords.length)],
          ["Intake events", String(intakes.length)],
          ["Public listings", String(vehicles.length)]
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

      <SectionCard
        eyebrow="Relationship tree"
        title="Customer, vehicle, intake, and listing links"
        summary="Quick operational view of the latest linked records."
        open={sectionState.relationships}
        onToggle={() => setSectionState((current) => ({ ...current, relationships: !current.relationships }))}
      >
        <div className="grid gap-3 xl:grid-cols-2 md:gap-4">
          {relationshipSnapshots.map(({ intake, customerProfile, vehicleRecord, listing }) => (
            <Link
              key={intake.id}
              href={`/admin/warehouse-intake/${intake.id}`}
              className="rounded-[20px] border border-black/6 bg-shell px-4 py-4 transition hover:border-[#C6A87D]/35 hover:bg-white md:rounded-[24px] md:px-5 md:py-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">{intake.id}</p>
                <StatusPill
                  label={getIntakeStatusLabel(intake)}
                  tone={intake.status === "signed" ? "success" : intake.status === "review_ready" ? "warning" : "default"}
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[16px] border border-black/6 bg-white/80 px-4 py-3 md:rounded-[18px]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">Customer profile</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{getCustomerProfileLabel(customerProfile)}</p>
                  <p className="mt-1 text-xs text-ink/58">{customerProfile?.email || intake.ownerDetails.email || "Email pending"}</p>
                </div>

                <div className="rounded-[16px] border border-black/6 bg-white/80 px-4 py-3 md:rounded-[18px]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">Vehicle record</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{getVehicleRecordLabel(vehicleRecord)}</p>
                  <p className="mt-1 text-xs text-ink/58">{vehicleRecord?.registrationPlate || intake.vehicleDetails.registrationPlate || "Registration pending"}</p>
                </div>

                <div className="rounded-[16px] border border-black/6 bg-white/80 px-4 py-3 md:rounded-[18px]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">Public listing</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {listing ? `${listing.year} ${listing.make} ${listing.model}` : intake.vehicleTitle || "Not linked yet"}
                  </p>
                  <p className="mt-1 text-xs text-ink/58">{listing ? getVehicleDisplayReference(listing) : "Standalone onboarding record"}</p>
                </div>

                <div className="rounded-[16px] border border-black/6 bg-white/80 px-4 py-3 md:rounded-[18px]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">Latest activity</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatAdminDateTime(intake.updatedAt || intake.createdAt)}</p>
                  <p className="mt-1 text-xs text-ink/58">{intake.photos.length} photos, PDF {intake.signedPdfStoragePath ? "ready" : "pending"}</p>
                </div>
              </div>
            </Link>
          ))}

          {!relationshipSnapshots.length && !loading ? (
            <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm leading-6 text-ink/60 md:rounded-[24px] md:px-5 md:py-8 xl:col-span-2">
              Relationship snapshots will appear here as soon as customer onboarding and warehouse intake events are saved.
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Customer relationships"
        title="Customer → vehicles → intake history → listing status"
        summary="Open each customer only when you need to review or clean up records."
        open={sectionState.customerTree}
        onToggle={() => setSectionState((current) => ({ ...current, customerTree: !current.customerTree }))}
      >
        <div className="grid gap-3 xl:grid-cols-2 md:gap-4">
          {customerRelationshipCards.map(({ profile, records, activeRecordCount, archivedRecordCount }) => {
            const customerExpanded = expandedCustomers[profile.id] ?? false;
            const visibleRecords = records.filter(({ record }) => record.status !== "archived");

            return (
              <div key={profile.id} className="rounded-[20px] border border-black/6 bg-shell px-4 py-4 md:rounded-[24px] md:px-5 md:py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-ink">{getCustomerProfileLabel(profile)}</h4>
                    <p className="mt-1 text-sm text-ink/58">{profile.phone || "Phone pending"} · {profile.preferredContactMethod.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs text-ink/50">
                      {activeRecordCount} active vehicle{activeRecordCount === 1 ? "" : "s"}
                      {archivedRecordCount ? ` · ${archivedRecordCount} archived` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedCustomers((current) => ({ ...current, [profile.id]: !customerExpanded }))}
                    className="rounded-full border border-black/8 bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                  >
                    {customerExpanded ? "Hide vehicles" : "Show vehicles"}
                  </button>
                </div>

                {customerExpanded ? (
                  <div className="mt-4 space-y-3">
                    {visibleRecords.map(({ record, listing, intakeCount }) => (
                      <div key={record.id} className="rounded-[16px] border border-black/6 bg-white/85 px-4 py-3 md:rounded-[18px]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">{getVehicleRecordLabel(record)}</p>
                            <p className="mt-1 text-xs text-ink/58">
                              Intake history: {intakeCount} event{intakeCount === 1 ? "" : "s"} · Public listing: {listing ? getVehicleDisplayReference(listing) : "Not linked"}
                            </p>
                          </div>
                          <StatusPill label={record.status === "archived" ? "Archived" : "Active"} tone={record.status === "archived" ? "warning" : "default"} />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={record.publicListingId ? `/admin/warehouse-intake/new?vehicleId=${record.publicListingId}` : "/admin/warehouse-intake/new"}
                            className="rounded-full border border-black/8 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                          >
                            Start intake
                          </Link>
                          <button
                            type="button"
                            disabled={archivingRecordId === record.id}
                            onClick={() => void handleArchiveVehicleRecord(record, intakeCount)}
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {archivingRecordId === record.id ? "Archiving..." : "Archive duplicate"}
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] text-ink/48">Archives this private record only. Public listings and intake history stay preserved.</p>
                      </div>
                    ))}
                    {!visibleRecords.length ? (
                      <div className="rounded-[16px] border border-dashed border-black/10 bg-white/80 px-4 py-4 text-sm text-ink/58 md:rounded-[18px]">
                        No active vehicle records linked right now.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          {!customerRelationshipCards.length && !loading ? (
            <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm leading-6 text-ink/60 md:rounded-[24px] md:px-5 md:py-8 xl:col-span-2">
              Customer relationship cards will appear here as soon as the first reusable customer profile is saved.
            </div>
          ) : null}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <SectionCard
          eyebrow="Optional public listing links"
          title="Attach onboarding to an existing listing"
          summary={`${vehicles.length} listings available`}
          open={sectionState.listings}
          onToggle={() => setSectionState((current) => ({ ...current, listings: !current.listings }))}
        >
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {recentVehicles.map((vehicle) => (
              <div key={vehicle.id} className="overflow-hidden rounded-[20px] border border-black/5 bg-shell md:rounded-[24px]">
                <div className="relative aspect-[16/10]">
                  <PublicVehicleImage
                    src={getVehicleImage(vehicle)}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    loading="lazy"
                    sizes="(max-width: 767px) 100vw, 40vw"
                    className="object-cover object-center"
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-bronze">{getVehicleDisplayReference(vehicle)}</p>
                    <h4 className="mt-1 text-base font-semibold text-ink">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h4>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-ink/62">
                    <span>{formatCurrency(vehicle.price)}</span>
                    <span>{vehicle.mileage.toLocaleString()} km</span>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/admin/warehouse-intake/new?vehicleId=${vehicle.id}`}
                      className="flex-1 rounded-full bg-ink px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-ink/92"
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
            {!recentVehicles.length && !loading ? (
              <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm leading-6 text-ink/60 md:rounded-[24px] md:px-5 md:py-8">
                No listings are ready yet. You can still start a standalone intake and attach it later.
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Existing records"
          title="Recent intake records"
          summary={`${intakes.length} records`}
          open={sectionState.recent}
          onToggle={() => setSectionState((current) => ({ ...current, recent: !current.recent }))}
        >
          <div className="space-y-3">
            {intakes.slice(0, 10).map((intake) => (
              <Link
                key={intake.id}
                href={`/admin/warehouse-intake/${intake.id}`}
                className="block rounded-[20px] border border-black/6 bg-shell px-4 py-4 transition hover:border-[#C6A87D]/35 hover:bg-white md:rounded-[22px]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">{intake.vehicleReference || intake.id}</p>
                    <h4 className="mt-1 text-sm font-semibold text-ink">{intake.vehicleTitle || "Standalone intake record"}</h4>
                    <p className="mt-1 text-sm text-ink/58">{intake.ownerDetails.fullName || intake.ownerDetails.email || "Owner details pending"}</p>
                  </div>
                  <div className="text-right text-xs text-ink/55">
                    <p className="font-semibold text-ink">{getIntakeStatusLabel(intake)}</p>
                    <p className="mt-1">{formatAdminDateTime(intake.updatedAt || intake.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
            {!intakes.length && !loading ? (
              <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm leading-6 text-ink/60 md:rounded-[24px] md:px-5 md:py-8">
                Completed and in-progress warehouse intakes will appear here for quick access.
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
