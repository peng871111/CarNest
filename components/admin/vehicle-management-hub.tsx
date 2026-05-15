"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  readAdminGrossAmountDrafts,
  writeAdminGrossAmountDrafts
} from "@/components/admin/admin-gross-amount-storage";
import { useAuth } from "@/lib/auth";
import {
  addVehicleActivityNote,
  createEmptyCustomerProfile,
  createEmptyVehicleRecord,
  deleteEmptyCustomerProfiles,
  getVehicleActivityLog,
  saveCustomerProfile,
  saveVehicleRecord,
  updateVehicleActivityImageUrls,
  updateSellerVehicleStatus
} from "@/lib/data";
import { uploadVehicleActivityImages } from "@/lib/storage";
import { hasAdminPermission, isSuperAdminUser } from "@/lib/permissions";
import { formatAdminDateTime, formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { AppUser, CustomerProfile, Vehicle, VehicleActivityEvent, VehicleActor, VehicleRecord, WarehouseIntakeRecord } from "@/types";

type VehicleManagementView = "customers" | "vehicles" | "warehouse" | "listings";
type VehicleOperationalStatus =
  | "Draft"
  | "Warehouse managed"
  | "Private seller managed"
  | "Listed"
  | "Under offer"
  | "Sold"
  | "Withdrawn"
  | "Unlinked";
type PublicListingStatus = "Available" | "Warehouse managed" | "Under offer" | "Sold" | "Draft" | "Withdrawn";
type VehicleListingsFilter = "Active" | "Sold" | "Withdrawn" | "All";
type VehicleRowStatusControl = "ACTIVE" | "SOLD" | "WITHDRAWN";
type VehicleLogComposerMode = "internal" | "owner";
type VehicleGrossDisplayMode = "gst_inclusive" | "no_gst";
type VehiclePaymentMethod = "bank_transfer" | "cash";
type VehicleLogComposerDraft = {
  mode: VehicleLogComposerMode;
  message: string;
  attachmentFiles: File[];
  sendEmail: boolean;
};

function createVehicleLogComposerDraft(mode: VehicleLogComposerMode, sendEmail = false): VehicleLogComposerDraft {
  return {
    mode,
    message: "",
    attachmentFiles: [],
    sendEmail
  };
}

function createActorFromUser(user: AppUser | null): VehicleActor | null {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
    name: user.name,
    adminPermissions: user.adminPermissions
  };
}

function getCustomerLabel(profile: CustomerProfile) {
  return profile.fullName || profile.email || profile.phone || "Customer";
}

function getCustomerProfileDedupKey(profile: CustomerProfile) {
  if (profile.normalizedEmail?.trim()) return `email:${profile.normalizedEmail.trim()}`;
  if (profile.normalizedPhone?.trim()) return `phone:${profile.normalizedPhone.trim()}`;
  const normalizedName = (profile.fullName || "").trim().toLowerCase();
  if (normalizedName) return `name:${normalizedName}`;
  return `id:${profile.id}`;
}

function buildCustomerDisplayId(index: number) {
  return `CUS-${String(index + 1).padStart(4, "0")}`;
}

function getVehicleRecordTitle(record: VehicleRecord) {
  return record.title?.trim() || [record.year, record.make, record.model, record.variant].filter(Boolean).join(" ").trim() || "Vehicle record";
}

function getVehicleListTitle(vehicle: Vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() || getVehicleDisplayReference(vehicle);
}

function getVehicleListedAt(vehicle: Vehicle) {
  return vehicle.approvedAt || vehicle.createdAt || "";
}

function getDaysBetweenIsoDates(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return null;
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
  return Math.max(Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)), 0);
}

function parseMoneyString(value?: string) {
  const normalized = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

function formatEditableMoneyValue(value: number) {
  if (!Number.isFinite(value)) return "";
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function calculateServiceFeeTotals(items: WarehouseIntakeRecord["serviceItems"]) {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const inclusive = items.reduce((sum, item) => sum + (item.gstIncluded ? item.amount : item.amount * 1.1), 0);
  return {
    subtotal,
    inclusive,
    gst: Math.max(inclusive - subtotal, 0)
  };
}

function getListingOperationalStatus(listing?: Vehicle | null): VehicleOperationalStatus | null {
  if (!listing) return null;
  if (listing.deleted || listing.status === "rejected" || listing.sellerStatus === "WITHDRAWN") return "Withdrawn";
  if (listing.sellerStatus === "SOLD" || Boolean(listing.soldAt)) return "Sold";
  if (listing.sellerStatus === "UNDER_OFFER") return "Under offer";
  return listing.listingType === "warehouse" || listing.storedInWarehouse ? "Warehouse managed" : "Listed";
}

function getPublicListingStatus(listing: Vehicle): PublicListingStatus {
  if (listing.deleted || listing.status === "rejected" || listing.sellerStatus === "WITHDRAWN") return "Withdrawn";
  if (listing.sellerStatus === "SOLD" || Boolean(listing.soldAt)) return "Sold";
  if (listing.sellerStatus === "UNDER_OFFER") return "Under offer";
  if (listing.status !== "approved") return "Draft";
  if (listing.sellerStatus === "ACTIVE") {
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
  return `record:${record.id}`;
}

function getVehicleOperationalStatus(record: VehicleRecord, listing: Vehicle | null, intakeCount: number): VehicleOperationalStatus {
  const listingStatus = getListingOperationalStatus(listing);
  if (listingStatus) return listingStatus;
  if (record.status === "sold") return "Sold";
  if (record.status === "withdrawn" || record.status === "archived") return "Withdrawn";
  if (record.status === "private_seller_managed") return "Private seller managed";
  if (record.status === "listed") return "Listed";
  if (record.status === "warehouse_managed" || intakeCount > 0) return "Warehouse managed";
  if (record.status === "draft") return "Draft";
  return "Unlinked";
}

function getStatusTone(status: VehicleOperationalStatus | PublicListingStatus) {
  if (status === "Listed" || status === "Available") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Under offer") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "Sold") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "Withdrawn") return "border-zinc-200 bg-zinc-100 text-zinc-700";
  if (status === "Warehouse managed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Draft") return "border-orange-200 bg-orange-50 text-orange-700";
  if (status === "Private seller managed") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-black/8 bg-shell text-ink/68";
}

function StatusPill({ label }: { label: VehicleOperationalStatus | PublicListingStatus }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${getStatusTone(label)}`}>{label}</span>;
}

function InfoStat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-[18px] border border-black/6 bg-shell px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-bronze">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {helper ? <p className="mt-1 text-xs text-ink/56">{helper}</p> : null}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">{children}</label>;
}

function CompactInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D] ${props.className ?? ""}`} />;
}

function CompactSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D] ${props.className ?? ""}`} />;
}

function CompactTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-[92px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[#C6A87D] ${props.className ?? ""}`} />;
}

const MAX_ACTIVITY_ATTACHMENTS = 5;

export function VehicleManagementHub({
  vehicles,
  owners,
  customerProfiles,
  vehicleRecords,
  intakes,
  writeStatus,
  error,
  defaultView = "vehicles",
  initialCustomerSearch = ""
}: {
  vehicles: Vehicle[];
  owners: AppUser[];
  customerProfiles: CustomerProfile[];
  vehicleRecords: VehicleRecord[];
  intakes: WarehouseIntakeRecord[];
  writeStatus?: string;
  error?: string;
  defaultView?: VehicleManagementView;
  initialCustomerSearch?: string;
}) {
  const { appUser } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const canManageSensitiveCustomerFields = hasAdminPermission(appUser, "manageUsers");
  const isSuperAdmin = isSuperAdminUser(appUser);

  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [openVehicleLogId, setOpenVehicleLogId] = useState<string | null>(null);
  const [vehicleLogItemsByVehicleId, setVehicleLogItemsByVehicleId] = useState<Record<string, VehicleActivityEvent[]>>({});
  const [vehicleLogLoadingByVehicleId, setVehicleLogLoadingByVehicleId] = useState<Record<string, boolean>>({});
  const [vehicleLogErrorByVehicleId, setVehicleLogErrorByVehicleId] = useState<Record<string, string>>({});
  const [vehicleLogComposerByVehicleId, setVehicleLogComposerByVehicleId] = useState<Record<string, VehicleLogComposerDraft | null>>({});
  const [vehicleGrossDisplayById, setVehicleGrossDisplayById] = useState<Record<string, VehicleGrossDisplayMode>>({});
  const [vehicleGrossInclusiveById, setVehicleGrossInclusiveById] = useState<Record<string, number>>({});
  const [vehicleGrossEditingById, setVehicleGrossEditingById] = useState<Record<string, string | null>>({});
  const [vehiclePaymentMethodById, setVehiclePaymentMethodById] = useState<Record<string, VehiclePaymentMethod>>({});
  const [showVehicleSummary, setShowVehicleSummary] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState(initialCustomerSearch);
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<VehicleListingsFilter>(defaultView === "vehicles" ? "Active" : "All");
  const [localVehicles, setLocalVehicles] = useState(vehicles);
  const [localCustomerProfiles, setLocalCustomerProfiles] = useState(customerProfiles);
  const [localVehicleRecords, setLocalVehicleRecords] = useState(vehicleRecords);
  const [localIntakes, setLocalIntakes] = useState(intakes);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [customerDraft, setCustomerDraft] = useState<Omit<CustomerProfile, "id" | "createdAt" | "updatedAt"> | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<Omit<VehicleRecord, "id" | "createdAt" | "updatedAt"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [cleanupDeleting, setCleanupDeleting] = useState(false);
  const [notice, setNotice] = useState(writeStatus || "");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setCustomerSearch(initialCustomerSearch);
  }, [initialCustomerSearch]);

  useEffect(() => {
    setVehicleStatusFilter(defaultView === "vehicles" ? "Active" : "All");
  }, [defaultView]);

  useEffect(() => {
    setLocalVehicles(vehicles);
  }, [vehicles]);

  useEffect(() => {
    setLocalCustomerProfiles(customerProfiles);
  }, [customerProfiles]);

  useEffect(() => {
    setLocalVehicleRecords(vehicleRecords);
  }, [vehicleRecords]);

  useEffect(() => {
    setLocalIntakes(intakes);
  }, [intakes]);

  useEffect(() => {
    const drafts = readAdminGrossAmountDrafts();
    setVehicleGrossInclusiveById(
      Object.fromEntries(
        Object.entries(drafts).map(([vehicleId, draft]) => [vehicleId, draft.grossInclusiveAmount])
      )
    );
    setVehicleGrossDisplayById(
      Object.fromEntries(
        Object.entries(drafts).map(([vehicleId, draft]) => [vehicleId, draft.displayMode])
      )
    );
    setVehiclePaymentMethodById(
      Object.fromEntries(
        Object.entries(drafts).map(([vehicleId, draft]) => [vehicleId, draft.paymentMethod])
      )
    );
  }, []);

  useEffect(() => {
    const allVehicleIds = new Set([
      ...Object.keys(vehicleGrossInclusiveById),
      ...Object.keys(vehicleGrossDisplayById),
      ...Object.keys(vehiclePaymentMethodById)
    ]);
    if (!allVehicleIds.size) return;

    const drafts = Object.fromEntries(
      [...allVehicleIds]
        .map((vehicleId) => {
          const grossInclusiveAmount = vehicleGrossInclusiveById[vehicleId];
          if (!Number.isFinite(grossInclusiveAmount) || grossInclusiveAmount < 0) return null;
          return [
            vehicleId,
            {
              grossInclusiveAmount,
              displayMode: vehicleGrossDisplayById[vehicleId] ?? "gst_inclusive",
              paymentMethod: vehiclePaymentMethodById[vehicleId] ?? "bank_transfer"
            }
          ] as const;
        })
        .filter((entry): entry is readonly [string, { grossInclusiveAmount: number; displayMode: VehicleGrossDisplayMode; paymentMethod: VehiclePaymentMethod }] => entry != null)
    );

    writeAdminGrossAmountDrafts(drafts);
  }, [vehicleGrossDisplayById, vehicleGrossInclusiveById, vehiclePaymentMethodById]);

  const listingMap = useMemo(() => new Map(localVehicles.map((vehicle) => [vehicle.id, vehicle])), [localVehicles]);
  const customerMap = useMemo(() => new Map(localCustomerProfiles.map((profile) => [profile.id, profile])), [localCustomerProfiles]);
  const ownerMap = useMemo(() => new Map(owners.map((owner) => [owner.id, owner])), [owners]);
  const intakesByVehicleRecordId = useMemo(() => {
    const map = new Map<string, WarehouseIntakeRecord[]>();
    localIntakes.forEach((intake) => {
      if (!intake.vehicleRecordId) return;
      const existing = map.get(intake.vehicleRecordId) ?? [];
      existing.push(intake);
      map.set(intake.vehicleRecordId, existing);
    });
    map.forEach((items, key) => {
      map.set(key, [...items].sort((left, right) => (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || "")));
    });
    return map;
  }, [localIntakes]);
  const intakesByVehicleId = useMemo(() => {
    const map = new Map<string, WarehouseIntakeRecord[]>();
    localIntakes.forEach((intake) => {
      if (!intake.vehicleId) return;
      const existing = map.get(intake.vehicleId) ?? [];
      existing.push(intake);
      map.set(intake.vehicleId, existing);
    });
    map.forEach((items, key) => {
      map.set(key, [...items].sort((left, right) => (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || "")));
    });
    return map;
  }, [localIntakes]);

  const customerRows = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    const latestProfiles = new Map<string, CustomerProfile>();
    const customerDisplayIdById = new Map(
      [...localCustomerProfiles]
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt || left.updatedAt || 0).getTime();
          const rightTime = new Date(right.createdAt || right.updatedAt || 0).getTime();
          if (leftTime !== rightTime) return leftTime - rightTime;
          return left.id.localeCompare(right.id);
        })
        .map((profile, index) => [profile.id, buildCustomerDisplayId(index)] as const)
    );

    localCustomerProfiles
      .filter((profile) => profile.status !== "archived")
      .forEach((profile) => {
        const key = getCustomerProfileDedupKey(profile);
        const existing = latestProfiles.get(key);
        if (!existing || (profile.updatedAt || profile.createdAt || "") >= (existing.updatedAt || existing.createdAt || "")) {
          latestProfiles.set(key, profile);
        }
      });

    return [...latestProfiles.values()]
      .map((profile) => {
        const hasUsableIdentity = Boolean(profile.fullName.trim() || profile.phone.trim() || profile.email.trim());
        const dedupedRecords = new Map<string, VehicleRecord>();
        localVehicleRecords
          .filter((record) => record.customerProfileId === profile.id && record.status !== "archived")
          .forEach((record) => {
            const key = getRecordDedupKey(record);
            const existing = dedupedRecords.get(key);
            if (!existing || (record.updatedAt || "") >= (existing.updatedAt || "")) {
              dedupedRecords.set(key, record);
            }
          });

        const linkedVehicles = [...dedupedRecords.values()]
          .map((record) => {
            const listing = record.publicListingId ? listingMap.get(record.publicListingId) ?? null : null;
            const intakeHistory = intakesByVehicleRecordId.get(record.id) ?? [];
            const latestIntake = intakeHistory[0] ?? null;
            const estimatedRevenue = record.gstInclusiveServiceFeeTotal
              || intakeHistory.reduce((sum, intake) => sum + calculateServiceFeeTotals(intake.serviceItems).inclusive, 0);
            return {
              record,
              listing,
              intakeCount: intakeHistory.length,
              latestIntake,
              estimatedRevenue,
              status: getVehicleOperationalStatus(record, listing, intakeHistory.length)
            };
          })
          .sort((left, right) => getVehicleRecordTitle(left.record).localeCompare(getVehicleRecordTitle(right.record)));

        const searchText = [
          customerDisplayIdById.get(profile.id) ?? "",
          getCustomerLabel(profile),
          profile.email,
          profile.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return {
          profile,
          linkedVehicles,
          searchText,
          hasUsableIdentity,
          displayCustomerId: customerDisplayIdById.get(profile.id) ?? "CUS-pending"
        };
      })
      .filter((row) => row.hasUsableIdentity)
      .filter((row) => (term ? row.searchText.includes(term) : true))
      .sort((left, right) => getCustomerLabel(left.profile).localeCompare(getCustomerLabel(right.profile)));
  }, [customerSearch, intakesByVehicleRecordId, listingMap, localCustomerProfiles, localVehicleRecords]);

  const listingRows = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    return localVehicles
      .map((vehicle) => {
        const linkedRecord = localVehicleRecords.find((record) => record.publicListingId === vehicle.id) ?? null;
        const linkedCustomer = linkedRecord?.customerProfileId ? customerMap.get(linkedRecord.customerProfileId) ?? null : null;
        const linkedSeller = ownerMap.get(vehicle.ownerUid) ?? null;
        const linkedIntakes = Array.from(
          new Map(
            [
              ...(linkedRecord ? intakesByVehicleRecordId.get(linkedRecord.id) ?? [] : []),
              ...(intakesByVehicleId.get(vehicle.id) ?? [])
            ].map((intake) => [intake.id, intake] as const)
          ).values()
        ).sort((left, right) => (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""));
        const projectedRevenue = linkedRecord?.estimatedTotalIncome
          || linkedIntakes.reduce((sum, intake) => sum + calculateServiceFeeTotals(intake.serviceItems).inclusive, 0);
        const status = getPublicListingStatus(vehicle);
        const filterGroup: VehicleListingsFilter =
          status === "Sold"
            ? "Sold"
            : status === "Withdrawn"
              ? "Withdrawn"
              : "Active";
        const searchText = [
          getVehicleDisplayReference(vehicle),
          vehicle.make,
          vehicle.model,
          vehicle.variant,
          vehicle.rego,
          vehicle.vin,
          linkedCustomer?.fullName,
          linkedCustomer?.phone,
          linkedCustomer?.email,
          linkedSeller?.displayName,
          linkedSeller?.name,
          linkedSeller?.email
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return { vehicle, linkedRecord, linkedCustomer, linkedSeller, linkedIntakes, projectedRevenue, status, filterGroup, searchText };
      })
      .filter((row) => {
        if (vehicleStatusFilter === "All") return true;
        if (row.status === "Draft") return false;
        return row.filterGroup === vehicleStatusFilter;
      })
      .filter((row) => (term ? row.searchText.includes(term) : true))
      .sort((left, right) => {
        const leftRef = getVehicleDisplayReference(left.vehicle);
        const rightRef = getVehicleDisplayReference(right.vehicle);
        return leftRef.localeCompare(rightRef);
      });
  }, [customerMap, globalSearch, intakesByVehicleId, intakesByVehicleRecordId, localVehicleRecords, localVehicles, ownerMap, vehicleStatusFilter]);

  const workspaceMetrics = useMemo(() => {
    const listingLinkedRecords = localVehicleRecords
      .map((record) => {
        const listing = record.publicListingId ? listingMap.get(record.publicListingId) ?? null : null;
        const status = getVehicleOperationalStatus(record, listing, (intakesByVehicleRecordId.get(record.id) ?? []).length);
        return { record, listing, status };
      });
    const activeListingRevenue = listingLinkedRecords
      .filter((row) => row.listing && isPublicInventoryListing(row.listing))
      .reduce((sum, row) => sum + (row.record.gstInclusiveServiceFeeTotal ?? 0), 0);
    const warehouseManagedRevenue = listingLinkedRecords
      .filter((row) => row.status === "Warehouse managed")
      .reduce((sum, row) => sum + (row.record.gstInclusiveServiceFeeTotal ?? 0), 0);
    const pendingFees = localIntakes
      .filter((intake) => intake.status !== "signed")
      .reduce((sum, intake) => sum + calculateServiceFeeTotals(intake.serviceItems).inclusive, 0);
    const totalActiveListingPotentialRevenue = localVehicles
      .filter((vehicle) => isPublicInventoryListing(vehicle))
      .reduce((sum, vehicle) => {
        const linkedRecord = localVehicleRecords.find((record) => record.publicListingId === vehicle.id);
        return sum + (linkedRecord?.estimatedTotalIncome || vehicle.price || 0);
      }, 0);
    return {
      activeListingRevenue,
      warehouseManagedRevenue,
      pendingFees,
      totalActiveListingPotentialRevenue
    };
  }, [intakesByVehicleRecordId, listingMap, localIntakes, localVehicleRecords, localVehicles]);

  async function handleVehicleListingStatusChange(vehicle: Vehicle, nextStatus: VehicleRowStatusControl) {
    if (!actor) return;

    try {
      setSaving(true);
      const result = await updateSellerVehicleStatus(vehicle.id, nextStatus, actor, vehicle);
      setLocalVehicles((current) =>
        current
          .map((item) => (item.id === vehicle.id ? result.vehicle : item))
          .sort((left, right) => getVehicleDisplayReference(left).localeCompare(getVehicleDisplayReference(right)))
      );
      setNotice(`${getVehicleDisplayReference(result.vehicle)} status updated to ${nextStatus.toLowerCase().replace(/_/g, " ")}.`);
      setActionError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "We couldn't update the listing status.");
    } finally {
      setSaving(false);
    }
  }

  function openCustomerEditor(profile?: CustomerProfile) {
    setActionError("");
    setNotice("");
    setEditingCustomerId(profile?.id ?? "new");
    if (profile) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...nextDraft } = profile;
      setCustomerDraft(nextDraft);
      return;
    }
    setCustomerDraft(createEmptyCustomerProfile());
  }

  function openVehicleEditor(record?: VehicleRecord, customerProfileId = "") {
    setActionError("");
    setNotice("");
    setEditingVehicleId(record?.id ?? "new");
    if (record) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...nextDraft } = record;
      setVehicleDraft(nextDraft);
      return;
    }
    setVehicleDraft({ ...createEmptyVehicleRecord(), customerProfileId, status: "draft" });
  }

  function openVehicleEditorForListing(listing: Vehicle, linkedRecord?: VehicleRecord | null) {
    if (linkedRecord) {
      openVehicleEditor(linkedRecord, linkedRecord.customerProfileId || "");
      return;
    }

    setActionError("");
    setNotice("");
    setEditingVehicleId("new");
    setVehicleDraft({
      ...createEmptyVehicleRecord(),
      customerProfileId: "",
      publicListingId: listing.id,
      displayReference: getVehicleDisplayReference(listing),
      title: `${listing.year} ${listing.make} ${listing.model} ${listing.variant}`.trim(),
      make: listing.make || "",
      model: listing.model || "",
      variant: listing.variant || "",
      year: String(listing.year || ""),
      registrationPlate: listing.rego || "",
      vin: listing.vin || "",
      colour: listing.colour || "",
      odometer: String(listing.mileage || ""),
      fuelType: listing.fuelType || "",
      transmission: listing.transmission || "",
      askingPrice: String(listing.price || ""),
      status: listing.storedInWarehouse || listing.listingType === "warehouse" ? "warehouse_managed" : "listed"
    });
  }

  async function handleSaveCustomer() {
    if (!actor || !customerDraft) return;
    try {
      setSaving(true);
      const result = await saveCustomerProfile(customerDraft, actor, editingCustomerId === "new" ? undefined : editingCustomerId || undefined);
      setLocalCustomerProfiles((current) => {
        const next = current.filter((profile) => profile.id !== result.profile.id).concat(result.profile);
        return next.sort((left, right) => getCustomerLabel(left).localeCompare(getCustomerLabel(right)));
      });
      setNotice(editingCustomerId === "new" ? "Customer profile created." : "Customer profile updated.");
      setEditingCustomerId(null);
      setCustomerDraft(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "We couldn't save the customer profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveVehicle() {
    if (!actor || !vehicleDraft) return;
    try {
      setSaving(true);
      const result = await saveVehicleRecord(vehicleDraft, actor, editingVehicleId === "new" ? undefined : editingVehicleId || undefined);
      setLocalVehicleRecords((current) => {
        const next = current.filter((record) => record.id !== result.vehicleRecord.id).concat(result.vehicleRecord);
        return next.sort((left, right) => getVehicleRecordTitle(left).localeCompare(getVehicleRecordTitle(right)));
      });
      setNotice(editingVehicleId === "new" ? "Vehicle record created." : "Vehicle record updated.");
      setEditingVehicleId(null);
      setVehicleDraft(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "We couldn't save the vehicle record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEmptyCustomers() {
    if (!actor || !isSuperAdmin) return;
    if (!window.confirm("Delete all empty customer records with no name, phone, email, listing link, or signed intake history? This cannot be undone.")) {
      return;
    }

    try {
      setCleanupDeleting(true);
      const result = await deleteEmptyCustomerProfiles(actor);
      if (!result.deletedIds.length) {
        setNotice("No empty customer records needed cleanup.");
        return;
      }
      setLocalCustomerProfiles((current) => current.filter((profile) => !result.deletedIds.includes(profile.id)));
      setNotice(`Deleted ${result.deletedIds.length} empty customer record${result.deletedIds.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "We couldn't delete empty customer records.");
    } finally {
      setCleanupDeleting(false);
    }
  }

  async function openVehicleLog(vehicleId: string) {
    setOpenVehicleLogId((current) => (current === vehicleId ? null : vehicleId));
    if (vehicleLogItemsByVehicleId[vehicleId] || vehicleLogLoadingByVehicleId[vehicleId]) {
      return;
    }

    try {
      setVehicleLogLoadingByVehicleId((current) => ({ ...current, [vehicleId]: true }));
      setVehicleLogErrorByVehicleId((current) => ({ ...current, [vehicleId]: "" }));
      const result = await getVehicleActivityLog(vehicleId);
      setVehicleLogItemsByVehicleId((current) => ({ ...current, [vehicleId]: result.items }));
      if (result.error) {
        setVehicleLogErrorByVehicleId((current) => ({ ...current, [vehicleId]: result.error || "" }));
      }
    } catch (error) {
      setVehicleLogErrorByVehicleId((current) => ({
        ...current,
        [vehicleId]: error instanceof Error ? error.message : "We couldn't load the vehicle log."
      }));
    } finally {
      setVehicleLogLoadingByVehicleId((current) => ({ ...current, [vehicleId]: false }));
    }
  }

  function openVehicleLogComposer(vehicleId: string, mode: VehicleLogComposerMode, ownerEmail = "") {
    setOpenVehicleLogId(vehicleId);
    setVehicleLogComposerByVehicleId((current) => ({
      ...current,
      [vehicleId]: createVehicleLogComposerDraft(mode, mode === "owner" && Boolean(ownerEmail.trim()))
    }));
    if (!vehicleLogItemsByVehicleId[vehicleId] && !vehicleLogLoadingByVehicleId[vehicleId]) {
      void openVehicleLog(vehicleId);
    }
  }

  async function handleSaveVehicleLog(
    vehicle: Vehicle,
    customer: CustomerProfile | null,
    mode: VehicleLogComposerMode
  ) {
    if (!actor) return;
    const draft = vehicleLogComposerByVehicleId[vehicle.id];
    if (!draft) return;

    try {
      setSaving(true);
      const recipientEmail = customer?.email || vehicle.customerEmail || "";
      const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant}`.trim();
      const result = await addVehicleActivityNote(vehicle.id, draft.message, actor, {
        visibility: mode === "owner" ? "customer" : "admin",
        type: "admin_note_added",
        sendEmail: false,
        recipientEmail,
        vehicleTitle,
        referenceId: getVehicleDisplayReference(vehicle)
      });

      let uploadedImageUrls: string[] = [];
      let emailSentStatus: VehicleActivityEvent["emailSentStatus"] = result.event?.emailSentStatus ?? "not_requested";
      let emailErrorMessage = result.event?.emailErrorMessage;

      if (result.event?.id && mode !== "internal" && draft.attachmentFiles.length) {
        uploadedImageUrls = await uploadVehicleActivityImages(
          draft.attachmentFiles.slice(0, MAX_ACTIVITY_ATTACHMENTS),
          vehicle.id,
          result.event.id
        );
        await updateVehicleActivityImageUrls(result.event.id, uploadedImageUrls, actor);
      }

      if (mode === "owner" && draft.sendEmail) {
        if (!recipientEmail.trim()) {
          emailSentStatus = "no_email";
        } else {
          try {
            const response = await fetch("/api/vehicle-activity-notifications", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                vehicleId: vehicle.id,
                customerEmail: recipientEmail,
                customerName: customer?.fullName || vehicle.customerName || "",
                vehicleTitle,
                referenceId: getVehicleDisplayReference(vehicle),
                message: draft.message,
                updateType: "customer_update",
                imageUrls: uploadedImageUrls
              }),
              cache: "no-store"
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok || payload?.success === false) {
              emailSentStatus = "send_failed";
              emailErrorMessage = payload?.error || "Customer update email failed to send.";
            } else if (payload?.sent === false && payload?.reason === "no_customer_email_set") {
              emailSentStatus = "no_email";
            } else if (payload?.sent === false && payload?.reason === "missing_env") {
              emailSentStatus = "missing_env";
            } else if (payload?.sent === true) {
              emailSentStatus = "sent";
              emailErrorMessage = "";
            } else {
              emailSentStatus = "send_failed";
              emailErrorMessage = payload?.error || "Customer update email failed to send.";
            }
          } catch (error) {
            emailSentStatus = "send_failed";
            emailErrorMessage = error instanceof Error ? error.message : "Customer update email failed to send.";
          }
        }
      }

      if (result.event) {
        const nextEvent: VehicleActivityEvent = {
          ...result.event,
          imageUrls: uploadedImageUrls,
          emailSentStatus,
          emailErrorMessage
        };
        setVehicleLogItemsByVehicleId((current) => ({
          ...current,
          [vehicle.id]: [nextEvent, ...(current[vehicle.id] ?? [])]
        }));
      }
      setVehicleLogComposerByVehicleId((current) => ({ ...current, [vehicle.id]: null }));

      if (mode === "owner") {
        if (emailSentStatus === "sent") {
          setNotice("Notes to customer saved and email sent.");
        } else if (emailSentStatus === "no_email") {
          setNotice("Notes to customer saved. No owner email was available to send.");
        } else if (emailSentStatus === "missing_env") {
          setNotice("Notes to customer saved. Email delivery is not configured in this environment.");
        } else if (emailSentStatus === "send_failed") {
          setNotice("Notes to customer saved, but the email could not be sent.");
        } else {
          setNotice("Notes to customer saved.");
        }
      } else {
        setNotice("Internal note saved to the vehicle log.");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "We couldn't save that vehicle log entry.");
    } finally {
      setSaving(false);
    }
  }

  function openGrossAmountEditor(vehicleId: string, currentValue: number) {
    setVehicleGrossEditingById((current) => ({
      ...current,
      [vehicleId]: formatEditableMoneyValue(currentValue)
    }));
  }

  function commitGrossAmount(vehicleId: string, displayMode: VehicleGrossDisplayMode) {
    const rawValue = vehicleGrossEditingById[vehicleId];
    if (rawValue == null) return;

    const parsedValue = parseMoneyString(rawValue);
    const normalizedDisplayValue = Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
    const normalizedInclusiveValue = displayMode === "gst_inclusive"
      ? normalizedDisplayValue
      : normalizedDisplayValue * 1.1;

    setVehicleGrossInclusiveById((current) => ({
      ...current,
      [vehicleId]: normalizedInclusiveValue
    }));
    setVehicleGrossEditingById((current) => ({
      ...current,
      [vehicleId]: null
    }));
  }

  function cancelGrossAmountEditor(vehicleId: string) {
    setVehicleGrossEditingById((current) => ({
      ...current,
      [vehicleId]: null
    }));
  }

  const showingVehiclesPage = defaultView === "vehicles" || defaultView === "listings";
  const showingCustomersPage = defaultView === "customers";
  const pageEyebrow = showingCustomersPage ? "Customers" : "Vehicles";
  const pageTitle = showingCustomersPage ? "Customer profiles" : "Vehicles and listings";
  const pageDescription = showingCustomersPage
    ? "Search active customer profiles, open linked vehicles, and keep owner records tidy for staff."
    : "Work from live listings first, then link owners and storage contract paperwork without touching the public website.";

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">{pageEyebrow}</p>
            <h2 className="mt-2 font-display text-3xl text-ink">{pageTitle}</h2>
            <p className="mt-2 text-sm text-ink/60">{pageDescription}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {showingVehiclesPage ? (
              <Link href="/admin/warehouse-intake" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92">
                Storage contracts
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => (showingCustomersPage ? openCustomerEditor() : openVehicleEditor())}
              className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
            >
              {showingCustomersPage ? "New customer" : "New vehicle"}
            </button>
          </div>
        </div>
      </div>

      {notice ? <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {actionError ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{actionError}</div> : null}
      {error ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}

      {editingCustomerId && customerDraft ? (
        <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">Customer profile</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{editingCustomerId === "new" ? "Create reusable customer profile" : "Edit customer profile"}</h3>
            </div>
            <button type="button" onClick={() => { setEditingCustomerId(null); setCustomerDraft(null); }} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 xl:col-span-2">
              <FieldLabel>Full name</FieldLabel>
              <CompactInput value={customerDraft.fullName} onChange={(event) => setCustomerDraft((current) => current ? { ...current, fullName: event.target.value } : current)} />
            </div>
            <div className="space-y-2">
              <FieldLabel>Phone</FieldLabel>
              <CompactInput value={customerDraft.phone} onChange={(event) => setCustomerDraft((current) => current ? { ...current, phone: event.target.value } : current)} />
            </div>
            <div className="space-y-2">
              <FieldLabel>Email</FieldLabel>
              <CompactInput type="email" value={customerDraft.email} onChange={(event) => setCustomerDraft((current) => current ? { ...current, email: event.target.value } : current)} />
            </div>
            <div className="space-y-2 xl:col-span-4">
              <FieldLabel>Address</FieldLabel>
              <CompactTextarea className="min-h-[84px]" value={customerDraft.address} onChange={(event) => setCustomerDraft((current) => current ? { ...current, address: event.target.value } : current)} />
            </div>
            {canManageSensitiveCustomerFields ? (
              <>
                <div className="space-y-2">
                  <FieldLabel>Date of birth</FieldLabel>
                  <CompactInput type="date" value={customerDraft.dateOfBirth} onChange={(event) => setCustomerDraft((current) => current ? { ...current, dateOfBirth: event.target.value } : current)} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>ID type</FieldLabel>
                  <CompactSelect value={customerDraft.identificationDocumentType} onChange={(event) => setCustomerDraft((current) => current ? { ...current, identificationDocumentType: event.target.value as CustomerProfile["identificationDocumentType"] } : current)}>
                    <option value="">Not set</option>
                    <option value="driver_licence">Driver licence</option>
                    <option value="passport">Passport</option>
                    <option value="other">Other</option>
                  </CompactSelect>
                </div>
                <div className="space-y-2">
                  <FieldLabel>ID number</FieldLabel>
                  <CompactInput value={customerDraft.identificationDocumentNumber} onChange={(event) => setCustomerDraft((current) => current ? { ...current, identificationDocumentNumber: event.target.value } : current)} />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink">
                  <input type="checkbox" checked={customerDraft.companyOwned} onChange={(event) => setCustomerDraft((current) => current ? { ...current, companyOwned: event.target.checked } : current)} className="h-4 w-4 rounded border-black/20 text-ink" />
                  <span>Company-owned customer profile</span>
                </label>
                {customerDraft.companyOwned ? (
                  <>
                    <div className="space-y-2 xl:col-span-2">
                      <FieldLabel>Company name</FieldLabel>
                      <CompactInput value={customerDraft.companyName} onChange={(event) => setCustomerDraft((current) => current ? { ...current, companyName: event.target.value } : current)} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>ABN</FieldLabel>
                      <CompactInput value={customerDraft.abn} onChange={(event) => setCustomerDraft((current) => current ? { ...current, abn: event.target.value } : current)} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>ACN</FieldLabel>
                      <CompactInput value={customerDraft.acn} onChange={(event) => setCustomerDraft((current) => current ? { ...current, acn: event.target.value } : current)} />
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => { setEditingCustomerId(null); setCustomerDraft(null); }} className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSaveCustomer()} disabled={saving} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:opacity-50">
              {saving ? "Saving..." : "Save customer"}
            </button>
          </div>
        </section>
      ) : null}

      {editingVehicleId && vehicleDraft ? (
        <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">Vehicle record</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{editingVehicleId === "new" ? "Create core vehicle record" : "Edit core vehicle record"}</h3>
            </div>
            <button type="button" onClick={() => { setEditingVehicleId(null); setVehicleDraft(null); }} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["title", "Vehicle title"],
              ["make", "Make"],
              ["model", "Model"],
              ["variant", "Variant"],
              ["year", "Year"],
              ["registrationPlate", "Registration plate"],
              ["vin", "VIN"],
              ["odometer", "Odometer"],
              ["colour", "Exterior colour"],
              ["fuelType", "Fuel type"],
              ["transmission", "Transmission"],
              ["askingPrice", "Asking price"],
              ["reservePrice", "Reserve price"],
              ["displayReference", "Listing ID / reference"]
            ].map(([key, label]) => (
              <div key={key} className="space-y-2">
                <FieldLabel>{label}</FieldLabel>
                <CompactInput value={(vehicleDraft[key as keyof typeof vehicleDraft] as string) || ""} onChange={(event) => setVehicleDraft((current) => current ? { ...current, [key]: event.target.value } : current)} />
              </div>
            ))}
            <div className="space-y-2">
              <FieldLabel>Status</FieldLabel>
              <CompactSelect value={vehicleDraft.status} onChange={(event) => setVehicleDraft((current) => current ? { ...current, status: event.target.value as VehicleRecord["status"] } : current)}>
                <option value="draft">Draft</option>
                <option value="warehouse_managed">Warehouse managed</option>
                <option value="private_seller_managed">Private seller managed</option>
                <option value="listed">Listed</option>
                <option value="under_offer">Under offer</option>
                <option value="sold">Sold</option>
                <option value="withdrawn">Withdrawn</option>
              </CompactSelect>
            </div>
            <div className="space-y-2">
              <FieldLabel>Linked customer</FieldLabel>
              <CompactSelect value={vehicleDraft.customerProfileId || ""} onChange={(event) => setVehicleDraft((current) => current ? { ...current, customerProfileId: event.target.value } : current)}>
                <option value="">Not linked</option>
                {localCustomerProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{getCustomerLabel(profile)}</option>
                ))}
              </CompactSelect>
            </div>
            <div className="space-y-2 xl:col-span-2">
              <FieldLabel>Linked public listing</FieldLabel>
              <CompactSelect value={vehicleDraft.publicListingId || ""} onChange={(event) => setVehicleDraft((current) => current ? { ...current, publicListingId: event.target.value } : current)}>
                <option value="">No public listing linked</option>
                {localVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{getVehicleDisplayReference(vehicle)} · {vehicle.year} {vehicle.make} {vehicle.model}</option>
                ))}
              </CompactSelect>
            </div>
            <div className="space-y-2 xl:col-span-4">
              <FieldLabel>Internal notes</FieldLabel>
              <CompactTextarea value={vehicleDraft.notes} onChange={(event) => setVehicleDraft((current) => current ? { ...current, notes: event.target.value } : current)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => { setEditingVehicleId(null); setVehicleDraft(null); }} className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSaveVehicle()} disabled={saving} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:opacity-50">
              {saving ? "Saving..." : "Save vehicle"}
            </button>
          </div>
        </section>
      ) : null}

      {showingVehiclesPage ? (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap gap-3">
              <CompactInput
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Search listing ID, customer, phone, VIN, rego, make, or model"
                className="min-w-[260px] flex-1"
              />
              <CompactSelect value={vehicleStatusFilter} onChange={(event) => setVehicleStatusFilter(event.target.value as VehicleListingsFilter)} className="w-full md:w-56">
                <option value="Active">Active</option>
                <option value="Sold">Sold</option>
                <option value="Withdrawn">Withdrawn</option>
                <option value="All">All</option>
              </CompactSelect>
              <button
                type="button"
                onClick={() => setShowVehicleSummary((current) => !current)}
                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
              >
                {showVehicleSummary ? "Hide summary" : "Show summary"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {listingRows.map(({ vehicle, linkedRecord, linkedCustomer, linkedSeller, linkedIntakes, projectedRevenue, status }) => {
                const latestIntake = linkedIntakes[0] ?? null;
                const storageContractStatus = latestIntake
                  ? latestIntake.status === "signed"
                    ? "Contract signed"
                    : latestIntake.status === "review_ready"
                  ? "Ready for signature"
                      : "Draft contract"
                  : "No contract";
                const ownerEmail = linkedCustomer?.email || vehicle.customerEmail || "";
                const logItems = vehicleLogItemsByVehicleId[vehicle.id] ?? [];
                const logComposer = vehicleLogComposerByVehicleId[vehicle.id] ?? null;
                const logLoading = vehicleLogLoadingByVehicleId[vehicle.id] ?? false;
                const logError = vehicleLogErrorByVehicleId[vehicle.id] ?? "";
                const logOpen = openVehicleLogId === vehicle.id;
                const grossDisplayMode = vehicleGrossDisplayById[vehicle.id] ?? "gst_inclusive";
                const paymentMethod = vehiclePaymentMethodById[vehicle.id] ?? "bank_transfer";
                const baseGrossInclusiveAmount = vehicleGrossInclusiveById[vehicle.id] ?? projectedRevenue;
                const grossAmount = grossDisplayMode === "gst_inclusive"
                  ? baseGrossInclusiveAmount
                  : baseGrossInclusiveAmount > 0
                    ? baseGrossInclusiveAmount / 1.1
                    : 0;
                const grossEditingValue = vehicleGrossEditingById[vehicle.id];
                const listedAt = getVehicleListedAt(vehicle);
                const listingEndDate = vehicle.soldAt || new Date().toISOString();
                const daysListed = listedAt ? getDaysBetweenIsoDates(listedAt, listingEndDate) : null;

                return (
                <div key={vehicle.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/52">
                        <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-semibold text-ink/72">
                          {getVehicleDisplayReference(vehicle)}
                        </span>
                        <span>{vehicle.listingType === "warehouse" || vehicle.storedInWarehouse ? "Warehouse" : "Private"}</span>
                      </div>
                      <p className="mt-2 text-base font-semibold text-ink xl:text-lg">
                        {[vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ").trim() || getVehicleListTitle(vehicle)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/60">
                        <span>{formatCurrency(vehicle.price)}</span>
                        <span>{vehicle.mileage.toLocaleString()} km</span>
                        <span>{daysListed != null ? `Listed ${daysListed} day${daysListed === 1 ? "" : "s"}` : "Listed date pending"}</span>
                        {latestIntake ? (
                          <Link href={`/admin/warehouse-intake/${latestIntake.id}`} className="font-semibold text-ink underline-offset-4 transition hover:text-bronze hover:underline">
                            View contract
                          </Link>
                        ) : (
                          <span>No contract</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 xl:items-end">
                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <StatusPill label={status === "Available" ? "Listed" : status === "Warehouse managed" ? "Warehouse managed" : status} />
                        <CompactSelect
                          value={vehicle.sellerStatus === "SOLD" ? "SOLD" : vehicle.sellerStatus === "WITHDRAWN" ? "WITHDRAWN" : "ACTIVE"}
                          onChange={(event) => void handleVehicleListingStatusChange(vehicle, event.target.value as VehicleRowStatusControl)}
                          disabled={saving}
                          className="min-h-[40px] w-[150px] rounded-full px-4 py-2 text-xs font-semibold"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="SOLD">Sold</option>
                          <option value="WITHDRAWN">Withdrawn</option>
                        </CompactSelect>
                      </div>

                      <div className="hidden flex-wrap gap-2 xl:justify-end">
                        <Link href={`/admin/vehicles/${vehicle.id}/edit`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Edit listing
                        </Link>
                        <Link href={`/admin/vehicles/${vehicle.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          View listing
                        </Link>
                        <button type="button" onClick={() => openVehicleEditorForListing(vehicle, linkedRecord)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          {linkedCustomer ? "Change owner" : "Assign owner"}
                        </button>
                        {linkedCustomer ? (
                          <Link href={`/admin/customers?customerId=${linkedCustomer.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                            Open customer
                          </Link>
                        ) : null}
                        {latestIntake ? (
                          <Link href={`/admin/warehouse-intake/${latestIntake.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                            Open storage contract
                          </Link>
                        ) : linkedRecord ? (
                          <Link href={`/admin/warehouse-intake/new?customerProfileId=${linkedRecord.customerProfileId || ""}&vehicleRecordId=${linkedRecord.id}&vehicleId=${vehicle.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                            Start storage contract
                          </Link>
                        ) : (
                          <Link href={`/admin/warehouse-intake/new?vehicleId=${vehicle.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                            Start storage contract
                          </Link>
                        )}
                        <button type="button" onClick={() => void openVehicleLog(vehicle.id)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Vehicle log
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t border-black/6 pt-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (grossEditingValue == null) {
                            openGrossAmountEditor(vehicle.id, grossAmount);
                          }
                        }}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && grossEditingValue == null) {
                            event.preventDefault();
                            openGrossAmountEditor(vehicle.id, grossAmount);
                          }
                        }}
                        className={`rounded-2xl border bg-white px-3 py-2.5 transition ${
                          grossEditingValue != null
                            ? "border-[#C6A87D] shadow-[0_0_0_1px_rgba(198,168,125,0.3)]"
                            : "cursor-text border-black/8 hover:border-[#C6A87D]"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.18em] text-bronze">Gross amount</p>
                        {grossEditingValue != null ? (
                          <input
                            autoFocus
                            inputMode="decimal"
                            value={grossEditingValue}
                            onChange={(event) => setVehicleGrossEditingById((current) => ({
                              ...current,
                              [vehicle.id]: event.target.value
                            }))}
                            onBlur={() => commitGrossAmount(vehicle.id, grossDisplayMode)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                commitGrossAmount(vehicle.id, grossDisplayMode);
                              }
                              if (event.key === "Escape") {
                                cancelGrossAmountEditor(vehicle.id);
                              }
                            }}
                            className="mt-1 w-[140px] border-0 bg-transparent p-0 text-sm font-semibold text-ink outline-none"
                          />
                        ) : (
                          <p className="mt-1 text-sm font-semibold text-ink">{formatCurrency(grossAmount)}</p>
                        )}
                      </div>
                      <CompactSelect
                        value={grossDisplayMode}
                        onChange={(event) => setVehicleGrossDisplayById((current) => ({
                          ...current,
                          [vehicle.id]: event.target.value as VehicleGrossDisplayMode
                        }))}
                        className="min-h-[42px] w-full sm:w-[160px]"
                      >
                        <option value="gst_inclusive">GST inclusive</option>
                        <option value="no_gst">No GST</option>
                      </CompactSelect>
                      <CompactSelect
                        value={paymentMethod}
                        onChange={(event) => setVehiclePaymentMethodById((current) => ({
                          ...current,
                          [vehicle.id]: event.target.value as VehiclePaymentMethod
                        }))}
                        className="min-h-[42px] w-full sm:w-[170px]"
                      >
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="cash">Cash</option>
                      </CompactSelect>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Link href={`/admin/vehicles/${vehicle.id}/edit`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                        Edit listing
                      </Link>
                      <Link href={`/admin/vehicles/${vehicle.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                        View listing
                      </Link>
                      <button type="button" onClick={() => openVehicleEditorForListing(vehicle, linkedRecord)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                        {linkedCustomer ? "Change owner" : "Assign owner"}
                      </button>
                      {linkedCustomer ? (
                        <Link href={`/admin/customers?customerId=${linkedCustomer.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Open customer
                        </Link>
                      ) : null}
                      {latestIntake ? (
                        <Link href={`/admin/warehouse-intake/${latestIntake.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Open storage contract
                        </Link>
                      ) : linkedRecord ? (
                        <Link href={`/admin/warehouse-intake/new?customerProfileId=${linkedRecord.customerProfileId || ""}&vehicleRecordId=${linkedRecord.id}&vehicleId=${vehicle.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Start storage contract
                        </Link>
                      ) : (
                        <Link href={`/admin/warehouse-intake/new?vehicleId=${vehicle.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Start storage contract
                        </Link>
                      )}
                      <button type="button" onClick={() => void openVehicleLog(vehicle.id)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                        Vehicle log
                      </button>
                    </div>
                  </div>
                  {logOpen ? (
                    <div className="mt-4 rounded-[18px] border border-black/6 bg-white/80 p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openVehicleLogComposer(vehicle.id, "internal", ownerEmail)}
                          className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                        >
                          Add internal note
                        </button>
                        <button
                          type="button"
                          onClick={() => openVehicleLogComposer(vehicle.id, "owner", ownerEmail)}
                          className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                        >
                          Add note to customer
                        </button>
                      </div>

                      {logComposer ? (
                        <div className="mt-4 space-y-3 rounded-[16px] border border-black/6 bg-shell p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bronze">
                            {logComposer.mode === "internal" ? "Internal note" : "Notes to customer"}
                          </p>
                          <CompactTextarea
                            value={logComposer.message}
                            onChange={(event) => setVehicleLogComposerByVehicleId((current) => ({
                              ...current,
                              [vehicle.id]: current[vehicle.id] ? { ...current[vehicle.id]!, message: event.target.value } : current[vehicle.id]
                            }))}
                            placeholder={
                              logComposer.mode === "internal"
                                ? "Add an internal note for staff"
                                : "Write the note to the customer"
                            }
                          />
                          {logComposer.mode !== "internal" ? (
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">
                                Attach photos for the customer update
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(event) => {
                                  const files = Array.from(event.target.files ?? []).slice(0, MAX_ACTIVITY_ATTACHMENTS);
                                  setVehicleLogComposerByVehicleId((current) => ({
                                    ...current,
                                    [vehicle.id]: current[vehicle.id] ? { ...current[vehicle.id]!, attachmentFiles: files } : current[vehicle.id]
                                  }));
                                }}
                                className="block w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-shell file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink"
                              />
                              <p className="text-xs text-ink/56">
                                {logComposer.attachmentFiles.length
                                  ? `${logComposer.attachmentFiles.length} image${logComposer.attachmentFiles.length === 1 ? "" : "s"} selected`
                                  : "Attach up to 5 images. Photos upload as real attachments, not pasted links."}
                              </p>
                            </div>
                          ) : null}
                          {logComposer.mode === "owner" ? (
                            <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink">
                              <input
                                type="checkbox"
                                checked={logComposer.sendEmail}
                                onChange={(event) => setVehicleLogComposerByVehicleId((current) => ({
                                  ...current,
                                  [vehicle.id]: current[vehicle.id] ? { ...current[vehicle.id]!, sendEmail: event.target.checked } : current[vehicle.id]
                                }))}
                                className="h-4 w-4 rounded border-black/20 text-ink"
                              />
                              <span>{ownerEmail ? `Send update email to ${ownerEmail}` : "No owner email available for sending"}</span>
                            </label>
                          ) : null}
                          <div className="flex flex-wrap justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setVehicleLogComposerByVehicleId((current) => ({ ...current, [vehicle.id]: null }))}
                              className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleSaveVehicleLog(vehicle, linkedCustomer, logComposer.mode)}
                              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save log entry"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-3">
                        {logLoading ? (
                          <div className="rounded-[16px] border border-black/6 bg-shell px-4 py-4 text-sm text-ink/58">Loading vehicle log...</div>
                        ) : null}
                        {logError ? (
                          <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">{logError}</div>
                        ) : null}
                        {!logLoading && !logItems.length ? (
                          <div className="rounded-[16px] border border-dashed border-black/10 bg-shell px-4 py-4 text-sm text-ink/58">
                            No vehicle log entries yet.
                          </div>
                        ) : null}
                        {logItems.map((entry) => (
                          <div key={entry.id} className="rounded-[16px] border border-black/6 bg-shell px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink">
                                  {entry.visibility === "customer" ? "Notes to customer" : entry.type === "warehouse_activity_added" ? "Photo / update" : "Internal note"}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{entry.message}</p>
                                {entry.imageUrls?.length ? (
                                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {entry.imageUrls.map((imageUrl) => (
                                      <div key={imageUrl} className="overflow-hidden rounded-[16px] border border-black/8 bg-white">
                                        <div className="aspect-[4/3] bg-shell">
                                          <img
                                            src={imageUrl}
                                            alt="Vehicle update attachment"
                                            className="h-full w-full object-cover"
                                          />
                                        </div>
                                        <div className="flex items-center justify-end border-t border-black/6 px-3 py-2">
                                          <a
                                            href={imageUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                                          >
                                            Open image
                                          </a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="text-right text-xs text-ink/55">
                                <p className="font-semibold text-ink">{entry.createdBy || "CarNest Admin"}</p>
                                <p className="mt-1">{entry.createdAt ? formatAdminDateTime(entry.createdAt) : "Pending timestamp"}</p>
                                <p className="mt-1">
                                  {entry.emailSentStatus === "sent"
                                    ? "Email sent"
                                    : entry.emailSentStatus === "no_email"
                                      ? "No owner email"
                                      : entry.emailSentStatus === "missing_env"
                                        ? "Email not configured"
                                    : entry.emailSentStatus === "send_failed"
                                          ? "Email failed"
                                          : entry.visibility === "customer"
                                            ? "Customer visible"
                                            : "Internal only"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )})}

              {!listingRows.length ? (
                <div className="rounded-[22px] border border-dashed border-black/10 bg-shell px-4 py-8 text-sm text-ink/58">
                  No listings match this filter.
                </div>
              ) : null}
            </div>
          </div>
          {showVehicleSummary ? (
            <div className="grid gap-3 md:grid-cols-4">
              <InfoStat label="Active listing revenue" value={formatCurrency(workspaceMetrics.activeListingRevenue)} helper="GST-inclusive service-fee totals tied to active public listings" />
              <InfoStat label="Warehouse revenue" value={formatCurrency(workspaceMetrics.warehouseManagedRevenue)} helper="GST-inclusive service-fee totals on warehouse-managed vehicles" />
              <InfoStat label="Pending fees" value={formatCurrency(workspaceMetrics.pendingFees)} helper="Draft or unsigned intake-event fees" />
              <InfoStat label="Projected active revenue" value={formatCurrency(workspaceMetrics.totalActiveListingPotentialRevenue)} helper="Linked listing price plus GST-inclusive intake fees" />
            </div>
          ) : null}
        </section>
      ) : null}

      {showingCustomersPage ? (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap gap-3">
              <CompactInput
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search customer name, phone, email, or customer ID"
                className="min-w-[260px] flex-1"
              />
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteEmptyCustomers()}
                  disabled={cleanupDeleting}
                  className="rounded-full border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cleanupDeleting ? "Cleaning..." : "Delete empty customer records"}
                </button>
              ) : null}
              <button type="button" onClick={() => openCustomerEditor()} className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                New customer
              </button>
            </div>
          </div>

          {customerRows.map(({ profile, linkedVehicles, displayCustomerId }) => {
            const isExpanded = expandedCustomers[profile.id] ?? false;
            return (
              <div key={profile.id} className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">{getCustomerLabel(profile)}</h3>
                      <span className="rounded-full border border-black/8 bg-shell px-3 py-1 text-[11px] font-semibold text-ink/70">
                        {displayCustomerId}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/60">
                      <span>{profile.phone || "Phone pending"}</span>
                      <span>{profile.email || "Email pending"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-black/8 bg-shell px-3 py-1 text-xs font-semibold text-ink/70">
                      {linkedVehicles.length} linked vehicle{linkedVehicles.length === 1 ? "" : "s"}
                    </span>
                    <button type="button" onClick={() => openCustomerEditor(profile)} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                      Edit customer
                    </button>
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
                    {linkedVehicles.length ? linkedVehicles.map(({ record, listing, intakeCount, latestIntake, estimatedRevenue, status }) => (
                      <div key={record.id} className="rounded-[18px] border border-black/6 bg-shell px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{getVehicleRecordTitle(record)}</p>
                            <p className="mt-1 text-xs text-ink/58">
                              {listing ? getVehicleDisplayReference(listing) : record.displayReference || "No listing"} · {status}
                            </p>
                            <p className="mt-1 text-xs text-ink/58">
                              Rego: {record.registrationPlate || "Pending"} · VIN: {record.vin || "Pending"} · {intakeCount} intake event{intakeCount === 1 ? "" : "s"}
                            </p>
                            <p className="mt-1 text-xs text-ink/58">
                              Asking price {formatCurrency(parseMoneyString(record.askingPrice) || listing?.price || 0)} · Projected revenue {formatCurrency((record.estimatedTotalIncome || 0) || estimatedRevenue)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill label={status} />
                            <button type="button" onClick={() => openVehicleEditor(record, profile.id)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                              Edit vehicle
                            </button>
                            {listing ? (
                              <Link href={`/admin/vehicles/${listing.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                                Open listing
                              </Link>
                            ) : null}
                            {listing ? (
                              <Link href={`/admin/vehicles/${listing.id}/edit`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                                Edit listing
                              </Link>
                            ) : null}
                            <Link href={latestIntake ? `/admin/warehouse-intake/${latestIntake.id}` : `/admin/warehouse-intake/new?customerProfileId=${profile.id}&vehicleRecordId=${record.id}${listing ? `&vehicleId=${listing.id}` : ""}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                              {latestIntake ? "Open storage contract" : "Start storage contract"}
                            </Link>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-[18px] border border-dashed border-black/10 bg-shell px-4 py-4 text-sm text-ink/58">
                        No linked vehicles yet.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {!customerRows.length ? (
            <div className="rounded-[24px] border border-dashed border-black/10 bg-white px-5 py-8 text-sm text-ink/60 shadow-panel">
              No customer profiles match this search.
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
