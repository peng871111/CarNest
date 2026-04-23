"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { restoreSoftDeletedVehicle, softDeleteVehicle, updateVehicleStatus } from "@/lib/data";
import { hasAdminPermission, getListingLabel } from "@/lib/permissions";
import { formatAdminDateTime, formatCurrency, formatLocation, getVehicleDisplayReference } from "@/lib/utils";
import { AppUser, Vehicle } from "@/types";

type ModerationFilter = "all" | "pending" | "active" | "rejected" | "sold" | "deleted";
type BulkAction = "approve" | "reject" | "delete" | "restore";

type OwnerDirectory = Record<string, Pick<AppUser, "id" | "displayName" | "name" | "email">>;

const FILTER_LABELS: Record<ModerationFilter, string> = {
  all: "All",
  pending: "Pending Review",
  active: "Active",
  rejected: "Rejected",
  sold: "Sold",
  deleted: "Deleted"
};

function getOwnerLabel(owner?: Pick<AppUser, "displayName" | "name" | "email">) {
  return owner?.displayName || owner?.name || owner?.email || "Seller account";
}

function getModerationStatus(vehicle: Vehicle): Exclude<ModerationFilter, "all"> {
  if (vehicle.deleted) return "deleted";
  if (vehicle.sellerStatus === "SOLD") return "sold";
  if (vehicle.status === "rejected") return "rejected";
  if (vehicle.status === "approved") return "active";
  return "pending";
}

function getModerationStatusLabel(status: Exclude<ModerationFilter, "all">) {
  return FILTER_LABELS[status];
}

function getModerationStatusTone(status: Exclude<ModerationFilter, "all">) {
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "sold") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-zinc-200 bg-zinc-100 text-zinc-700";
}

function getSortWeight(status: Exclude<ModerationFilter, "all">) {
  if (status === "pending") return 0;
  if (status === "active") return 1;
  if (status === "rejected") return 2;
  if (status === "deleted") return 3;
  return 4;
}

function getVehicleTitle(vehicle: Vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ");
}

function getVehicleSearchText(vehicle: Vehicle, owner?: Pick<AppUser, "displayName" | "name" | "email">) {
  return [
    getVehicleTitle(vehicle),
    getVehicleDisplayReference(vehicle),
    vehicle.rego,
    owner?.displayName,
    owner?.name,
    owner?.email
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatVehicleMeta(vehicle: Vehicle) {
  return [getVehicleDisplayReference(vehicle), vehicle.rego].filter(Boolean).join(" / ");
}

function getSubmittedAt(vehicle: Vehicle) {
  return vehicle.createdAt ?? vehicle.updatedAt ?? "";
}

function getApplicableVehicles(vehicles: Vehicle[], action: BulkAction) {
  if (action === "approve") return vehicles.filter((vehicle) => !vehicle.deleted && vehicle.status !== "approved");
  if (action === "reject") return vehicles.filter((vehicle) => !vehicle.deleted && vehicle.status !== "rejected");
  if (action === "delete") return vehicles.filter((vehicle) => !vehicle.deleted);
  return vehicles.filter((vehicle) => vehicle.deleted);
}

function StatusBadge({ status }: { status: Exclude<ModerationFilter, "all"> }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getModerationStatusTone(status)}`}>
      {getModerationStatusLabel(status)}
    </span>
  );
}

export function AdminVehiclesReviewBoard({
  initialVehicles,
  owners,
  writeStatus,
  error
}: {
  initialVehicles: Vehicle[];
  owners: AppUser[];
  writeStatus?: string;
  error?: string;
}) {
  const { appUser } = useAuth();
  const canDeleteListings = hasAdminPermission(appUser, "deleteListings");
  const ownerDirectory = useMemo<OwnerDirectory>(() => {
    return Object.fromEntries(
      owners.map((owner) => [
        owner.id,
        {
          id: owner.id,
          displayName: owner.displayName,
          name: owner.name,
          email: owner.email
        }
      ])
    );
  }, [owners]);

  const [vehicles, setVehicles] = useState(initialVehicles);
  const [activeFilter, setActiveFilter] = useState<ModerationFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState(writeStatus ?? "");
  const [localError, setLocalError] = useState(error ?? "");
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  const filteredVehicles = useMemo(() => {
    const nextVehicles = vehicles.filter((vehicle) => {
      const moderationStatus = getModerationStatus(vehicle);
      if (activeFilter !== "all" && moderationStatus !== activeFilter) {
        return false;
      }

      if (!debouncedSearch) {
        return true;
      }

      return getVehicleSearchText(vehicle, ownerDirectory[vehicle.ownerUid]).includes(debouncedSearch);
    });

    return [...nextVehicles].sort((left, right) => {
      const statusDifference = getSortWeight(getModerationStatus(left)) - getSortWeight(getModerationStatus(right));
      if (statusDifference !== 0) return statusDifference;
      return getSubmittedAt(right).localeCompare(getSubmittedAt(left));
    });
  }, [activeFilter, debouncedSearch, ownerDirectory, vehicles]);

  const counts = useMemo(() => {
    return vehicles.reduce<Record<ModerationFilter, number>>((accumulator, vehicle) => {
      accumulator.all += 1;
      accumulator[getModerationStatus(vehicle)] += 1;
      return accumulator;
    }, {
      all: 0,
      pending: 0,
      active: 0,
      rejected: 0,
      sold: 0,
      deleted: 0
    });
  }, [vehicles]);

  const selectedVehicles = useMemo(
    () => filteredVehicles.filter((vehicle) => selectedIds[vehicle.id]),
    [filteredVehicles, selectedIds]
  );

  async function runSingleAction(vehicle: Vehicle, action: BulkAction | "approve" | "reject"): Promise<Vehicle> {
    if (!appUser) {
      throw new Error("Admin session not available.");
    }

    if (action === "approve" || action === "reject") {
      const result = await updateVehicleStatus(vehicle.id, action === "approve" ? "approved" : "rejected", appUser, vehicle);
      return result.vehicle;
    }

    if (action === "delete") {
      const result = await softDeleteVehicle(vehicle.id, appUser, vehicle);
      return result.vehicle;
    }

    const result = await restoreSoftDeletedVehicle(vehicle.id, appUser, vehicle);
    return result.vehicle;
  }

  async function handleInlineAction(vehicle: Vehicle, action: "approve" | "reject" | "delete" | "restore") {
    if (!appUser) return;

    setBusyAction(`${action}-${vehicle.id}`);
    setLocalError("");
    setNotice("");

    try {
      const nextVehicle = await runSingleAction(vehicle, action);
      setVehicles((current) => current.map((item) => (item.id === vehicle.id ? nextVehicle : item)));
      setNotice(
        action === "approve"
          ? "Vehicle approved."
          : action === "reject"
            ? "Vehicle rejected."
            : action === "delete"
              ? "Vehicle soft deleted."
              : "Vehicle restored."
      );
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "Unable to update the vehicle.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleBulkConfirm() {
    if (!pendingBulkAction || !appUser) return;

    const applicableVehicles = getApplicableVehicles(selectedVehicles, pendingBulkAction);
    if (!applicableVehicles.length) {
      setLocalError("No selected listings can be updated with that action.");
      setPendingBulkAction(null);
      return;
    }

    setBusyAction(`bulk-${pendingBulkAction}`);
    setLocalError("");
    setNotice("");

    try {
      const updatedVehicles = await Promise.all(
        applicableVehicles.map(async (vehicle) => ({
          id: vehicle.id,
          vehicle: await runSingleAction(vehicle, pendingBulkAction)
        }))
      );

      const updates = new Map(updatedVehicles.map((entry) => [entry.id, entry.vehicle]));
      setVehicles((current) => current.map((vehicle) => updates.get(vehicle.id) ?? vehicle));
      setSelectedIds({});
      setPendingBulkAction(null);
      setNotice(
        pendingBulkAction === "approve"
          ? `${updatedVehicles.length} listing${updatedVehicles.length === 1 ? "" : "s"} approved.`
          : pendingBulkAction === "reject"
            ? `${updatedVehicles.length} listing${updatedVehicles.length === 1 ? "" : "s"} rejected.`
            : pendingBulkAction === "delete"
              ? `${updatedVehicles.length} listing${updatedVehicles.length === 1 ? "" : "s"} soft deleted.`
              : `${updatedVehicles.length} listing${updatedVehicles.length === 1 ? "" : "s"} restored.`
      );
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "Unable to complete the bulk action.");
    } finally {
      setBusyAction("");
    }
  }

  function toggleExpanded(vehicleId: string) {
    setExpandedIds((current) => ({
      ...current,
      [vehicleId]: !current[vehicleId]
    }));
  }

  function toggleSelected(vehicleId: string) {
    setSelectedIds((current) => ({
      ...current,
      [vehicleId]: !current[vehicleId]
    }));
  }

  function toggleSelectAll() {
    const allSelected = filteredVehicles.length > 0 && filteredVehicles.every((vehicle) => selectedIds[vehicle.id]);

    if (allSelected) {
      setSelectedIds((current) => {
        const next = { ...current };
        for (const vehicle of filteredVehicles) {
          delete next[vehicle.id];
        }
        return next;
      });
      return;
    }

    setSelectedIds((current) => ({
      ...current,
      ...Object.fromEntries(filteredVehicles.map((vehicle) => [vehicle.id, true]))
    }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">Moderation queue</p>
              <p className="mt-2 text-sm text-ink/65">Scan listings quickly, filter by moderation state, and review in batches.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/vehicles/add" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
                Add vehicle
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_LABELS) as ModerationFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    activeFilter === filter
                      ? "border-ink bg-ink text-white"
                      : "border-black/10 bg-white text-ink/65 hover:border-bronze hover:text-ink"
                  }`}
                >
                  {FILTER_LABELS[filter]} <span className="ml-1 text-xs opacity-80">{counts[filter]}</span>
                </button>
              ))}
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[420px]">
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by vehicle, CN ID, rego, seller email, or seller name"
                className="w-full rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
              />
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-ink/45">
                <button type="button" onClick={toggleSelectAll} className="font-medium text-ink/65 hover:text-ink">
                  Select all filtered
                </button>
                <span>{selectedVehicles.length} selected</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {notice ? <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
      {localError ? <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{localError}</div> : null}

      <section className="space-y-3">
        {filteredVehicles.length ? (
          filteredVehicles.map((vehicle) => {
            const owner = ownerDirectory[vehicle.ownerUid];
            const moderationStatus = getModerationStatus(vehicle);
            const isExpanded = Boolean(expandedIds[vehicle.id]);
            const isSelected = Boolean(selectedIds[vehicle.id]);

            return (
              <article key={vehicle.id} className="rounded-[28px] border border-black/5 bg-white shadow-panel">
                <div className="flex items-start gap-3 px-5 py-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(vehicle.id)}
                    className="mt-1 h-4 w-4 rounded border-black/20"
                    aria-label={`Select ${getVehicleTitle(vehicle)}`}
                  />

                  <button
                    type="button"
                    onClick={() => toggleExpanded(vehicle.id)}
                    className="grid flex-1 gap-4 text-left md:grid-cols-[2fr,1.1fr,0.9fr,0.9fr,1fr]"
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 text-sm text-ink/45">{isExpanded ? "▾" : "▸"}</span>
                        <div>
                          <p className="font-semibold text-ink">{getVehicleTitle(vehicle)}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">{formatVehicleMeta(vehicle)}</p>
                          <p className="mt-2 text-xs text-ink/55">{getOwnerLabel(owner)}{owner?.email ? ` · ${owner.email}` : ""}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-ink/70">{formatCurrency(vehicle.price)}</div>
                    <div>
                      <StatusBadge status={moderationStatus} />
                    </div>
                    <div className="text-sm text-ink/70">{formatAdminDateTime(vehicle.createdAt)}</div>
                    <div className="flex flex-wrap items-center gap-3" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        disabled={busyAction === `approve-${vehicle.id}` || vehicle.deleted || vehicle.status === "approved"}
                        onClick={() => void handleInlineAction(vehicle, "approve")}
                        className="text-sm font-medium text-emerald-700 disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyAction === `reject-${vehicle.id}` || vehicle.deleted || vehicle.status === "rejected"}
                        onClick={() => void handleInlineAction(vehicle, "reject")}
                        className="text-sm font-medium text-red-700 disabled:opacity-40"
                      >
                        Reject
                      </button>
                      <Link href={`/admin/vehicles/${vehicle.id}/edit`} className="text-sm font-medium text-ink underline">
                        Edit
                      </Link>
                    </div>
                  </button>
                </div>

                {isExpanded ? (
                  <div className="border-t border-black/5 px-5 py-5">
                    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                      <section className="space-y-4">
                        <div className="grid gap-4 rounded-[24px] bg-shell px-4 py-4 md:grid-cols-2">
                          {[
                            ["Vehicle reference", getVehicleDisplayReference(vehicle)],
                            ["Rego", vehicle.rego || "—"],
                            ["Listing type", getListingLabel(vehicle.listingType)],
                            ["Approval status", vehicle.status],
                            ["Seller status", vehicle.sellerStatus],
                            ["Location", formatLocation(vehicle.sellerLocationSuburb, vehicle.sellerLocationPostcode, vehicle.sellerLocationState)],
                            ["Transmission", vehicle.transmission || "—"],
                            ["Fuel type", vehicle.fuelType || "—"],
                            ["Body type", vehicle.bodyType || "—"],
                            ["Colour", vehicle.colour || "—"]
                          ].map(([label, value]) => (
                            <div key={label}>
                              <p className="text-xs uppercase tracking-[0.18em] text-ink/45">{label}</p>
                              <p className="mt-2 text-sm text-ink">{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-[24px] bg-shell px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-bronze">Full vehicle info</p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/70">{vehicle.description || "No description provided."}</p>
                        </div>
                      </section>

                      <aside className="space-y-4">
                        <div className="rounded-[24px] bg-shell px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-bronze">Seller details</p>
                          <div className="mt-3 space-y-2 text-sm text-ink/70">
                            <p>Name: {getOwnerLabel(owner)}</p>
                            <p>Email: {owner?.email || "Not available"}</p>
                            <p>Owner ID: {vehicle.ownerUid}</p>
                          </div>
                        </div>

                        <div className="rounded-[24px] bg-shell px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-bronze">Admin notes</p>
                          <div className="mt-3 space-y-2 text-sm text-ink/70">
                            <p>Delete reason: {vehicle.deleteReason || "No admin note recorded."}</p>
                          </div>
                        </div>

                        <div className="rounded-[24px] bg-shell px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-bronze">Moderation history</p>
                          <div className="mt-3 space-y-2 text-sm text-ink/70">
                            <p>Submitted: {formatAdminDateTime(vehicle.createdAt)}</p>
                            <p>Approved: {vehicle.approvedAt ? formatAdminDateTime(vehicle.approvedAt) : "—"}</p>
                            <p>Updated: {formatAdminDateTime(vehicle.updatedAt)}</p>
                            <p>Sold: {vehicle.soldAt ? formatAdminDateTime(vehicle.soldAt) : "—"}</p>
                            <p>Deleted: {vehicle.deletedAt ? formatAdminDateTime(vehicle.deletedAt) : "—"}</p>
                          </div>
                        </div>

                        <div className="rounded-[24px] bg-shell px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-bronze">Actions</p>
                          <div className="mt-3 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={busyAction === `approve-${vehicle.id}` || vehicle.deleted || vehicle.status === "approved"}
                              onClick={() => void handleInlineAction(vehicle, "approve")}
                              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyAction === `reject-${vehicle.id}` || vehicle.deleted || vehicle.status === "rejected"}
                              onClick={() => void handleInlineAction(vehicle, "reject")}
                              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                            >
                              Reject
                            </button>
                            {canDeleteListings ? (
                              vehicle.deleted ? (
                                <button
                                  type="button"
                                  disabled={busyAction === `restore-${vehicle.id}`}
                                  onClick={() => void handleInlineAction(vehicle, "restore")}
                                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busyAction === `delete-${vehicle.id}`}
                                  onClick={() => void handleInlineAction(vehicle, "delete")}
                                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
                                >
                                  Soft delete
                                </button>
                              )
                            ) : null}
                            <Link href={`/admin/vehicles/${vehicle.id}`} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink">
                              View details
                            </Link>
                            <Link href={`/admin/vehicles/${vehicle.id}/edit`} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink">
                              Edit
                            </Link>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="rounded-[28px] border border-black/5 bg-white px-6 py-12 text-sm text-ink/60 shadow-panel">
            No vehicles match the current moderation filters.
          </div>
        )}
      </section>

      {selectedVehicles.length ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex w-[min(900px,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-4 rounded-[24px] border border-black/10 bg-ink px-5 py-4 text-white shadow-2xl">
          <p className="text-sm font-medium">{selectedVehicles.length} listing{selectedVehicles.length === 1 ? "" : "s"} selected</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setPendingBulkAction("approve")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
              Approve selected
            </button>
            <button type="button" onClick={() => setPendingBulkAction("reject")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
              Reject selected
            </button>
            {canDeleteListings ? (
              <>
                <button type="button" onClick={() => setPendingBulkAction("delete")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                  Soft delete selected
                </button>
                <button type="button" onClick={() => setPendingBulkAction("restore")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                  Restore selected
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingBulkAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Confirm bulk action</p>
            <h2 className="mt-3 font-display text-3xl text-ink">Review bulk update</h2>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              This will apply <strong>{pendingBulkAction}</strong> to{" "}
              <strong>{getApplicableVehicles(selectedVehicles, pendingBulkAction).length}</strong> listing
              {getApplicableVehicles(selectedVehicles, pendingBulkAction).length === 1 ? "" : "s"} out of the{" "}
              {selectedVehicles.length} selected.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busyAction === `bulk-${pendingBulkAction}`}
                onClick={() => void handleBulkConfirm()}
                className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busyAction === `bulk-${pendingBulkAction}` ? "Applying..." : "Confirm"}
              </button>
              <button
                type="button"
                disabled={busyAction === `bulk-${pendingBulkAction}`}
                onClick={() => setPendingBulkAction(null)}
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
