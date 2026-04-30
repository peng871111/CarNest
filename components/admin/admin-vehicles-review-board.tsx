"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  addVehicleActivityNote,
  getVehicleActivityLog,
  restoreSoftDeletedVehicle,
  softDeleteVehicle,
  updateSellerVehicleStatus,
  updateVehicleCustomerEmail,
  updateVehicleStatus
} from "@/lib/data";
import { prepareVehicleActivityEmailAttachments } from "@/lib/image-processing";
import { hasAdminPermission, getListingLabel } from "@/lib/permissions";
import { formatAdminDateTime, formatCurrency, formatLocation, getVehicleDisplayReference } from "@/lib/utils";
import { AppUser, SellerVehicleStatus, Vehicle, VehicleActivityEmailAttachment, VehicleActivityEvent } from "@/types";

type ModerationFilter = "all" | "pending" | "active" | "rejected" | "sold" | "deleted";
type ModerationGroup = Exclude<ModerationFilter, "all">;
type BulkAction = "approve" | "reject" | "delete" | "restore";
type ActivityNoteMode = "admin" | "customer";
const MAX_ACTIVITY_EMAIL_ATTACHMENTS = 5;

type OwnerDirectory = Record<string, Pick<AppUser, "id" | "displayName" | "name" | "email">>;

const FILTER_LABELS: Record<ModerationFilter, string> = {
  all: "All",
  pending: "Pending Review",
  active: "Active",
  rejected: "Rejected",
  sold: "Sold",
  deleted: "Deleted"
};

const GROUP_ORDER: ModerationGroup[] = ["active", "pending", "sold", "rejected", "deleted"];

const DEFAULT_GROUP_STATE: Record<ModerationGroup, boolean> = {
  active: true,
  pending: true,
  sold: false,
  rejected: false,
  deleted: false
};

function getOwnerLabel(owner?: Pick<AppUser, "displayName" | "name" | "email">) {
  return owner?.displayName || owner?.name || owner?.email || "Seller account";
}

function isDeletedVehicle(vehicle: Vehicle) {
  return vehicle.deleted === true;
}

function isSoldVehicle(vehicle: Vehicle) {
  return vehicle.sellerStatus === "SOLD" && !isDeletedVehicle(vehicle);
}

function isRejectedVehicle(vehicle: Vehicle) {
  return vehicle.status === "rejected" && !isDeletedVehicle(vehicle);
}

function isActiveVehicle(vehicle: Vehicle) {
  return vehicle.status === "approved" && !isDeletedVehicle(vehicle) && vehicle.sellerStatus !== "SOLD";
}

function isPendingReviewVehicle(vehicle: Vehicle) {
  return vehicle.status !== "approved" && vehicle.status !== "rejected" && !isDeletedVehicle(vehicle) && vehicle.sellerStatus !== "SOLD";
}

function getModerationStatus(vehicle: Vehicle): ModerationGroup {
  if (isDeletedVehicle(vehicle)) return "deleted";
  if (isSoldVehicle(vehicle)) return "sold";
  if (isRejectedVehicle(vehicle)) return "rejected";
  if (isActiveVehicle(vehicle)) return "active";
  return "pending";
}

function matchesFilter(vehicle: Vehicle, filter: ModerationFilter) {
  if (filter === "all") return !isDeletedVehicle(vehicle);
  if (filter === "pending") return isPendingReviewVehicle(vehicle);
  if (filter === "active") return isActiveVehicle(vehicle);
  if (filter === "sold") return isSoldVehicle(vehicle);
  if (filter === "rejected") return isRejectedVehicle(vehicle);
  return isDeletedVehicle(vehicle);
}

function getModerationStatusTone(status: ModerationGroup) {
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "sold") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-zinc-200 bg-zinc-100 text-zinc-700";
}

function getGroupSectionTone(status: ModerationGroup) {
  if (status === "deleted") return "border-zinc-200 bg-zinc-50";
  return "border-black/5 bg-white";
}

function getVehicleSummaryTitle(vehicle: Vehicle) {
  return [vehicle.year, vehicle.model].filter(Boolean).join(" ") || [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function getVehicleFullTitle(vehicle: Vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ");
}

function getVehicleSearchText(vehicle: Vehicle, owner?: Pick<AppUser, "displayName" | "name" | "email">) {
  return [
    getVehicleFullTitle(vehicle),
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

function isCustomerFacingUpdateType(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue === "customer update" || normalizedValue.startsWith("customer");
}

function getDefaultActivityUpdateType(hasCustomerEmail: boolean): ActivityNoteMode {
  return hasCustomerEmail ? "customer" : "admin";
}

function getSubmittedAt(vehicle: Vehicle) {
  return vehicle.createdAt ?? vehicle.updatedAt ?? "";
}

function getApplicableVehicles(vehicles: Vehicle[], action: BulkAction) {
  if (action === "approve") return vehicles.filter((vehicle) => !isDeletedVehicle(vehicle) && vehicle.status !== "approved");
  if (action === "reject") return vehicles.filter((vehicle) => !isDeletedVehicle(vehicle) && vehicle.status !== "rejected");
  if (action === "delete") return vehicles.filter((vehicle) => !isDeletedVehicle(vehicle));
  return vehicles.filter((vehicle) => isDeletedVehicle(vehicle));
}

function canMarkVehicleAsSold(vehicle: Vehicle) {
  return vehicle.status === "approved" && !isDeletedVehicle(vehicle) && vehicle.sellerStatus !== "SOLD";
}

function canUndoVehicleSold(vehicle: Vehicle) {
  return !isDeletedVehicle(vehicle) && vehicle.sellerStatus === "SOLD";
}

function StatusBadge({ status }: { status: ModerationGroup }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getModerationStatusTone(status)}`}>
      {FILTER_LABELS[status]}
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
  const [expandedGroups, setExpandedGroups] = useState<Record<ModerationGroup, boolean>>(DEFAULT_GROUP_STATE);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState(writeStatus ?? "");
  const [localError, setLocalError] = useState(error ?? "");
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction | null>(null);
  const [activityLogsByVehicleId, setActivityLogsByVehicleId] = useState<Record<string, VehicleActivityEvent[]>>({});
  const [activityLoadingByVehicleId, setActivityLoadingByVehicleId] = useState<Record<string, boolean>>({});
  const [manualActivityNotes, setManualActivityNotes] = useState<Record<string, string>>({});
  const [expandedHistoryByVehicleId, setExpandedHistoryByVehicleId] = useState<Record<string, boolean>>({});
  const [activityNoteModeByVehicleId, setActivityNoteModeByVehicleId] = useState<Record<string, ActivityNoteMode>>({});
  const [sendCustomerEmailByVehicleId, setSendCustomerEmailByVehicleId] = useState<Record<string, boolean>>({});
  const [activityAttachmentFilesByVehicleId, setActivityAttachmentFilesByVehicleId] = useState<Record<string, File[]>>({});
  const [customerEmailDrafts, setCustomerEmailDrafts] = useState<Record<string, string>>({});
  const [editingCustomerEmailByVehicleId, setEditingCustomerEmailByVehicleId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  const filteredVehicles = useMemo(() => {
    const nextVehicles = vehicles.filter((vehicle) => {
      if (!matchesFilter(vehicle, activeFilter)) {
        return false;
      }

      if (!debouncedSearch) {
        return true;
      }

      return getVehicleSearchText(vehicle, ownerDirectory[vehicle.ownerUid]).includes(debouncedSearch);
    });

    return [...nextVehicles].sort((left, right) => getSubmittedAt(right).localeCompare(getSubmittedAt(left)));
  }, [activeFilter, debouncedSearch, ownerDirectory, vehicles]);

  const groupedVehicles = useMemo(() => {
    const base = GROUP_ORDER.map((group) => ({
      group,
      vehicles: filteredVehicles.filter((vehicle) => getModerationStatus(vehicle) === group)
    }));

    return activeFilter === "all"
      ? base.filter((entry) => entry.vehicles.length)
      : base.filter((entry) => entry.group === activeFilter && entry.vehicles.length);
  }, [activeFilter, filteredVehicles]);

  const counts = useMemo(() => {
    return (Object.keys(FILTER_LABELS) as ModerationFilter[]).reduce<Record<ModerationFilter, number>>(
      (accumulator, filter) => {
        accumulator[filter] = vehicles.filter((vehicle) => matchesFilter(vehicle, filter)).length;
        return accumulator;
      },
      {
        all: 0,
        pending: 0,
        active: 0,
        rejected: 0,
        sold: 0,
        deleted: 0
      }
    );
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

  async function handleSellerStatusAction(vehicle: Vehicle, sellerStatus: Extract<SellerVehicleStatus, "ACTIVE" | "SOLD">) {
    if (!appUser) return;

    setBusyAction(`${sellerStatus}-${vehicle.id}`);
    setLocalError("");
    setNotice("");

    try {
      const result = await updateSellerVehicleStatus(vehicle.id, sellerStatus, appUser, vehicle);
      setVehicles((current) => current.map((item) => (item.id === vehicle.id ? result.vehicle : item)));
      await loadVehicleActivityLog(vehicle.id, true);
      setNotice(sellerStatus === "SOLD" ? "Vehicle marked as sold." : "Vehicle restored to available.");
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "Unable to update the vehicle sale status.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleInlineAction(vehicle: Vehicle, action: "approve" | "reject" | "delete" | "restore") {
    if (!appUser) return;

    setBusyAction(`${action}-${vehicle.id}`);
    setLocalError("");
    setNotice("");

    try {
      const nextVehicle = await runSingleAction(vehicle, action);
      setVehicles((current) => current.map((item) => (item.id === vehicle.id ? nextVehicle : item)));
      await loadVehicleActivityLog(vehicle.id, true);
      setNotice(
        action === "approve"
          ? "Vehicle approved."
          : action === "reject"
            ? "Vehicle rejected."
            : action === "delete"
              ? "Vehicle deleted."
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
      await Promise.all(updatedVehicles.map((entry) => loadVehicleActivityLog(entry.id, true)));
      setSelectedIds({});
      setPendingBulkAction(null);
      setNotice(
        pendingBulkAction === "approve"
          ? `${updatedVehicles.length} listing${updatedVehicles.length === 1 ? "" : "s"} approved.`
          : pendingBulkAction === "reject"
            ? `${updatedVehicles.length} listing${updatedVehicles.length === 1 ? "" : "s"} rejected.`
            : pendingBulkAction === "delete"
              ? `${updatedVehicles.length} listing${updatedVehicles.length === 1 ? "" : "s"} deleted.`
              : `${updatedVehicles.length} listing${updatedVehicles.length === 1 ? "" : "s"} restored.`
      );
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "Unable to complete the bulk action.");
    } finally {
      setBusyAction("");
    }
  }

  async function loadVehicleActivityLog(vehicleId: string, force = false) {
    if (activityLoadingByVehicleId[vehicleId] || (!force && activityLogsByVehicleId[vehicleId])) {
      return;
    }

    setActivityLoadingByVehicleId((current) => ({
      ...current,
      [vehicleId]: true
    }));

    try {
      const result = await getVehicleActivityLog(vehicleId);
      setActivityLogsByVehicleId((current) => ({
        ...current,
        [vehicleId]: result.items
      }));
    } catch (activityError) {
      setLocalError(activityError instanceof Error ? activityError.message : "Unable to load the vehicle activity log.");
    } finally {
      setActivityLoadingByVehicleId((current) => ({
        ...current,
        [vehicleId]: false
      }));
    }
  }

  async function handleAddActivityNote(vehicleId: string) {
    if (!appUser) return;

    const message = manualActivityNotes[vehicleId] ?? "";
    if (!message.trim()) {
      setLocalError("Enter a note before saving it to the vehicle activity log.");
      return;
    }

    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) {
      setLocalError("Vehicle not found.");
      return;
    }
    const hasCustomerEmail = Boolean(vehicle.customerEmail?.trim());
    const updateType = activityNoteModeByVehicleId[vehicleId] ?? getDefaultActivityUpdateType(hasCustomerEmail);
    const isCustomerFacing = isCustomerFacingUpdateType(updateType);
    const sendEmailToCustomer = sendCustomerEmailByVehicleId[vehicleId] ?? hasCustomerEmail;
    const owner = ownerDirectory[vehicle.ownerUid];

    setBusyAction(`note-${vehicleId}`);
    setLocalError("");
    setNotice("");

    try {
      console.log("activity submit state", {
        updateType,
        isCustomerFacing,
        sendEmailToCustomer
      });
      console.log("activity email decision", {
        updateType,
        isCustomerFacing,
        sendEmailToCustomer,
        customerEmail: vehicle.customerEmail?.trim() ?? "",
        noteContent: message.trim()
      });

      await addVehicleActivityNote(vehicleId, message, appUser, {
        visibility: isCustomerFacing ? "customer" : "admin",
        sendEmail: false,
        vehicleTitle: getVehicleFullTitle(vehicle),
        referenceId: getVehicleDisplayReference(vehicle)
      });
      setManualActivityNotes((current) => ({
        ...current,
        [vehicleId]: ""
      }));
      await loadVehicleActivityLog(vehicleId, true);
      if (isCustomerFacing) {
        const selectedCustomerEmail = vehicle.customerEmail?.trim() ?? "";
        if (!sendEmailToCustomer) {
          console.log("[vehicle-activity-email] Email skipped: sendEmailToCustomer false", {
            vehicleId,
            updateType,
            customerEmail: selectedCustomerEmail,
            noteContent: message.trim()
          });
          setNotice("Customer update saved");
        } else if (!selectedCustomerEmail) {
          console.log("[vehicle-activity-email] Email skipped: missing customerEmail", {
            vehicleId,
            updateType,
            customerEmail: selectedCustomerEmail,
            noteContent: message.trim()
          });
          setNotice("Customer update saved, but email could not be sent");
        } else {
          const selectedAttachmentFiles = activityAttachmentFilesByVehicleId[vehicleId] ?? [];
          let attachments: VehicleActivityEmailAttachment[] = [];

          if (selectedAttachmentFiles.length) {
            try {
              attachments = await prepareVehicleActivityEmailAttachments(selectedAttachmentFiles.slice(0, MAX_ACTIVITY_EMAIL_ATTACHMENTS));
            } catch (attachmentError) {
              console.error("[vehicle-activity-email] Failed to prepare activity email attachments", {
                vehicleId,
                error: attachmentError instanceof Error ? attachmentError.message : String(attachmentError)
              });
              setNotice("Customer update saved, but email could not be sent");
              return;
            }
          }

          const payload = {
            vehicleId,
            customerEmail: selectedCustomerEmail,
            vehicleTitle: getVehicleFullTitle(vehicle),
            referenceId: getVehicleDisplayReference(vehicle),
            message: message.trim(),
            attachments
          };
          console.log("Sending email payload", {
            vehicleId: payload.vehicleId,
            updateType,
            customerEmails: payload.customerEmail,
            noteContent: payload.message,
            attachmentCount: payload.attachments.length
          });

          const response = await fetch("/api/vehicle-activity-notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            keepalive: true,
            cache: "no-store"
          });

          const responseBody = await response.json().catch(() => null);
          console.log("Email API response", response.status, responseBody);

          if (response.ok && responseBody?.sent === true) {
            setNotice("Customer update saved and emailed");
          } else {
            setNotice("Customer update saved, but email could not be sent");
          }
        }
      } else {
        console.log("[vehicle-activity-email] Email skipped: updateType not customer-facing", {
          vehicleId,
          updateType,
          noteContent: message.trim()
        });
        setNotice("Vehicle activity note added.");
      }
      setActivityAttachmentFilesByVehicleId((current) => ({
        ...current,
        [vehicleId]: []
      }));
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "Unable to save the vehicle activity note.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveCustomerEmail(vehicle: Vehicle) {
    if (!appUser) return;

    const nextCustomerEmail = customerEmailDrafts[vehicle.id] ?? vehicle.customerEmail ?? "";
    setBusyAction(`customer-email-${vehicle.id}`);
    setLocalError("");
    setNotice("");

    try {
      const result = await updateVehicleCustomerEmail(vehicle.id, nextCustomerEmail, appUser, vehicle);
      setVehicles((current) => current.map((item) => (item.id === vehicle.id ? result.vehicle : item)));
      setCustomerEmailDrafts((current) => ({
        ...current,
        [vehicle.id]: result.vehicle.customerEmail ?? ""
      }));
      setEditingCustomerEmailByVehicleId((current) => ({
        ...current,
        [vehicle.id]: false
      }));
      setNotice("Customer email saved");
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "Unable to save the customer email.");
    } finally {
      setBusyAction("");
    }
  }

  function toggleExpanded(vehicleId: string) {
    const shouldExpand = !expandedIds[vehicleId];
    setExpandedIds((current) => ({
      ...current,
      [vehicleId]: shouldExpand
    }));

    if (shouldExpand) {
      void loadVehicleActivityLog(vehicleId);
    }
  }

  function toggleGroup(group: ModerationGroup) {
    setExpandedGroups((current) => ({
      ...current,
      [group]: !current[group]
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

  const showRestoreBulk = activeFilter === "deleted";

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">Vehicle moderation</p>
              <p className="mt-2 text-sm text-ink/65">Review by status, batch updates together, and keep deleted stock isolated from live inventory.</p>
            </div>
            <Link href="/admin/vehicles/add" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
              Add vehicle
            </Link>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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

            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[430px]">
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

      {groupedVehicles.length ? (
        <div className="space-y-4">
          {groupedVehicles.map(({ group, vehicles: groupVehicles }) => {
            const groupExpanded = expandedGroups[group];
            const deletedGroup = group === "deleted";

            return (
              <section key={group} className={`rounded-[28px] border shadow-panel ${getGroupSectionTone(group)}`}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-ink/45">{groupExpanded ? "▾" : "▸"}</span>
                      <p className="font-semibold text-ink">{FILTER_LABELS[group]}</p>
                      <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-ink/65">{groupVehicles.length}</span>
                    </div>
                    {deletedGroup ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">Deleted listings stay hidden from public inventory.</p> : null}
                  </div>
                </button>

                {groupExpanded ? (
                  <div className="space-y-3 border-t border-black/5 px-4 pb-4 pt-3">
                    {groupVehicles.map((vehicle) => {
                      const owner = ownerDirectory[vehicle.ownerUid];
                      const moderationStatus = getModerationStatus(vehicle);
                      const isExpanded = Boolean(expandedIds[vehicle.id]);
                      const isSelected = Boolean(selectedIds[vehicle.id]);
                      const isDeleted = moderationStatus === "deleted";
                      const canMarkSold = canMarkVehicleAsSold(vehicle);
                      const canUndoSold = canUndoVehicleSold(vehicle);
                      const activityEvents = activityLogsByVehicleId[vehicle.id] ?? [];
                      const activityLoading = Boolean(activityLoadingByVehicleId[vehicle.id]);
                      const hasCustomerEmail = Boolean(vehicle.customerEmail?.trim());
                      const noteMode = activityNoteModeByVehicleId[vehicle.id] ?? getDefaultActivityUpdateType(hasCustomerEmail);
                      const isCustomerFacingNoteMode = isCustomerFacingUpdateType(noteMode);
                      const showFullHistory = Boolean(expandedHistoryByVehicleId[vehicle.id]);
                      const visibleActivityEvents = showFullHistory ? activityEvents : activityEvents.slice(0, 2);
                      const sendCustomerEmail = sendCustomerEmailByVehicleId[vehicle.id] ?? hasCustomerEmail;
                      const activityAttachmentFiles = activityAttachmentFilesByVehicleId[vehicle.id] ?? [];
                      const customerEmailValue = customerEmailDrafts[vehicle.id] ?? vehicle.customerEmail ?? "";
                      const isEditingCustomerEmail = Boolean(editingCustomerEmailByVehicleId[vehicle.id]);

                      return (
                        <article
                          key={vehicle.id}
                          className={`rounded-[24px] border ${isDeleted ? "border-zinc-200 bg-zinc-100/70" : "border-black/5 bg-white"}`}
                        >
                          <div className="flex items-start gap-3 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelected(vehicle.id)}
                              className="mt-1 h-4 w-4 rounded border-black/20"
                              aria-label={`Select ${getVehicleFullTitle(vehicle)}`}
                            />

                            <button
                              type="button"
                              onClick={() => toggleExpanded(vehicle.id)}
                              className="flex flex-1 items-start justify-between gap-4 text-left"
                            >
                              <div className="min-w-0">
                                <div className="flex items-start gap-3">
                                  <span className="mt-1 text-sm text-ink/45">{isExpanded ? "▾" : "▸"}</span>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-ink">{getVehicleSummaryTitle(vehicle)}</p>
                                    {isDeleted ? (
                                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                        DELETED · Hidden from public
                                      </p>
                                    ) : canUndoSold ? (
                                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                        SOLD
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <p className="text-sm font-medium text-ink">{formatCurrency(vehicle.price)}</p>
                                <StatusBadge status={moderationStatus} />
                              </div>
                            </button>
                          </div>

                          {isExpanded ? (
                            <div className="border-t border-black/5 px-4 py-4">
                              <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                                <section className="space-y-4">
                                  <div className="grid gap-4 rounded-[22px] bg-shell px-4 py-4 md:grid-cols-2">
                                    {[
                                      ["Vehicle title", getVehicleFullTitle(vehicle)],
                                      ["CN ID", getVehicleDisplayReference(vehicle)],
                                      ["Seller email", owner?.email || "Not available"],
                                      ["Submitted", formatAdminDateTime(vehicle.createdAt)],
                                      ["Rego", vehicle.rego || "—"],
                                      ["Listing type", getListingLabel(vehicle.listingType)],
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

                                  <div className="rounded-[22px] bg-shell px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-bronze">Vehicle notes</p>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/70">{vehicle.description || "No description provided."}</p>
                                  </div>
                                </section>

                                <aside className="space-y-4">
                                  <div className="rounded-[22px] bg-shell px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-bronze">Seller details</p>
                                    <div className="mt-3 space-y-2 text-sm text-ink/70">
                                      <p>Name: {getOwnerLabel(owner)}</p>
                                      <p>Email: {owner?.email || "Not available"}</p>
                                      <div className="space-y-2 pt-2">
                                        <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Customer Email</p>
                                        {isEditingCustomerEmail ? (
                                          <>
                                            <input
                                              type="email"
                                              multiple
                                              value={customerEmailValue}
                                              onChange={(event) =>
                                                setCustomerEmailDrafts((current) => ({
                                                  ...current,
                                                  [vehicle.id]: event.target.value
                                                }))
                                              }
                                              placeholder="Enter customer email for updates"
                                              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
                                            />
                                            <div className="flex items-center justify-between gap-3">
                                              <p className="text-xs text-ink/55">Use comma-separated emails for multiple recipients.</p>
                                              <div className="flex gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setEditingCustomerEmailByVehicleId((current) => ({
                                                      ...current,
                                                      [vehicle.id]: false
                                                    }))
                                                  }
                                                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink"
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={busyAction === `customer-email-${vehicle.id}`}
                                                  onClick={() => void handleSaveCustomerEmail(vehicle)}
                                                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                                                >
                                                  {busyAction === `customer-email-${vehicle.id}` ? "Saving..." : "Save"}
                                                </button>
                                              </div>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
                                            <p className="min-w-0 truncate text-sm text-ink">{vehicle.customerEmail || "Not set"}</p>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCustomerEmailDrafts((current) => ({
                                                  ...current,
                                                  [vehicle.id]: vehicle.customerEmail ?? ""
                                                }));
                                                setEditingCustomerEmailByVehicleId((current) => ({
                                                  ...current,
                                                  [vehicle.id]: true
                                                }));
                                              }}
                                              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink"
                                            >
                                              Edit
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-[22px] bg-shell px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-bronze">Listing performance</p>
                                    <div className="mt-3 space-y-2 text-sm text-ink/70">
                                      <p>Total views: {(vehicle.viewCount ?? 0).toLocaleString()}</p>
                                      <p>Unique visitors: {(vehicle.uniqueViewCount ?? 0).toLocaleString()}</p>
                                      <p>Last viewed: {vehicle.lastViewedAt ? formatAdminDateTime(vehicle.lastViewedAt) : "—"}</p>
                                    </div>
                                  </div>

                                  <div className="rounded-[22px] bg-shell px-4 py-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-bronze">Vehicle Activity Log</p>
                                        <p className="mt-2 text-sm text-ink/60">
                                          Submitted, moderation, edits, sold status, deletes, restores, and manual admin notes.
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => void loadVehicleActivityLog(vehicle.id, true)}
                                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                                      >
                                        Refresh
                                      </button>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                      <div className="grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end">
                                        <label className="block">
                                          <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Update type</span>
                                          <select
                                            value={noteMode}
                                            onChange={(event) => {
                                              const nextUpdateType = event.target.value as ActivityNoteMode;
                                              const nextCustomerFacing = isCustomerFacingUpdateType(nextUpdateType);
                                              setActivityNoteModeByVehicleId((current) => ({
                                                ...current,
                                                [vehicle.id]: nextUpdateType
                                              }));
                                              if (nextCustomerFacing) {
                                                setSendCustomerEmailByVehicleId((current) => ({
                                                  ...current,
                                                  [vehicle.id]: true
                                                }));
                                              }
                                            }}
                                            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
                                          >
                                            <option value="admin">Internal note</option>
                                            <option value="customer">Customer update</option>
                                          </select>
                                        </label>
                                        {isCustomerFacingNoteMode ? (
                                          <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink">
                                            <input
                                              type="checkbox"
                                              checked={sendCustomerEmail}
                                              onChange={(event) =>
                                                setSendCustomerEmailByVehicleId((current) => ({
                                                  ...current,
                                                  [vehicle.id]: event.target.checked
                                                }))
                                              }
                                              className="h-4 w-4 rounded border-black/20"
                                            />
                                            <span>Send email to customer</span>
                                          </label>
                                        ) : null}
                                      </div>
                                      <textarea
                                        value={manualActivityNotes[vehicle.id] ?? ""}
                                        onChange={(event) =>
                                          setManualActivityNotes((current) => ({
                                            ...current,
                                            [vehicle.id]: event.target.value
                                          }))
                                        }
                                        placeholder={isCustomerFacingNoteMode ? "Add a customer-visible update" : "Add a manual admin activity note"}
                                        className="min-h-[96px] w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
                                      />
                                      <label className="block">
                                        <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Attach photos</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          onChange={(event) => {
                                            const nextFiles = Array.from(event.target.files ?? [])
                                              .filter((file) => file.type.startsWith("image/"))
                                              .slice(0, MAX_ACTIVITY_EMAIL_ATTACHMENTS);
                                            setActivityAttachmentFilesByVehicleId((current) => ({
                                              ...current,
                                              [vehicle.id]: nextFiles
                                            }));
                                            event.currentTarget.value = "";
                                          }}
                                          className="mt-2 block w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-shell file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
                                        />
                                        <p className="mt-2 text-xs text-ink/55">
                                          Optional. Up to {MAX_ACTIVITY_EMAIL_ATTACHMENTS} images will be compressed before sending.
                                          {activityAttachmentFiles.length ? ` ${activityAttachmentFiles.length} selected.` : ""}
                                        </p>
                                      </label>
                                      <div className="flex justify-end">
                                        <button
                                          type="button"
                                          disabled={busyAction === `note-${vehicle.id}`}
                                          onClick={() => void handleAddActivityNote(vehicle.id)}
                                          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                                        >
                                          {busyAction === `note-${vehicle.id}` ? "Saving..." : "Add note"}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                      {activityLoading ? (
                                        <p className="text-sm text-ink/60">Loading activity log...</p>
                                      ) : activityEvents.length ? (
                                        <>
                                          <div className="divide-y divide-black/5 rounded-[18px] border border-black/5 bg-white">
                                            {visibleActivityEvents.map((event) => (
                                              <div key={event.id} className="px-4 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                                                    {event.type.replace(/_/g, " ")}
                                                  </p>
                                                  <span className="text-xs text-ink/45">{formatAdminDateTime(event.createdAt)}</span>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-ink/72">{event.message}</p>
                                                <p className="mt-2 text-xs text-ink/45">
                                                  {event.createdBy || event.actorUid || "CarNest"} · {event.visibility}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                          {activityEvents.length > 2 ? (
                                            <div className="flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setExpandedHistoryByVehicleId((current) => ({
                                                    ...current,
                                                    [vehicle.id]: !showFullHistory
                                                  }))
                                                }
                                                className="text-sm font-medium text-ink/65 transition hover:text-bronze"
                                              >
                                                {showFullHistory ? "Collapse" : "View full history"}
                                              </button>
                                            </div>
                                          ) : null}
                                        </>
                                      ) : (
                                        <p className="text-sm text-ink/60">No activity has been logged for this listing yet.</p>
                                      )}
                                      {vehicle.deleteReason ? (
                                        <p className="text-xs text-ink/45">Delete reason recorded on listing: {vehicle.deleteReason}</p>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="rounded-[22px] bg-shell px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-bronze">Actions</p>
                                    <div className="mt-3 flex flex-wrap gap-3">
                                      {!isDeleted ? (
                                        <>
                                          <button
                                            type="button"
                                            disabled={busyAction === `approve-${vehicle.id}` || vehicle.status === "approved"}
                                            onClick={() => void handleInlineAction(vehicle, "approve")}
                                            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            type="button"
                                            disabled={busyAction === `reject-${vehicle.id}` || vehicle.status === "rejected"}
                                            onClick={() => void handleInlineAction(vehicle, "reject")}
                                            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                                          >
                                            Reject
                                          </button>
                                          {canMarkSold ? (
                                            <button
                                              type="button"
                                              disabled={busyAction === `SOLD-${vehicle.id}`}
                                              onClick={() => void handleSellerStatusAction(vehicle, "SOLD")}
                                              className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                                            >
                                              {busyAction === `SOLD-${vehicle.id}` ? "Saving..." : "Mark as Sold"}
                                            </button>
                                          ) : null}
                                          {canUndoSold ? (
                                            <button
                                              type="button"
                                              disabled={busyAction === `ACTIVE-${vehicle.id}`}
                                              onClick={() => void handleSellerStatusAction(vehicle, "ACTIVE")}
                                              className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-40"
                                            >
                                              {busyAction === `ACTIVE-${vehicle.id}` ? "Saving..." : "Undo Sold"}
                                            </button>
                                          ) : null}
                                        </>
                                      ) : null}
                                      {canDeleteListings ? (
                                        isDeleted ? (
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
                                            Delete
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
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/5 bg-white px-6 py-10 text-sm text-ink/60 shadow-panel">
          No vehicles match the current moderation filters.
        </div>
      )}

      {selectedVehicles.length ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex w-[min(920px,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-4 rounded-[24px] border border-black/10 bg-ink px-5 py-4 text-white shadow-2xl">
          <div className="space-y-1">
            <p className="text-sm font-medium">{selectedVehicles.length} listing{selectedVehicles.length === 1 ? "" : "s"} selected</p>
            <button type="button" onClick={toggleSelectAll} className="text-xs uppercase tracking-[0.16em] text-white/75">
              Select all filtered
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {showRestoreBulk ? (
              canDeleteListings ? (
                <button type="button" onClick={() => setPendingBulkAction("restore")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                  Restore selected
                </button>
              ) : null
            ) : (
              <>
                <button type="button" onClick={() => setPendingBulkAction("approve")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                  Approve selected
                </button>
                <button type="button" onClick={() => setPendingBulkAction("reject")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                  Reject selected
                </button>
                {canDeleteListings ? (
                  <button type="button" onClick={() => setPendingBulkAction("delete")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                    Delete selected
                  </button>
                ) : null}
              </>
            )}
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
