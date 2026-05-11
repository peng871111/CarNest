"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminVehiclesReviewBoard } from "@/components/admin/admin-vehicles-review-board";
import { getListingLabel } from "@/lib/permissions";
import { formatAdminDateTime, formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { AppUser, CustomerProfile, Vehicle, VehicleRecord, WarehouseIntakeRecord } from "@/types";

type VehicleManagementView = "customers" | "vehicles" | "warehouse" | "listings";
type VehicleOperationalStatus = "Draft intake" | "Warehouse managed" | "Listed" | "Sold" | "Withdrawn" | "Unlinked";
type PublicListingStatus = "Available" | "Warehouse managed" | "Sold" | "Draft" | "Withdrawn";

function getCustomerLabel(profile: CustomerProfile) {
  return profile.fullName || profile.email || "Customer";
}

function getVehicleRecordTitle(record: VehicleRecord) {
  return record.title?.trim() || [record.year, record.make, record.model, record.variant].filter(Boolean).join(" ") || "Vehicle record";
}

function getListingOperationalStatus(listing?: Vehicle | null): VehicleOperationalStatus | null {
  if (!listing) return null;
  if (listing.deleted || listing.status === "rejected" || listing.sellerStatus === "WITHDRAWN") return "Withdrawn";
  if (listing.sellerStatus === "SOLD" || Boolean(listing.soldAt)) return "Sold";
  return listing.listingType === "warehouse" || listing.storedInWarehouse ? "Warehouse managed" : "Listed";
}

function getPublicListingStatus(listing: Vehicle): PublicListingStatus {
  if (listing.deleted || listing.status === "rejected" || listing.sellerStatus === "WITHDRAWN") return "Withdrawn";
  if (listing.sellerStatus === "SOLD" || Boolean(listing.soldAt)) return "Sold";
  if (listing.status !== "approved") return "Draft";
  if (listing.sellerStatus === "ACTIVE" || listing.sellerStatus === "UNDER_OFFER") {
    return listing.listingType === "warehouse" || listing.storedInWarehouse ? "Warehouse managed" : "Available";
  }
  return "Draft";
}

function isPublicInventoryListing(listing: Vehicle) {
  return !listing.deleted && listing.status === "approved" && (listing.sellerStatus === "ACTIVE" || listing.sellerStatus === "UNDER_OFFER");
}

function getRecordDedupKey(record: VehicleRecord) {
  if (record.publicListingId?.trim()) return `listing:${record.publicListingId.trim()}`;
  if (record.vin?.trim()) return `vin:${record.vin.trim().toLowerCase()}`;
  if (record.registrationPlate?.trim()) return `rego:${record.registrationPlate.trim().toLowerCase()}`;
  if (record.id?.trim()) return `record:${record.id.trim()}`;
  return `fallback:${getVehicleRecordTitle(record).toLowerCase()}`;
}

function getIntakeStatusSummary(intake: WarehouseIntakeRecord) {
  return intake.signature.signatureStoragePath && intake.signature.signedAt ? "Signature captured" : "Signature pending";
}

function getMostRecentTimestamp(...values: Array<string | undefined>) {
  return values.filter(Boolean).sort((left, right) => right!.localeCompare(left!))[0] || "";
}

function getVehicleOperationalStatus(record: VehicleRecord, listing: Vehicle | null, intakeCount: number): VehicleOperationalStatus {
  const listingStatus = getListingOperationalStatus(listing);
  if (listingStatus) return listingStatus;
  if (!record.customerProfileId && !record.publicListingId && intakeCount === 0) return "Unlinked";
  if (intakeCount === 0 && record.status === "draft") return "Draft intake";
  if (intakeCount > 0) return "Warehouse managed";
  return "Unlinked";
}

function getStatusTone(status: VehicleOperationalStatus | PublicListingStatus) {
  if (status === "Listed" || status === "Available") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Sold") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "Withdrawn") return "border-zinc-200 bg-zinc-100 text-zinc-700";
  if (status === "Warehouse managed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Draft intake") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-black/8 bg-shell text-ink/68";
}

function StatusPill({ label }: { label: VehicleOperationalStatus | PublicListingStatus }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${getStatusTone(label)}`}>{label}</span>;
}

export function VehicleManagementHub({
  vehicles,
  owners,
  customerProfiles,
  vehicleRecords,
  intakes,
  writeStatus,
  error
}: {
  vehicles: Vehicle[];
  owners: AppUser[];
  customerProfiles: CustomerProfile[];
  vehicleRecords: VehicleRecord[];
  intakes: WarehouseIntakeRecord[];
  writeStatus?: string;
  error?: string;
}) {
  const [activeView, setActiveView] = useState<VehicleManagementView>("customers");
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [expandedIntakes, setExpandedIntakes] = useState<Record<string, boolean>>({});
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<VehicleOperationalStatus | "all">("all");
  const [showModerationQueue, setShowModerationQueue] = useState(false);

  const listingMap = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const customerMap = useMemo(() => new Map(customerProfiles.map((profile) => [profile.id, profile])), [customerProfiles]);
  const intakeCountsByVehicleRecordId = useMemo(() => {
    const counts = new Map<string, number>();
    intakes.forEach((intake) => {
      if (!intake.vehicleRecordId) return;
      counts.set(intake.vehicleRecordId, (counts.get(intake.vehicleRecordId) ?? 0) + 1);
    });
    return counts;
  }, [intakes]);

  const customerRows = useMemo(() => {
    return [...customerProfiles]
      .sort((left, right) => getCustomerLabel(left).localeCompare(getCustomerLabel(right)))
      .map((profile) => {
        const dedupedRecords = new Map<string, {
          record: VehicleRecord;
          listing: Vehicle | null;
          intakeCount: number;
          status: VehicleOperationalStatus;
        }>();

        vehicleRecords
          .filter((record) => record.customerProfileId === profile.id)
          .forEach((record) => {
            const listing = record.publicListingId ? listingMap.get(record.publicListingId) ?? null : null;
            const intakeCount = intakeCountsByVehicleRecordId.get(record.id) ?? 0;
            const nextRow = {
              record,
              listing,
              intakeCount,
              status: getVehicleOperationalStatus(record, listing, intakeCount)
            };
            const dedupKey = getRecordDedupKey(record);
            const existing = dedupedRecords.get(dedupKey);

            if (!existing) {
              dedupedRecords.set(dedupKey, nextRow);
              return;
            }

            const existingUpdated = getMostRecentTimestamp(existing.record.updatedAt, existing.record.createdAt);
            const nextUpdated = getMostRecentTimestamp(record.updatedAt, record.createdAt);
            if (nextUpdated >= existingUpdated) {
              dedupedRecords.set(dedupKey, {
                ...nextRow,
                intakeCount: Math.max(existing.intakeCount, nextRow.intakeCount)
              });
            }
          });

        const linkedRecords = [...dedupedRecords.values()].sort((left, right) => getVehicleRecordTitle(left.record).localeCompare(getVehicleRecordTitle(right.record)));

        return {
          profile,
          linkedRecords
        };
      });
  }, [customerProfiles, intakeCountsByVehicleRecordId, listingMap, vehicleRecords]);

  const vehicleRows = useMemo(() => {
    const searchTerm = vehicleSearch.trim().toLowerCase();

    return vehicleRecords
      .map((record) => {
        const customer = record.customerProfileId ? customerMap.get(record.customerProfileId) ?? null : null;
        const listing = record.publicListingId ? listingMap.get(record.publicListingId) ?? null : null;
        const intakeCount = intakeCountsByVehicleRecordId.get(record.id) ?? 0;
        const status = getVehicleOperationalStatus(record, listing, intakeCount);
        const searchableText = [
          getVehicleRecordTitle(record),
          record.make,
          record.model,
          record.variant,
          record.registrationPlate,
          record.vin,
          record.displayReference,
          listing ? getVehicleDisplayReference(listing) : "",
          customer?.fullName,
          customer?.email,
          customer?.phone
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return {
          record,
          customer,
          listing,
          intakeCount,
          status,
          searchableText
        };
      })
      .filter((row) => (vehicleStatusFilter === "all" ? true : row.status === vehicleStatusFilter))
      .filter((row) => (searchTerm ? row.searchableText.includes(searchTerm) : true))
      .sort((left, right) => getVehicleRecordTitle(left.record).localeCompare(getVehicleRecordTitle(right.record)));
  }, [customerMap, intakeCountsByVehicleRecordId, listingMap, vehicleRecords, vehicleSearch, vehicleStatusFilter]);

  const listingRelationshipRows = useMemo(() => {
    return vehicles.map((vehicle) => {
      const linkedRecord = vehicleRecords.find((record) => record.publicListingId === vehicle.id) ?? null;
      const linkedCustomer = linkedRecord?.customerProfileId ? customerMap.get(linkedRecord.customerProfileId) ?? null : null;
      const status = getPublicListingStatus(vehicle);

      return {
        vehicle,
        linkedRecord,
        linkedCustomer,
        status
      };
    });
  }, [customerMap, vehicleRecords, vehicles]);

  const listingCounts = useMemo(() => {
    return {
      available: vehicles.filter((vehicle) => isPublicInventoryListing(vehicle)).length,
      sold: vehicles.filter((vehicle) => getPublicListingStatus(vehicle) === "Sold").length,
      draft: vehicles.filter((vehicle) => getPublicListingStatus(vehicle) === "Draft").length,
      withdrawn: vehicles.filter((vehicle) => getPublicListingStatus(vehicle) === "Withdrawn").length
    };
  }, [vehicles]);

  const recentIntakes = useMemo(() => {
    return [...intakes]
      .sort((left, right) => (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""))
      .slice(0, 8)
      .map((intake) => ({
        intake,
        customer: intake.customerProfileId ? customerMap.get(intake.customerProfileId) ?? null : null,
        vehicleRecord: intake.vehicleRecordId ? vehicleRecords.find((record) => record.id === intake.vehicleRecordId) ?? null : null
      }));
  }, [customerMap, intakes, vehicleRecords]);

  const viewTabs: Array<{ key: VehicleManagementView; label: string; description: string }> = [
    { key: "customers", label: "Customers", description: "People and their linked vehicles" },
    { key: "vehicles", label: "Vehicles", description: "All private vehicle records" },
    { key: "warehouse", label: "Warehouse Intake", description: "Start or continue paperwork" },
    { key: "listings", label: "Public Listings", description: "Live website listings and moderation" }
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Vehicle management</p>
            <h2 className="mt-2 font-display text-3xl text-ink">Simple staff workspace</h2>
            <p className="mt-2 text-sm text-ink/60">Choose the area you need and keep each task focused.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/warehouse-intake/new" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92">
              Start warehouse intake
            </Link>
            <Link href="/admin/vehicles/add" className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
              Add public listing
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveView(tab.key)}
              className={`rounded-[22px] border px-4 py-4 text-left transition ${
                activeView === tab.key
                  ? "border-[#C6A87D]/45 bg-[#F8F2EA] text-ink"
                  : "border-black/6 bg-shell text-ink/75 hover:border-[#C6A87D]/25 hover:bg-white"
              }`}
            >
              <p className="text-sm font-semibold">{tab.label}</p>
              <p className="mt-1 text-xs leading-5 text-ink/58">{tab.description}</p>
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}

      {activeView === "customers" ? (
        <section className="space-y-4">
          {customerRows.map(({ profile, linkedRecords }) => {
            const isExpanded = expandedCustomers[profile.id] ?? false;
            return (
              <div key={profile.id} className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{getCustomerLabel(profile)}</h3>
                    <p className="mt-1 text-sm text-ink/60">{profile.phone || "Phone pending"} · {profile.email || "Email pending"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-black/8 bg-shell px-3 py-1 text-xs font-semibold text-ink/70">
                      {linkedRecords.length} linked vehicle{linkedRecords.length === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedCustomers((current) => ({ ...current, [profile.id]: !isExpanded }))}
                      className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                    >
                      {isExpanded ? "Hide vehicles" : "Show vehicles"}
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="mt-4 space-y-3">
                    {linkedRecords.length ? linkedRecords.map(({ record, listing, intakeCount, status }) => (
                      <div key={record.id} className="rounded-[18px] border border-black/6 bg-shell px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">{getVehicleRecordTitle(record)}</p>
                            <p className="mt-1 text-xs text-ink/58">
                              Rego: {record.registrationPlate || "Pending"} · VIN: {record.vin || "Pending"}
                            </p>
                          </div>
                          <StatusPill label={status} />
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-ink/65 md:grid-cols-3">
                          <p>Intake history: {intakeCount} event{intakeCount === 1 ? "" : "s"}</p>
                          <p>Listing ID: {listing ? getVehicleDisplayReference(listing) : "Not linked"}</p>
                          <p>Listing status: {listing ? getListingOperationalStatus(listing) : "Private record only"}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-[18px] border border-dashed border-black/10 bg-shell px-4 py-4 text-sm text-ink/58">
                        No vehicle records linked yet.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {!customerRows.length ? (
            <div className="rounded-[24px] border border-dashed border-black/10 bg-white px-5 py-8 text-sm text-ink/60 shadow-panel">
              Customer profiles will appear here once warehouse onboarding has started.
            </div>
          ) : null}
        </section>
      ) : null}

      {activeView === "vehicles" ? (
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
          <div className="flex flex-wrap gap-3">
            <input
              value={vehicleSearch}
              onChange={(event) => setVehicleSearch(event.target.value)}
              placeholder="Search make, model, rego, VIN, listing ID, or customer"
              className="min-w-[280px] flex-1 rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
            />
            <select
              value={vehicleStatusFilter}
              onChange={(event) => setVehicleStatusFilter(event.target.value as VehicleOperationalStatus | "all")}
              className="rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-[#C6A87D]"
            >
              <option value="all">All statuses</option>
              <option value="Draft intake">Draft intake</option>
              <option value="Warehouse managed">Warehouse managed</option>
              <option value="Listed">Listed</option>
              <option value="Sold">Sold</option>
              <option value="Withdrawn">Withdrawn</option>
              <option value="Unlinked">Unlinked</option>
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {vehicleRows.map(({ record, customer, listing, intakeCount, status }) => (
              <div key={record.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">{getVehicleRecordTitle(record)}</p>
                    <p className="mt-1 text-sm text-ink/60">
                      {customer ? getCustomerLabel(customer) : "Customer pending"} · {record.registrationPlate || "Rego pending"} · {record.vin || "VIN pending"}
                    </p>
                  </div>
                  <StatusPill label={status} />
                </div>

                <div className="mt-4 grid gap-3 text-sm text-ink/65 md:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Listing</p>
                    <p className="mt-1">{listing ? getVehicleDisplayReference(listing) : "Not linked"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Listing type</p>
                    <p className="mt-1">{listing ? getListingLabel(listing.listingType) : "Private record"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Intake history</p>
                    <p className="mt-1">{intakeCount} event{intakeCount === 1 ? "" : "s"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Price</p>
                    <p className="mt-1">{listing ? formatCurrency(listing.price) : "Not listed"}</p>
                  </div>
                </div>
              </div>
            ))}

            {!vehicleRows.length ? (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-shell px-5 py-8 text-sm text-ink/60">
                No vehicle records match this search yet.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeView === "warehouse" ? (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-bronze">Warehouse paperwork</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">Start or continue intake paperwork</h3>
                <p className="mt-2 text-sm text-ink/60">Use this area only for signatures, documents, condition photos, and intake PDFs.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/admin/warehouse-intake/new" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92">
                  Start new intake
                </Link>
                <Link href="/admin/warehouse-intake" className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                  Open intake workspace
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-bronze">Recent paperwork</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">Continue recent intake records</h3>
              </div>
              <p className="text-sm text-ink/55">{recentIntakes.length} shown</p>
            </div>

            <div className="mt-5 space-y-3">
              {recentIntakes.map(({ intake, customer, vehicleRecord }) => {
                const isExpanded = expandedIntakes[intake.id] ?? false;
                const signatureReady = Boolean(intake.signature.signatureStoragePath && intake.signature.signedAt);
                const pdfReady = Boolean(intake.signedPdfStoragePath);

                return (
                  <div key={intake.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-ink">{vehicleRecord ? getVehicleRecordTitle(vehicleRecord) : intake.vehicleTitle || "Warehouse intake"}</h4>
                        <p className="mt-1 text-sm text-ink/58">{customer ? getCustomerLabel(customer) : intake.ownerDetails.fullName || "Customer pending"}</p>
                        <p className="mt-1 text-xs text-ink/52">{intake.ownerDetails.phone || "Phone pending"} · {intake.ownerDetails.email || "Email pending"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs text-ink/58">
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 font-semibold ${signatureReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                            {signatureReady ? "✓ Signature captured" : "Signature pending"}
                          </span>
                          <span className={`inline-flex rounded-full border px-3 py-1 font-semibold ${pdfReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-black/8 bg-white text-ink/62"}`}>
                            {pdfReady ? "✓ PDF ready" : "PDF pending"}
                          </span>
                        </div>
                        <p>{formatAdminDateTime(intake.updatedAt || intake.createdAt)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/warehouse-intake/${intake.id}`}
                        className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/92"
                      >
                        Open intake
                      </Link>
                      <button
                        type="button"
                        onClick={() => setExpandedIntakes((current) => ({ ...current, [intake.id]: !isExpanded }))}
                        className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                      >
                        {isExpanded ? "Hide details" : "Show details"}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="mt-3 rounded-[18px] border border-black/6 bg-white/80 px-4 py-3 text-xs text-ink/58">
                        <p>Reference: {intake.vehicleReference || "Pending"}</p>
                        <p className="mt-1">Status: {intake.status.replace(/_/g, " ")}</p>
                        <p className="mt-1">Intake ID: {intake.id}</p>
                        <p className="mt-1">{getIntakeStatusSummary(intake)}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {!recentIntakes.length ? (
                <div className="rounded-[24px] border border-dashed border-black/10 bg-shell px-5 py-8 text-sm text-ink/60">
                  Intake paperwork will appear here once the first draft is saved.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {activeView === "listings" ? (
        <section className="space-y-6">
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-bronze">Live website listings</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">Current public listings and their private links</h3>
                <p className="mt-2 text-sm text-ink/60">These are the website-facing listings. Customer profiles and warehouse documents stay private.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModerationQueue((current) => !current)}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
              >
                {showModerationQueue ? "Hide moderation queue" : "Show moderation queue"}
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-[20px] border border-black/6 bg-shell px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">Active inventory</p>
                <p className="mt-2 text-3xl font-semibold text-ink">{listingCounts.available}</p>
                <p className="mt-1 text-xs text-ink/58">Matches the public Inventory page</p>
              </div>
              <div className="rounded-[20px] border border-black/6 bg-shell px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">Sold</p>
                <p className="mt-2 text-3xl font-semibold text-ink">{listingCounts.sold}</p>
              </div>
              <div className="rounded-[20px] border border-black/6 bg-shell px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">Draft</p>
                <p className="mt-2 text-3xl font-semibold text-ink">{listingCounts.draft}</p>
              </div>
              <div className="rounded-[20px] border border-black/6 bg-shell px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">Withdrawn</p>
                <p className="mt-2 text-3xl font-semibold text-ink">{listingCounts.withdrawn}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {listingRelationshipRows.slice(0, 16).map(({ vehicle, linkedRecord, linkedCustomer, status }) => (
                <div key={vehicle.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">{getVehicleDisplayReference(vehicle)}</p>
                      <h4 className="mt-1 text-sm font-semibold text-ink">{vehicle.year} {vehicle.make} {vehicle.model}</h4>
                    </div>
                    <StatusPill label={status === "Warehouse managed" ? "Listed" : status === "Available" ? "Listed" : status} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-ink/62">
                    <p>Status: {status}</p>
                    <p>Vehicle record: {linkedRecord ? getVehicleRecordTitle(linkedRecord) : "Not linked"}</p>
                    <p>Customer: {linkedCustomer ? getCustomerLabel(linkedCustomer) : "Not linked"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showModerationQueue ? (
            <AdminVehiclesReviewBoard initialVehicles={vehicles} owners={owners} writeStatus={writeStatus} error={error} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
