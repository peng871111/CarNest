"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AdminVehiclesReviewBoard } from "@/components/admin/admin-vehicles-review-board";
import { useAuth } from "@/lib/auth";
import {
  archiveVehicleRecord,
  createEmptyCustomerProfile,
  createEmptyVehicleRecord,
  saveCustomerProfile,
  saveVehicleRecord
} from "@/lib/data";
import { getListingLabel, hasAdminPermission } from "@/lib/permissions";
import { formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { AppUser, CustomerProfile, Vehicle, VehicleActor, VehicleRecord, WarehouseIntakeRecord } from "@/types";

type VehicleManagementView = "customers" | "vehicles" | "warehouse" | "listings";
type VehicleOperationalStatus =
  | "Draft"
  | "Warehouse managed"
  | "Private seller managed"
  | "Listed"
  | "Sold"
  | "Withdrawn"
  | "Unlinked";
type PublicListingStatus = "Available" | "Warehouse managed" | "Sold" | "Draft" | "Withdrawn";

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

function getVehicleRecordTitle(record: VehicleRecord) {
  return record.title?.trim() || [record.year, record.make, record.model, record.variant].filter(Boolean).join(" ").trim() || "Vehicle record";
}

function parseMoneyString(value?: string) {
  const normalized = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
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

export function VehicleManagementHub({
  vehicles,
  owners,
  customerProfiles,
  vehicleRecords,
  intakes,
  writeStatus,
  error,
  defaultView = "vehicles"
}: {
  vehicles: Vehicle[];
  owners: AppUser[];
  customerProfiles: CustomerProfile[];
  vehicleRecords: VehicleRecord[];
  intakes: WarehouseIntakeRecord[];
  writeStatus?: string;
  error?: string;
  defaultView?: VehicleManagementView;
}) {
  const { appUser } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const canManageSensitiveCustomerFields = hasAdminPermission(appUser, "manageUsers");

  const [activeView, setActiveView] = useState<VehicleManagementView>(defaultView);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [expandedIntakes, setExpandedIntakes] = useState<Record<string, boolean>>({});
  const [globalSearch, setGlobalSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<VehicleOperationalStatus | "all">("all");
  const [showModerationQueue, setShowModerationQueue] = useState(false);
  const [localCustomerProfiles, setLocalCustomerProfiles] = useState(customerProfiles);
  const [localVehicleRecords, setLocalVehicleRecords] = useState(vehicleRecords);
  const [localIntakes, setLocalIntakes] = useState(intakes);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [customerDraft, setCustomerDraft] = useState<Omit<CustomerProfile, "id" | "createdAt" | "updatedAt"> | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<Omit<VehicleRecord, "id" | "createdAt" | "updatedAt"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(writeStatus || "");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setActiveView(defaultView);
  }, [defaultView]);

  useEffect(() => {
    setLocalCustomerProfiles(customerProfiles);
  }, [customerProfiles]);

  useEffect(() => {
    setLocalVehicleRecords(vehicleRecords);
  }, [vehicleRecords]);

  useEffect(() => {
    setLocalIntakes(intakes);
  }, [intakes]);

  const listingMap = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const customerMap = useMemo(() => new Map(localCustomerProfiles.map((profile) => [profile.id, profile])), [localCustomerProfiles]);
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

  const customerRows = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    return [...localCustomerProfiles]
      .map((profile) => {
        const dedupedRecords = new Map<string, VehicleRecord>();
        localVehicleRecords
          .filter((record) => record.customerProfileId === profile.id)
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
            const estimatedRevenue = intakeHistory.reduce(
              (sum, intake) => sum + intake.serviceItems.reduce((feeTotal, fee) => feeTotal + fee.amount, 0),
              0
            );
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
          getCustomerLabel(profile),
          profile.email,
          profile.phone,
          ...linkedVehicles.flatMap(({ record, listing }) => [
            getVehicleRecordTitle(record),
            record.registrationPlate,
            record.vin,
            listing ? getVehicleDisplayReference(listing) : ""
          ])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return { profile, linkedVehicles, searchText };
      })
      .filter((row) => (term ? row.searchText.includes(term) : true))
      .sort((left, right) => getCustomerLabel(left.profile).localeCompare(getCustomerLabel(right.profile)));
  }, [customerSearch, intakesByVehicleRecordId, listingMap, localCustomerProfiles, localVehicleRecords]);

  const vehicleRows = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    return localVehicleRecords
      .map((record) => {
        const customer = record.customerProfileId ? customerMap.get(record.customerProfileId) ?? null : null;
        const listing = record.publicListingId ? listingMap.get(record.publicListingId) ?? null : null;
        const intakeHistory = intakesByVehicleRecordId.get(record.id) ?? [];
        const latestIntake = intakeHistory[0] ?? null;
        const totalServiceFees = intakeHistory.reduce(
          (sum, intake) => sum + intake.serviceItems.reduce((feeTotal, fee) => feeTotal + fee.amount, 0),
          0
        );
        const estimatedTotalIncome = totalServiceFees + Math.max(parseMoneyString(record.reservePrice), parseMoneyString(record.askingPrice));
        const status = getVehicleOperationalStatus(record, listing, intakeHistory.length);
        const searchableText = [
          getVehicleRecordTitle(record),
          record.registrationPlate,
          record.vin,
          record.make,
          record.model,
          record.variant,
          record.displayReference,
          listing ? getVehicleDisplayReference(listing) : "",
          customer?.fullName,
          customer?.phone,
          customer?.email
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return {
          record,
          customer,
          listing,
          intakeCount: intakeHistory.length,
          latestIntake,
          totalServiceFees,
          estimatedTotalIncome,
          status,
          searchableText
        };
      })
      .filter((row) => (vehicleStatusFilter === "all" ? true : row.status === vehicleStatusFilter))
      .filter((row) => (term ? row.searchableText.includes(term) : true))
      .sort((left, right) => getVehicleRecordTitle(left.record).localeCompare(getVehicleRecordTitle(right.record)));
  }, [customerMap, globalSearch, intakesByVehicleRecordId, listingMap, localVehicleRecords, vehicleStatusFilter]);

  const listingRows = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    return vehicles
      .map((vehicle) => {
        const linkedRecord = localVehicleRecords.find((record) => record.publicListingId === vehicle.id) ?? null;
        const linkedCustomer = linkedRecord?.customerProfileId ? customerMap.get(linkedRecord.customerProfileId) ?? null : null;
        const status = getPublicListingStatus(vehicle);
        const searchText = [
          getVehicleDisplayReference(vehicle),
          vehicle.make,
          vehicle.model,
          vehicle.variant,
          vehicle.rego,
          vehicle.vin,
          linkedCustomer?.fullName,
          linkedCustomer?.phone,
          linkedCustomer?.email
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return { vehicle, linkedRecord, linkedCustomer, status, searchText };
      })
      .filter((row) => (term ? row.searchText.includes(term) : true));
  }, [customerMap, globalSearch, localVehicleRecords, vehicles]);

  const listingCounts = useMemo(() => ({
    available: vehicles.filter((vehicle) => isPublicInventoryListing(vehicle)).length,
    sold: vehicles.filter((vehicle) => getPublicListingStatus(vehicle) === "Sold").length,
    draft: vehicles.filter((vehicle) => getPublicListingStatus(vehicle) === "Draft").length,
    withdrawn: vehicles.filter((vehicle) => getPublicListingStatus(vehicle) === "Withdrawn").length
  }), [vehicles]);

  const workspaceMetrics = useMemo(() => {
    const activeRows = vehicleRows.filter((row) => row.listing && isPublicInventoryListing(row.listing));
    const activeListingRevenue = activeRows.reduce((sum, row) => sum + row.totalServiceFees, 0);
    const warehouseManagedRevenue = vehicleRows
      .filter((row) => row.status === "Warehouse managed")
      .reduce((sum, row) => sum + row.totalServiceFees, 0);
    const pendingFees = localIntakes
      .filter((intake) => intake.status !== "signed")
      .reduce((sum, intake) => sum + intake.serviceItems.reduce((feeTotal, fee) => feeTotal + fee.amount, 0), 0);
    const totalActiveListingPotentialRevenue = vehicles
      .filter((vehicle) => isPublicInventoryListing(vehicle))
      .reduce((sum, vehicle) => sum + (vehicle.price || 0), 0);
    return {
      activeListingRevenue,
      warehouseManagedRevenue,
      pendingFees,
      totalActiveListingPotentialRevenue
    };
  }, [localIntakes, vehicleRows, vehicles]);

  const recentIntakes = useMemo(() => {
    return [...localIntakes]
      .sort((left, right) => (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""))
      .slice(0, 8)
      .map((intake) => ({
        intake,
        customer: intake.customerProfileId ? customerMap.get(intake.customerProfileId) ?? null : null,
        vehicleRecord: intake.vehicleRecordId ? localVehicleRecords.find((record) => record.id === intake.vehicleRecordId) ?? null : null
      }));
  }, [customerMap, localIntakes, localVehicleRecords]);

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

  async function handleArchiveVehicle(record: VehicleRecord) {
    if (!actor) return;
    if (!window.confirm(`Archive ${getVehicleRecordTitle(record)}? This keeps private history but removes the duplicate from active customer workflow.`)) {
      return;
    }

    try {
      setSaving(true);
      await archiveVehicleRecord(record.id, actor);
      setLocalVehicleRecords((current) => current.map((item) => (item.id === record.id ? { ...item, status: "archived" } : item)));
      setLocalCustomerProfiles((current) =>
        current.map((profile) => ({
          ...profile,
          linkedVehicleRecordIds: profile.linkedVehicleRecordIds.filter((id) => id !== record.id)
        }))
      );
      setNotice("Vehicle record archived from the active workspace.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "We couldn't archive that vehicle record.");
    } finally {
      setSaving(false);
    }
  }

  const viewTabs: Array<{ key: VehicleManagementView; label: string; description: string }> = [
    { key: "vehicles", label: "Vehicle Workspace", description: "One row per core vehicle record" },
    { key: "customers", label: "Customers", description: "Reusable customer profiles and linked vehicles" },
    { key: "warehouse", label: "Warehouse Intake", description: "Paperwork, signatures, PDF, and service events" },
    { key: "listings", label: "Public Listings", description: "Website-facing inventory and moderation" }
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Vehicle workspace</p>
            <h2 className="mt-2 font-display text-3xl text-ink">Simple operational control</h2>
            <p className="mt-2 text-sm text-ink/60">Customers, core vehicle records, intake events, and live public listings stay linked without changing the public website.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/warehouse-intake/new" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92">
              Start intake
            </Link>
            <button
              type="button"
              onClick={() => openCustomerEditor()}
              className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
            >
              New customer
            </button>
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
                {vehicles.map((vehicle) => (
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

      {activeView === "vehicles" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <InfoStat label="Active listing revenue" value={formatCurrency(workspaceMetrics.activeListingRevenue)} helper="Service-fee revenue tied to active public listings" />
            <InfoStat label="Warehouse managed revenue" value={formatCurrency(workspaceMetrics.warehouseManagedRevenue)} helper="Service-fee revenue on warehouse-managed vehicles" />
            <InfoStat label="Pending fees" value={formatCurrency(workspaceMetrics.pendingFees)} helper="Draft or unsigned intake-event fees" />
            <InfoStat label="Active listing potential" value={formatCurrency(workspaceMetrics.totalActiveListingPotentialRevenue)} helper="Public asking prices currently live on Inventory" />
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap gap-3">
              <CompactInput
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Search listing ID, customer, phone, VIN, rego, make, or model"
                className="min-w-[260px] flex-1"
              />
              <CompactSelect value={vehicleStatusFilter} onChange={(event) => setVehicleStatusFilter(event.target.value as VehicleOperationalStatus | "all")} className="w-full md:w-56">
                <option value="all">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="Warehouse managed">Warehouse managed</option>
                <option value="Private seller managed">Private seller managed</option>
                <option value="Listed">Listed</option>
                <option value="Sold">Sold</option>
                <option value="Withdrawn">Withdrawn</option>
                <option value="Unlinked">Unlinked</option>
              </CompactSelect>
              <button type="button" onClick={() => openVehicleEditor()} className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                New vehicle
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {vehicleRows.map(({ record, customer, listing, intakeCount, latestIntake, totalServiceFees, estimatedTotalIncome, status }) => (
                <div key={record.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-ink">{getVehicleRecordTitle(record)}</p>
                      <p className="mt-1 text-sm text-ink/60">
                        {customer ? getCustomerLabel(customer) : "Customer pending"} · {listing ? getVehicleDisplayReference(listing) : record.displayReference || "No listing"} · {status}
                      </p>
                      <p className="mt-1 text-sm text-ink/58">
                        {record.vin || "VIN pending"} · {record.registrationPlate || "Rego pending"} · {intakeCount} intake event{intakeCount === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 text-sm text-ink/62">
                        {formatCurrency(parseMoneyString(record.askingPrice) || listing?.price || 0)} · Estimated income {formatCurrency(estimatedTotalIncome)} · Service fees {formatCurrency(totalServiceFees)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={status} />
                      <button type="button" onClick={() => openVehicleEditor(record)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                        Edit
                      </button>
                      {listing ? (
                        <Link href={`/admin/vehicles/${listing.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Open listing
                        </Link>
                      ) : null}
                      <Link href={latestIntake ? `/admin/warehouse-intake/${latestIntake.id}` : `/admin/warehouse-intake/new?customerProfileId=${record.customerProfileId || ""}&vehicleRecordId=${record.id}${listing ? `&vehicleId=${listing.id}` : ""}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                        {latestIntake ? "Continue intake" : "Start intake"}
                      </Link>
                      {latestIntake?.signedPdfStoragePath ? (
                        <Link href={`/admin/warehouse-intake/${latestIntake.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          View PDF
                        </Link>
                      ) : null}
                      <button type="button" onClick={() => void handleArchiveVehicle(record)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                        Archive
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!vehicleRows.length ? (
                <div className="rounded-[22px] border border-dashed border-black/10 bg-shell px-4 py-8 text-sm text-ink/58">
                  No vehicle records match this workspace filter.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {activeView === "customers" ? (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap gap-3">
              <CompactInput
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search customer, email, phone, rego, VIN, or listing ID"
                className="min-w-[260px] flex-1"
              />
              <button type="button" onClick={() => openCustomerEditor()} className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                New customer
              </button>
            </div>
          </div>

          {customerRows.map(({ profile, linkedVehicles }) => {
            const isExpanded = expandedCustomers[profile.id] ?? false;
            return (
              <div key={profile.id} className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{getCustomerLabel(profile)}</h3>
                    <p className="mt-1 text-sm text-ink/60">{profile.phone || "Phone pending"} · {profile.email || "Email pending"}</p>
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
                              Asking price {formatCurrency(parseMoneyString(record.askingPrice) || listing?.price || 0)} · Estimated revenue {formatCurrency(estimatedRevenue)}
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
                            <Link href={latestIntake ? `/admin/warehouse-intake/${latestIntake.id}` : `/admin/warehouse-intake/new?customerProfileId=${profile.id}&vehicleRecordId=${record.id}${listing ? `&vehicleId=${listing.id}` : ""}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                              {latestIntake ? "Continue intake" : "Start intake"}
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

      {activeView === "warehouse" ? (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-bronze">Warehouse intake</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">Paperwork and operational service events</h3>
                <p className="mt-2 text-sm text-ink/60">Use this workflow only for storage paperwork, signatures, service items, PDFs, and intake history.</p>
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

          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-bronze">Recent intake events</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">Continue recent paperwork</h3>
              </div>
              <p className="text-sm text-ink/55">{recentIntakes.length} shown</p>
            </div>
            <div className="mt-4 space-y-3">
              {recentIntakes.map(({ intake, customer, vehicleRecord }) => {
                const isExpanded = expandedIntakes[intake.id] ?? false;
                const signatureReady = Boolean(intake.signature.signatureStoragePath && intake.signature.signedAt);
                const pdfReady = Boolean(intake.signedPdfStoragePath);
                return (
                  <div key={intake.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{vehicleRecord ? getVehicleRecordTitle(vehicleRecord) : intake.vehicleTitle || "Warehouse intake"}</p>
                        <p className="mt-1 text-xs text-ink/58">{customer ? getCustomerLabel(customer) : intake.ownerDetails.fullName || "Customer pending"} · {intake.ownerDetails.phone || "Phone pending"} · {intake.ownerDetails.email || "Email pending"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${signatureReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                          {signatureReady ? "✓ Signature" : "Signature pending"}
                        </span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${pdfReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-black/8 bg-white text-ink/62"}`}>
                          {pdfReady ? "✓ PDF" : "PDF pending"}
                        </span>
                        <Link href={`/admin/warehouse-intake/${intake.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Open intake
                        </Link>
                        <button type="button" onClick={() => setExpandedIntakes((current) => ({ ...current, [intake.id]: !isExpanded }))} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          {isExpanded ? "Hide" : "Details"}
                        </button>
                      </div>
                    </div>
                    {isExpanded ? (
                      <div className="mt-3 rounded-[18px] border border-black/6 bg-white/80 px-4 py-3 text-xs text-ink/58">
                        <p>Vehicle reference: {intake.vehicleReference || "Pending"}</p>
                        <p className="mt-1">Status: {intake.status.replace(/_/g, " ")}</p>
                        <p className="mt-1">Updated: {intake.updatedAt || intake.createdAt || "Pending"}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {activeView === "listings" ? (
        <section className="space-y-6">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-bronze">Public listings</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">Website-facing listings linked back to private vehicle records</h3>
              </div>
              <button type="button" onClick={() => setShowModerationQueue((current) => !current)} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                {showModerationQueue ? "Hide moderation queue" : "Show moderation queue"}
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <InfoStat label="Available" value={String(listingCounts.available)} helper="Matches the public Inventory page" />
              <InfoStat label="Sold" value={String(listingCounts.sold)} />
              <InfoStat label="Draft" value={String(listingCounts.draft)} />
              <InfoStat label="Withdrawn" value={String(listingCounts.withdrawn)} />
            </div>

            <div className="mt-5 space-y-3">
              {listingRows.map(({ vehicle, linkedRecord, linkedCustomer, status }) => (
                <div key={vehicle.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-ink">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.variant}</p>
                      <p className="mt-1 text-sm text-ink/60">{getVehicleDisplayReference(vehicle)} · {status} · {getListingLabel(vehicle.listingType)}</p>
                      <p className="mt-1 text-sm text-ink/58">Vehicle record: {linkedRecord ? getVehicleRecordTitle(linkedRecord) : "Not linked"} · Customer: {linkedCustomer ? getCustomerLabel(linkedCustomer) : "Not linked"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={status === "Available" ? "Listed" : status === "Warehouse managed" ? "Warehouse managed" : status} />
                      <Link href={`/admin/vehicles/${vehicle.id}`} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                        Open listing
                      </Link>
                      {linkedRecord ? (
                        <button type="button" onClick={() => openVehicleEditor(linkedRecord)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                          Edit vehicle
                        </button>
                      ) : null}
                    </div>
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
