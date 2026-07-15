"use client";

import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createEmptyWarehouseServiceFeeItem,
  createEmptyWarehouseIntakeRecord,
  getCustomerProfilesData,
  getVehiclesData,
  getVehicleRecordsData,
  getWarehouseIntakeById,
  markWarehouseIntakeActiveEditor,
  saveWarehouseIntake
} from "@/lib/data";
import {
  CARNEST_CONCIERGE_AGREEMENT_COPY,
  VEHICLE_REPORT_RWC_COOPERATION_OPTIONS,
  WAREHOUSE_CONTACT_METHOD_OPTIONS,
  WAREHOUSE_DECLARATION_OPTIONS,
  WAREHOUSE_IDENTIFICATION_OPTIONS,
  WAREHOUSE_INTAKE_STEPS,
  WAREHOUSE_PHOTO_SECTIONS
} from "@/lib/warehouse-intake-config";
import {
  VEHICLE_CONDITION_CATEGORY_HELPERS,
  VEHICLE_CONDITION_CATEGORY_LABELS,
  VEHICLE_CONDITION_NOTES_ONLY_CATEGORY_KEYS,
  VEHICLE_BODY_PANEL_LABELS,
  VEHICLE_CONDITION_SCORED_CATEGORY_KEYS,
  VEHICLE_CONDITION_SCORE_SELECT_OPTIONS,
  VEHICLE_DAMAGE_TYPE_LABELS,
} from "@/lib/vehicle-condition-config";
import {
  formatVehicleBodyDamageGridCellLabel,
  getVehicleBodyDamageGridCell,
  VEHICLE_BODY_DAMAGE_GRID_CELLS,
} from "@/lib/vehicle-body-damage-grid";
import {
  createEmptyVehicleServiceHistoryRecord,
  formatVehicleServiceHistoryDate,
  sortVehicleServiceHistoryRecords,
  VEHICLE_SERVICE_HISTORY_DAY_OPTIONS,
  VEHICLE_SERVICE_HISTORY_MONTH_OPTIONS,
} from "@/lib/vehicle-service-history";
import { formatAdminDateTime, getVehicleDisplayReference } from "@/lib/utils";
import {
  deleteAdminWarehouseIntakePhoto,
  fetchAdminWarehouseIntakeFileBytes,
  fetchAdminWarehouseIntakeFileBlob,
  uploadWarehouseIntakePdf,
  uploadWarehouseIntakePhotos,
  uploadWarehouseIntakeSignature,
  uploadWarehouseIntakeSupportingFile
} from "@/lib/storage";
import { generateWarehouseIntakePdf } from "@/lib/warehouse-intake-pdf";
import {
  canDeleteWarehouseIntakePhotos,
  isWarehouseIntakeEvidenceLocked,
} from "@/lib/warehouse-intake-evidence";
import { hasAdminPermission } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { SignaturePad, SignaturePadHandle } from "@/components/admin/signature-pad";
import { VehicleConditionBodyMap } from "@/components/vehicles/vehicle-condition-body-map";
import {
  CustomerProfile,
  Vehicle,
  VehicleActor,
  VehicleRecord,
  VehicleServiceHistoryRecord,
  WarehouseConditionItem,
  WarehouseIntakeOwnerDetails,
  WarehouseIntakePhotoRecord,
  WarehouseIntakeRecord,
  VehicleBodyPanelCondition,
  VehicleBodyPanelKey,
  VehicleConditionCategoryKey,
  VehicleConditionScore,
  VehicleDamageType,
  VehicleReportRwcCooperation,
  WarehouseServiceFeeItem,
  WarehouseVehicleDamageRecord,
} from "@/types";

const WAREHOUSE_SERVICE_FEE_OPTIONS: Array<{ value: WarehouseServiceFeeItem["category"]; label: string }> = [
  { value: "car_wash", label: "Car wash" },
  { value: "light_detailing", label: "Light detailing" },
  { value: "paint_correction", label: "Paint correction" },
  { value: "interior_restoration", label: "Interior restoration" },
  { value: "minor_repair", label: "Minor repair" },
  { value: "tyres", label: "Tyres" },
  { value: "battery", label: "Battery" },
  { value: "roadworthy_certificate", label: "Roadworthy certificate" },
  { value: "coordination_service_fee", label: "Coordination service fee" },
  { value: "storage_fee", label: "Storage fee" },
  { value: "sundry", label: "Sundry" },
  { value: "other", label: "Other" }
];

const VEHICLE_FUEL_TYPE_OPTIONS = ["Petrol", "Diesel", "Hybrid", "Plug-in Hybrid", "Full Electric"] as const;
const VEHICLE_TRANSMISSION_OPTIONS = ["AT", "CVT", "MT", "DCT"] as const;
const VEHICLE_DRIVETRAIN_OPTIONS = ["FWD", "RWD", "AWD", "4WD"] as const;
const VEHICLE_SERVICE_HISTORY_YEAR_OPTIONS = Array.from({ length: 60 }, (_, index) => String(new Date().getFullYear() - index));
const SCORED_CONDITION_CATEGORY_KEYS = [...VEHICLE_CONDITION_SCORED_CATEGORY_KEYS];
const NOTES_ONLY_CONDITION_CATEGORY_KEYS = new Set<VehicleConditionCategoryKey>(VEHICLE_CONDITION_NOTES_ONLY_CATEGORY_KEYS);
const NON_DAMAGE_WAREHOUSE_PHOTO_SECTIONS = WAREHOUSE_PHOTO_SECTIONS.filter((section) => section.key !== "damagePhotos");

function createWarehouseDamageRecord(gridCellId: string, panelKey: VehicleBodyPanelKey, damageType: VehicleDamageType): WarehouseVehicleDamageRecord {
  return {
    id: `damage-record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    gridCellId,
    panelKey,
    damageType,
    notes: "",
    photoIds: [],
  };
}

function getDamagePhotoLabel(panelKey: VehicleBodyPanelKey, damageType: VehicleDamageType) {
  return `${VEHICLE_BODY_PANEL_LABELS[panelKey]} · ${VEHICLE_DAMAGE_TYPE_LABELS[damageType]}`;
}

function toDraft(record: WarehouseIntakeRecord): Omit<WarehouseIntakeRecord, "id"> {
  const { id: _id, ...draft } = record;
  return draft;
}

function createActorFromUser(user: ReturnType<typeof useAuth>["appUser"]): VehicleActor | null {
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

function getCustomerProfileLabel(profile?: CustomerProfile | null) {
  if (!profile) return "Select a customer profile";
  return profile.fullName || profile.email || profile.phone || "Customer profile";
}

function getVehicleRecordLabel(record?: VehicleRecord | null) {
  if (!record) return "Add or select a vehicle";
  return record.title || [record.year, record.make, record.model, record.variant].filter(Boolean).join(" ").trim() || record.registrationPlate || "Vehicle record";
}

function applyCustomerProfileToDraft(
  draft: Omit<WarehouseIntakeRecord, "id">,
  profile?: CustomerProfile | null
): Omit<WarehouseIntakeRecord, "id"> {
  if (!profile) {
    return {
      ...draft,
      customerProfileId: "",
      ownerDetails: {
        ...draft.ownerDetails,
      fullName: "",
      email: "",
      phone: "",
      address: "",
      dateOfBirth: "",
      preferredContactMethod: "either",
      customerVerificationNotes: "",
      identificationDocumentType: "",
      identificationDocumentNumber: "",
      companyOwned: false,
      companyName: "",
      abn: "",
      acn: "",
      identificationDocument: null,
      isLegalOwnerConfirmed: false
      }
    };
  }

  return {
    ...draft,
    customerProfileId: profile.id,
    ownerDetails: {
      ...draft.ownerDetails,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      dateOfBirth: profile.dateOfBirth,
      preferredContactMethod: profile.preferredContactMethod,
      customerVerificationNotes: profile.customerVerificationNotes,
      identificationDocumentType: profile.identificationDocumentType,
      identificationDocumentNumber: profile.identificationDocumentNumber,
      companyOwned: profile.companyOwned,
      companyName: profile.companyName,
      abn: profile.abn,
      acn: profile.acn,
      identificationDocument: profile.identificationDocument ?? null,
      isLegalOwnerConfirmed: profile.isLegalOwnerConfirmed
    }
  };
}

function applyVehicleRecordToDraft(
  draft: Omit<WarehouseIntakeRecord, "id">,
  record?: VehicleRecord | null
): Omit<WarehouseIntakeRecord, "id"> {
  if (!record) {
    return {
      ...draft,
      vehicleRecordId: "",
      vehicleTitle: "",
      vehicleReference: "",
      vehicleDetails: {
        ...draft.vehicleDetails,
        make: "",
        model: "",
        variant: "",
        year: "",
        registrationPlate: "",
        vin: "",
        colour: "",
        odometer: "",
        registrationExpiry: "",
        numberOfKeys: "",
        fuelType: "",
        transmission: "",
        drivetrain: "",
        askingPrice: "",
        reservePrice: "",
        serviceHistory: "",
        serviceHistoryRecords: [],
        warrantyStatus: "",
        numberOfOwners: "",
        accidentHistory: "",
        ownershipProof: null,
        notes: ""
      },
      declarations: createEmptyWarehouseIntakeRecord().declarations
    };
  }

  const inferredTitle = record.title || [record.year, record.make, record.model, record.variant].filter(Boolean).join(" ").trim();
  return {
    ...draft,
    customerProfileId: record.customerProfileId || draft.customerProfileId,
    vehicleRecordId: record.id,
    vehicleId: record.publicListingId || draft.vehicleId,
    vehicleReference: record.displayReference || draft.vehicleReference,
    vehicleTitle: inferredTitle || draft.vehicleTitle,
    vehicleDetails: {
      ...draft.vehicleDetails,
      make: record.make,
      model: record.model,
      variant: record.variant,
      year: record.year,
      registrationPlate: record.registrationPlate,
      vin: record.vin,
      colour: record.colour,
      odometer: record.odometer,
      registrationExpiry: record.registrationExpiry,
      numberOfKeys: record.numberOfKeys,
      fuelType: record.fuelType,
      transmission: record.transmission,
      drivetrain: draft.vehicleDetails.drivetrain,
      askingPrice: record.askingPrice,
      reservePrice: record.reservePrice,
      serviceHistory: record.serviceHistory,
      serviceHistoryRecords: record.serviceHistoryRecords ?? [],
      warrantyStatus: draft.vehicleDetails.warrantyStatus,
      numberOfOwners: draft.vehicleDetails.numberOfOwners,
      accidentHistory: record.accidentHistory,
      ownershipProof: record.ownershipProof ?? null,
      notes: record.notes
    },
    declarations: {
      ...draft.declarations,
      ...record.declarations
    }
  };
}

function mergeVehicleIntoDraft(draft: Omit<WarehouseIntakeRecord, "id">, vehicle?: Vehicle | null) {
  if (!vehicle) return draft;
  return {
    ...draft,
    vehicleId: vehicle.id,
    vehicleReference: getVehicleDisplayReference(vehicle),
    vehicleTitle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
    ownerDetails: {
      ...draft.ownerDetails,
      fullName: draft.ownerDetails.fullName || vehicle.customerName || "",
      email: draft.ownerDetails.email || vehicle.customerEmail || ""
    },
    vehicleDetails: {
      ...draft.vehicleDetails,
      make: vehicle.make || draft.vehicleDetails.make,
      model: vehicle.model || draft.vehicleDetails.model,
      year: vehicle.year ? String(vehicle.year) : draft.vehicleDetails.year,
      registrationPlate: vehicle.rego || draft.vehicleDetails.registrationPlate,
      vin: vehicle.vin || draft.vehicleDetails.vin,
      colour: vehicle.colour || draft.vehicleDetails.colour,
      odometer: vehicle.mileage ? String(vehicle.mileage) : draft.vehicleDetails.odometer,
      registrationExpiry: vehicle.regoExpiry || draft.vehicleDetails.registrationExpiry,
      numberOfKeys: vehicle.keyCount || draft.vehicleDetails.numberOfKeys,
      fuelType: vehicle.fuelType || draft.vehicleDetails.fuelType,
      transmission: vehicle.transmission || draft.vehicleDetails.transmission,
      drivetrain: vehicle.drivetrain || draft.vehicleDetails.drivetrain,
      askingPrice: vehicle.price ? String(vehicle.price) : draft.vehicleDetails.askingPrice,
      serviceHistory: vehicle.serviceHistory || draft.vehicleDetails.serviceHistory,
      serviceHistoryRecords:
        vehicle.serviceHistoryRecords
        ?? vehicle.vehicleReportSummary?.serviceHistoryRecords
        ?? draft.vehicleDetails.serviceHistoryRecords,
      notes: draft.vehicleDetails.notes || vehicle.description || ""
    }
  };
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-medium text-ink">{children}</label>;
}

function FieldNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-ink/55">{children}</p>;
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-[#C6A87D] ${props.className ?? ""}`} />;
}

function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-[112px] w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-[#C6A87D] ${props.className ?? ""}`} />;
}

function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-[#C6A87D] ${props.className ?? ""}`} />;
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

function isWarehouseIntakePermissionError(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("missing or insufficient permissions")
    || normalized.includes("permission-denied")
    || normalized.includes("unauthenticated");
}

function WarehouseIntakeSecureImage({
  storagePath,
  fileName,
  alt
}: {
  storagePath: string;
  fileName?: string;
  alt: string;
}) {
  const { firebaseUser } = useAuth();
  const [objectUrl, setObjectUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    let currentObjectUrl = "";

    async function load() {
      try {
        const idToken = await firebaseUser?.getIdToken();
        if (!idToken) {
          throw new Error("Missing admin authentication token.");
        }
        const blob = await fetchAdminWarehouseIntakeFileBlob(storagePath, idToken);
        if (cancelled) return;
        currentObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(currentObjectUrl);
      } catch {
        if (!cancelled) {
          setObjectUrl("");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [firebaseUser, storagePath]);

  return (
    <div className="overflow-hidden rounded-[18px] border border-black/6 bg-white">
      {objectUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={objectUrl} alt={alt} className="h-28 w-full object-cover object-center" />
      ) : (
        <div className="flex h-28 items-center justify-center bg-shell text-xs text-ink/45">Preview unavailable</div>
      )}
      <div className="px-3 py-2 text-xs text-ink/62">{fileName || alt}</div>
    </div>
  );
}

function WarehouseIntakePhotoCard({
  photo,
  alt,
  canDelete,
  evidenceLocked,
  deleting,
  onRequestDelete,
}: {
  photo: WarehouseIntakePhotoRecord;
  alt: string;
  canDelete: boolean;
  evidenceLocked: boolean;
  deleting: boolean;
  onRequestDelete: (photo: WarehouseIntakePhotoRecord) => void;
}) {
  return (
    <div className="space-y-2">
      <WarehouseIntakeSecureImage
        storagePath={photo.storagePath}
        fileName={photo.name}
        alt={alt}
      />
      {evidenceLocked ? (
        <p className="rounded-2xl border border-black/6 bg-white px-3 py-2 text-xs leading-5 text-ink/52">
          Finalised contract photos cannot be deleted.
        </p>
      ) : canDelete ? (
        <button
          type="button"
          disabled={deleting}
          onClick={(event) => {
            event.stopPropagation();
            onRequestDelete(photo);
          }}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-55"
          aria-label={`Delete ${photo.name || alt}`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden="true">
            <path d="M4.5 6h11" strokeLinecap="round" />
            <path d="M8 6V4.8c0-.7.6-1.3 1.3-1.3h1.4c.7 0 1.3.6 1.3 1.3V6" strokeLinecap="round" />
            <path d="m7 8 .3 7M13 8l-.3 7M5.8 6l.6 10.2c0 .8.7 1.3 1.5 1.3h4.2c.8 0 1.4-.6 1.5-1.3L14.2 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {deleting ? "Deleting..." : "Delete photo"}
        </button>
      ) : null}
    </div>
  );
}

function PhotoDeleteDialog({
  photo,
  deleting,
  onCancel,
  onConfirm,
}: {
  photo: WarehouseIntakePhotoRecord;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 px-4 py-4 sm:items-center">
      <div className="w-full max-w-md rounded-[28px] border border-black/8 bg-white p-5 shadow-[0_28px_70px_rgba(24,18,12,0.28)] sm:p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-bronze">Delete photo</p>
        <h3 className="mt-2 font-display text-2xl text-ink">Delete this photo?</h3>
        <p className="mt-3 text-sm leading-6 text-ink/64">
          This will permanently remove the photo from this storage contract.
        </p>
        <p className="mt-3 rounded-2xl bg-shell px-3 py-2 text-xs text-ink/58">
          {photo.name || photo.label || "Storage contract photo"}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-55"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="rounded-full bg-rose-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {deleting ? "Deleting..." : "Delete photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WarehouseIntakeWorkspace({ intakeId }: { intakeId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const selectedVehicleId = searchParams.get("vehicleId") || "";
  const selectedCustomerProfileId = searchParams.get("customerProfileId") || "";
  const selectedVehicleRecordId = searchParams.get("vehicleRecordId") || "";
  const signatureRef = useRef<SignaturePadHandle | null>(null);
  const bootstrappedRef = useRef(false);

  const [recordId, setRecordId] = useState(intakeId || "");
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [draft, setDraft] = useState<Omit<WarehouseIntakeRecord, "id">>(createEmptyWarehouseIntakeRecord());
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState("");
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedInternalNotes, setExpandedInternalNotes] = useState<Record<string, boolean>>({});
  const [selectedDamageGridCellId, setSelectedDamageGridCellId] = useState<string>(VEHICLE_BODY_DAMAGE_GRID_CELLS[0]?.id || "");
  const [selectedDamageRecordId, setSelectedDamageRecordId] = useState<string>("");
  const [photoPendingDelete, setPhotoPendingDelete] = useState<WarehouseIntakePhotoRecord | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState("");

  const customerVehicleRecords = useMemo(
    () => vehicleRecords.filter((record) => !draft.customerProfileId || record.customerProfileId === draft.customerProfileId),
    [draft.customerProfileId, vehicleRecords]
  );
  const canViewSensitiveCustomerFields = hasAdminPermission(appUser, "manageUsers");
  const selectedVehicleRecord = useMemo(
    () => customerVehicleRecords.find((record) => record.id === draft.vehicleRecordId) || null,
    [customerVehicleRecords, draft.vehicleRecordId]
  );
  const selectedDamageGridCell = useMemo(
    () => getVehicleBodyDamageGridCell(selectedDamageGridCellId),
    [selectedDamageGridCellId]
  );
  const damageRecords = useMemo(
    () => draft.vehicleReport.damageRecords ?? [],
    [draft.vehicleReport.damageRecords]
  );
  const serviceHistoryRecords = useMemo(
    () => sortVehicleServiceHistoryRecords(draft.vehicleDetails.serviceHistoryRecords),
    [draft.vehicleDetails.serviceHistoryRecords]
  );
  const linkedDamagePhotoIds = useMemo(
    () => new Set(
      damageRecords
        .filter((record) => Boolean(record.gridCellId?.trim()))
        .flatMap((record) => record.photoIds)
    ),
    [damageRecords]
  );
  const selectedGridCellDamageRecords = useMemo(
    () => damageRecords.filter((record) => record.gridCellId === selectedDamageGridCellId),
    [damageRecords, selectedDamageGridCellId]
  );
  const selectedGridCellActiveDamageRecord = useMemo(
    () => selectedGridCellDamageRecords.find((record) => record.id === selectedDamageRecordId) ?? selectedGridCellDamageRecords[0] ?? null,
    [selectedDamageRecordId, selectedGridCellDamageRecords]
  );
  const additionalDamagePhotos = useMemo(
    () => {
      const legacyRecordNoteByPhotoId = new Map<string, string>();
      for (const record of damageRecords) {
        if (record.gridCellId?.trim()) continue;
        const recordNote = record.notes?.trim();
        if (!recordNote) continue;
        for (const photoId of record.photoIds) {
          if (!legacyRecordNoteByPhotoId.has(photoId)) {
            legacyRecordNoteByPhotoId.set(photoId, recordNote);
          }
        }
      }

      return draft.photos
        .filter((photo) => photo.category === "damagePhotos" && !linkedDamagePhotoIds.has(photo.id))
        .map((photo) => (
          !photo.note?.trim() && legacyRecordNoteByPhotoId.has(photo.id)
            ? { ...photo, note: legacyRecordNoteByPhotoId.get(photo.id) }
            : photo
        ));
    },
    [damageRecords, draft.photos, linkedDamagePhotoIds]
  );
  const serviceFeeTotals = useMemo(() => {
    const subtotal = draft.serviceItems.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
    const gstInclusiveTotal = draft.serviceItems.reduce(
      (sum, item) => sum + (Number.isFinite(item.amount) ? (item.gstIncluded ? item.amount : item.amount * 1.1) : 0),
      0
    );
    const customerVisibleTotal = draft.serviceItems
      .filter((item) => item.customerVisible)
      .reduce((sum, item) => sum + (Number.isFinite(item.amount) ? (item.gstIncluded ? item.amount : item.amount * 1.1) : 0), 0);
    const gstIncludedTotal = draft.serviceItems
      .filter((item) => item.gstIncluded)
      .reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
    return {
      subtotal,
      gstInclusiveTotal,
      customerVisibleTotal,
      gstIncludedTotal,
      gstComponent: Math.max(gstInclusiveTotal - subtotal, 0)
    };
  }, [draft.serviceItems]);
  const activeEditorConflict = useMemo(() => {
    if (!draft.activeEditorUid || !draft.activeEditorAt || !actor) return null;
    if (draft.activeEditorUid === actor.id) return null;
    const activeAt = new Date(draft.activeEditorAt).getTime();
    if (!Number.isFinite(activeAt)) return null;
    if (Date.now() - activeAt > 15 * 60 * 1000) return null;
    return {
      name: draft.activeEditorName || "Another staff member",
      activeAt: draft.activeEditorAt
    };
  }, [actor, draft.activeEditorAt, draft.activeEditorName, draft.activeEditorUid]);
  const categoryScores = draft.vehicleReport.conditionCategories;
  const evidenceLocked = isWarehouseIntakeEvidenceLocked(draft);
  const canDeletePhotos = Boolean(recordId && canDeleteWarehouseIntakePhotos(draft));
  const conditionOverviewReady = Boolean(
    draft.vehicleId
    && SCORED_CONDITION_CATEGORY_KEYS.every((key) => categoryScores[key].score)
  );
  const listingEligibilityWarning = SCORED_CONDITION_CATEGORY_KEYS.some((key) => {
    const item = categoryScores[key];
    const numericScore = Number(item.score || 0);
    return Number.isFinite(numericScore) && numericScore > 0 && numericScore < 2.5;
  })
    ? "Vehicles rated below 2.5 are not accepted for advertising on the CarNest platform."
    : "";

  useEffect(() => {
    if (!selectedGridCellDamageRecords.length) {
      if (selectedDamageRecordId) {
        setSelectedDamageRecordId("");
      }
      return;
    }

    if (!selectedGridCellDamageRecords.some((record) => record.id === selectedDamageRecordId)) {
      setSelectedDamageRecordId(selectedGridCellDamageRecords[0].id);
    }
  }, [selectedDamageRecordId, selectedGridCellDamageRecords]);

  async function getAdminIdToken() {
    const idToken = await firebaseUser?.getIdToken();
    if (!idToken) {
      throw new Error("Admin authentication has expired. Please sign in again.");
    }
    return idToken;
  }

  async function openPrivatePdf(storagePath: string) {
    const idToken = await getAdminIdToken();
    const blob = await fetchAdminWarehouseIntakeFileBlob(storagePath, idToken);
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  async function downloadPrivatePdf(storagePath: string, fileName: string) {
    const idToken = await getAdminIdToken();
    const blob = await fetchAdminWarehouseIntakeFileBlob(storagePath, idToken);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName || "carnest-warehouse-intake.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!actor || !hasAdminPermission(appUser, "manageVehicles")) {
        setLoading(false);
        return;
      }
      if (!firebaseUser) {
        setLoading(false);
        setErrorMessage("Admin authentication is still loading. Please refresh and try again.");
        return;
      }

      const loadVehicles = async () => await getVehiclesData();
      const loadCustomerProfiles = async () => await getCustomerProfilesData();
      const loadVehicleRecords = async () => await getVehicleRecordsData();
      const loadExistingIntake = async () => intakeId ? await getWarehouseIntakeById(intakeId) : null;

      try {
        await firebaseUser.getIdToken();

        let vehiclesResult = await loadVehicles();
        let customerProfilesResult = await loadCustomerProfiles();
        let vehicleRecordsResult = await loadVehicleRecords();
        let existing: Awaited<ReturnType<typeof getWarehouseIntakeById>> = null;

        try {
          existing = await loadExistingIntake();
        } catch (error) {
          if (isWarehouseIntakePermissionError(error instanceof Error ? error.message : String(error))) {
            await firebaseUser.getIdToken(true);
            vehiclesResult = await loadVehicles();
            customerProfilesResult = await loadCustomerProfiles();
            vehicleRecordsResult = await loadVehicleRecords();
            existing = await loadExistingIntake();
          } else {
            throw error;
          }
        }

        if (vehiclesResult.error && isWarehouseIntakePermissionError(vehiclesResult.error)) {
          await firebaseUser.getIdToken(true);
          vehiclesResult = await loadVehicles();
          customerProfilesResult = await loadCustomerProfiles();
          vehicleRecordsResult = await loadVehicleRecords();
        }

        if (cancelled) return;
        setVehicles(vehiclesResult.items);
        setCustomerProfiles(customerProfilesResult.items);
        setVehicleRecords(vehicleRecordsResult.items);

        if (existing) {
          setRecordId(existing.id);
          setDraft(toDraft(existing));
          await markWarehouseIntakeActiveEditor(existing.id, existing.vehicleRecordId, actor).catch(() => undefined);
        }
        setLoading(false);
        if (intakeId) return;

        if (bootstrappedRef.current) {
          return;
        }

        bootstrappedRef.current = true;
        const seedVehicle = vehiclesResult.items.find((vehicle) => vehicle.id === selectedVehicleId) || null;
        const seedVehicleRecord = vehicleRecordsResult.items.find((record) => record.id === selectedVehicleRecordId) || null;
        const seedCustomerProfile =
          customerProfilesResult.items.find((profile) => profile.id === selectedCustomerProfileId)
          || (seedVehicleRecord?.customerProfileId ? customerProfilesResult.items.find((profile) => profile.id === seedVehicleRecord.customerProfileId) || null : null);
        let seededDraft = createEmptyWarehouseIntakeRecord(seedVehicle);
        seededDraft = mergeVehicleIntoDraft(seededDraft, seedVehicle);
        seededDraft = applyCustomerProfileToDraft(seededDraft, seedCustomerProfile);
        seededDraft = applyVehicleRecordToDraft(seededDraft, seedVehicleRecord);

        const saved = await saveWarehouseIntake(seededDraft, actor);
        if (cancelled) return;
        setRecordId(saved.intake.id);
        setDraft(toDraft(saved.intake));
        router.replace(`/admin/warehouse-intake/${saved.intake.id}`);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "We couldn't create the warehouse intake record.");
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
  }, [actor, appUser, authLoading, firebaseUser, intakeId, router, selectedCustomerProfileId, selectedVehicleId, selectedVehicleRecordId]);

  async function persistDraft(nextDraft = draft, successMessage?: string) {
    if (!actor) {
      throw new Error("Admin session unavailable.");
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const draftWithSignature = await persistSignatureSnapshot(nextDraft);
      const result = await saveWarehouseIntake(
        {
          ...draftWithSignature,
          adminStaffName: draftWithSignature.adminStaffName || actor.displayName || actor.name || actor.email || "CarNest Admin"
        },
        actor,
        recordId || undefined
      );

      setRecordId(result.intake.id);
      setDraft(toDraft(result.intake));
      if (successMessage) {
        setNotice(successMessage);
      }
      return result.intake;
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't save this intake draft right now.";
      setErrorMessage(message);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function updateOwnerField<K extends keyof WarehouseIntakeOwnerDetails>(key: K, value: WarehouseIntakeOwnerDetails[K]) {
    setDraft((current) => ({
      ...current,
      ownerDetails: {
        ...current.ownerDetails,
        [key]: value
      }
    }));
  }

  function updateVehicleField<K extends keyof WarehouseIntakeRecord["vehicleDetails"]>(
    key: K,
    value: WarehouseIntakeRecord["vehicleDetails"][K]
  ) {
    setDraft((current) => ({
      ...current,
      vehicleDetails: {
        ...current.vehicleDetails,
        [key]: value
      }
    }));
  }

  function addServiceHistoryRecord() {
    setDraft((current) => ({
      ...current,
      vehicleDetails: {
        ...current.vehicleDetails,
        serviceHistoryRecords: current.vehicleDetails.serviceHistoryRecords.concat(createEmptyVehicleServiceHistoryRecord()),
      }
    }));
  }

  function updateServiceHistoryRecord(
    id: string,
    updates: Partial<VehicleServiceHistoryRecord>
  ) {
    setDraft((current) => ({
      ...current,
      vehicleDetails: {
        ...current.vehicleDetails,
        serviceHistoryRecords: current.vehicleDetails.serviceHistoryRecords.map((record) => (
          record.id === id
            ? {
                ...record,
                ...updates,
              }
            : record
        )),
      }
    }));
  }

  function removeServiceHistoryRecord(id: string) {
    setDraft((current) => ({
      ...current,
      vehicleDetails: {
        ...current.vehicleDetails,
        serviceHistoryRecords: current.vehicleDetails.serviceHistoryRecords.filter((record) => record.id !== id),
      }
    }));
  }

  function updateDeclarationField<K extends keyof WarehouseIntakeRecord["declarations"]>(
    key: K,
    value: WarehouseIntakeRecord["declarations"][K]
  ) {
    setDraft((current) => ({
      ...current,
      declarations: {
        ...current.declarations,
        [key]: value
      }
    }));
  }

  function updateAgreementField<K extends keyof WarehouseIntakeRecord["agreement"]>(
    key: K,
    value: WarehouseIntakeRecord["agreement"][K]
  ) {
    setDraft((current) => ({
      ...current,
      agreement: {
        ...current.agreement,
        [key]: value
      }
    }));
  }

  function updateSignatureField<K extends keyof WarehouseIntakeRecord["signature"]>(
    key: K,
    value: WarehouseIntakeRecord["signature"][K]
  ) {
    setDraft((current) => ({
      ...current,
      signature: {
        ...current.signature,
        [key]: value
      }
    }));
  }

  function updateConditionItem(
    section: keyof WarehouseIntakeRecord["conditionReport"],
    key: string,
    updates: Partial<WarehouseConditionItem>
  ) {
    setDraft((current) => ({
      ...current,
      conditionReport: {
        ...current.conditionReport,
        [section]: {
          ...current.conditionReport[section],
          [key]: {
            ...current.conditionReport[section][key],
            ...updates
          }
        }
      }
    }));
  }

  function updateVehicleReportField<K extends keyof WarehouseIntakeRecord["vehicleReport"]>(
    key: K,
    value: WarehouseIntakeRecord["vehicleReport"][K]
  ) {
    setDraft((current) => ({
      ...current,
      vehicleReport: {
        ...current.vehicleReport,
        [key]: value
      }
    }));
  }

  function updateConditionCategory(
    key: VehicleConditionCategoryKey,
    updates: Partial<WarehouseIntakeRecord["vehicleReport"]["conditionCategories"][VehicleConditionCategoryKey]>
  ) {
    setDraft((current) => ({
      ...current,
      vehicleReport: {
        ...current.vehicleReport,
        conditionCategories: {
          ...current.vehicleReport.conditionCategories,
          [key]: {
            ...current.vehicleReport.conditionCategories[key],
            ...updates
          }
        }
      }
    }));
  }

  function updateBodyPanel(key: VehicleBodyPanelKey, value: VehicleBodyPanelCondition) {
    setDraft((current) => ({
      ...current,
      vehicleReport: {
        ...current.vehicleReport,
        bodyMap: {
          ...current.vehicleReport.bodyMap,
          [key]: value
        }
      }
    }));
  }

  function addDamageRecord(gridCellId: string, panelKey: VehicleBodyPanelKey, damageType: VehicleDamageType) {
    const nextRecord = createWarehouseDamageRecord(gridCellId, panelKey, damageType);
    setDraft((current) => ({
      ...current,
      vehicleReport: {
        ...current.vehicleReport,
        damageRecords: [...(current.vehicleReport.damageRecords ?? []), nextRecord],
      }
    }));
    return nextRecord;
  }

  function updateDamageRecord(
    damageRecordId: string,
    updates: Partial<WarehouseVehicleDamageRecord>
  ) {
    setDraft((current) => ({
      ...current,
      vehicleReport: {
        ...current.vehicleReport,
        damageRecords: (current.vehicleReport.damageRecords ?? []).map((record) => (
          record.id === damageRecordId
            ? {
                ...record,
                ...updates,
                notes: updates.notes ?? record.notes,
                damageType: updates.damageType ?? record.damageType,
                photoIds: updates.photoIds ?? record.photoIds,
              }
            : record
        )),
      }
    }));
  }

  function removeDamageRecord(damageRecordId: string) {
    setDraft((current) => ({
      ...current,
      vehicleReport: {
        ...current.vehicleReport,
        damageRecords: (current.vehicleReport.damageRecords ?? []).filter((record) => record.id !== damageRecordId),
      }
    }));
  }

  function unlinkOrRemoveDamageRecord(damageRecord: WarehouseVehicleDamageRecord) {
    if (damageRecord.photoIds.length || damageRecord.notes.trim()) {
      updateDamageRecord(damageRecord.id, { gridCellId: "" });
      return;
    }

    removeDamageRecord(damageRecord.id);
  }

  function handleGridCellDamageTypeChange(
    gridCellId: string,
    panelKey: VehicleBodyPanelKey,
    damageType: VehicleDamageType | "none"
  ) {
    setSelectedDamageGridCellId(gridCellId);
    const existingRecords = draft.vehicleReport.damageRecords.filter((record) => record.gridCellId === gridCellId);

    if (damageType === "none") {
      if (!existingRecords.length) return;
      setSelectedDamageRecordId("");
      setDraft((current) => ({
        ...current,
        vehicleReport: {
          ...current.vehicleReport,
          damageRecords: (current.vehicleReport.damageRecords ?? [])
            .flatMap((record) => {
              if (record.gridCellId !== gridCellId) return [record];
              if (record.photoIds.length || record.notes.trim()) {
                return [{ ...record, gridCellId: "" }];
              }
              return [];
            }),
        }
      }));
      return;
    }

    const sameTypeRecord = existingRecords.find((record) => record.damageType === damageType);
    if (sameTypeRecord) {
      setSelectedDamageRecordId(sameTypeRecord.id);
      updateDamageRecord(sameTypeRecord.id, { damageType, panelKey, gridCellId });
      return;
    }

    const nextRecord = addDamageRecord(gridCellId, panelKey, damageType);
    setSelectedDamageRecordId(nextRecord.id);
  }

  function addServiceItem() {
    setDraft((current) => ({
      ...current,
      serviceItems: current.serviceItems.concat(createEmptyWarehouseServiceFeeItem())
    }));
  }

  function updateServiceItem(id: string, updates: Partial<WarehouseServiceFeeItem>) {
    setDraft((current) => ({
      ...current,
      serviceItems: current.serviceItems.map((item) => (
        item.id === id
          ? {
              ...item,
              ...updates,
              gstIncluded: true,
              customerVisible: true
            }
          : item
      ))
    }));
  }

  function removeServiceItem(id: string) {
    setExpandedInternalNotes((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setDraft((current) => ({
      ...current,
      serviceItems: current.serviceItems.filter((item) => item.id !== id)
    }));
  }

  function toggleInternalNote(id: string) {
    setExpandedInternalNotes((current) => ({
      ...current,
      [id]: !current[id]
    }));
  }

  function setAllVehicleDeclarations(value: WarehouseIntakeRecord["declarations"]["financeOwing"]) {
    setDraft((current) => ({
      ...current,
      declarations: {
        ...current.declarations,
        writtenOffHistory: value,
        repairableWriteOffHistory: value,
        stolenRecoveredHistory: value,
        hailDamageHistory: value,
        floodDamageHistory: value,
        engineReplacementHistory: value,
        odometerDiscrepancyKnown: value,
        financeOwing: value,
        financeCompanyName: value === "yes" ? current.declarations.financeCompanyName : ""
      }
    }));
  }

  async function persistSignatureSnapshot(nextDraft: Omit<WarehouseIntakeRecord, "id">) {
    const signaturePad = signatureRef.current;
    const adminStaffName = nextDraft.signature.adminStaffName || actor?.displayName || actor?.name || actor?.email || "CarNest Admin";

    if (!signaturePad || signaturePad.isEmpty()) {
      return {
        ...nextDraft,
        signature: {
          ...nextDraft.signature,
          adminStaffName
        }
      };
    }

    if (!recordId) {
      throw new Error("Save the intake draft once before capturing the signature.");
    }

    const signatureStoragePath = await uploadWarehouseIntakeSignature(signaturePad.toDataUrl(), recordId);
    return {
      ...nextDraft,
      signature: {
        ...nextDraft.signature,
        adminStaffName,
        signatureStoragePath,
        signedAt: nextDraft.signature.signedAt || new Date().toISOString()
      }
    };
  }

  function handleCustomerProfileSelection(customerProfileId: string) {
    const profile = customerProfiles.find((item) => item.id === customerProfileId) || null;
    setDraft((current) => applyCustomerProfileToDraft({
      ...current,
      vehicleRecordId: ""
    }, profile));
  }

  function handleVehicleRecordSelection(vehicleRecordId: string) {
    const record = vehicleRecords.find((item) => item.id === vehicleRecordId) || null;
    setDraft((current) => applyVehicleRecordToDraft(current, record));
  }

  function handleVehicleSelection(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId) || null;
    setDraft((current) => mergeVehicleIntoDraft(current, vehicle));
  }

  async function handleOwnerFileUpload(file?: File | null) {
    if (!file || !recordId) return;
    try {
      setUploadingLabel("Uploading customer identification...");
      const uploaded = await uploadWarehouseIntakeSupportingFile(file, recordId, "licence");
      const nextDraft = {
        ...draft,
        ownerDetails: {
          ...draft.ownerDetails,
          identificationDocument: uploaded
        }
      };
      setDraft(nextDraft);
      await persistDraft(nextDraft, "Customer profile document uploaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't upload that file.");
    } finally {
      setUploadingLabel("");
    }
  }

  async function handleOwnershipProofUpload(file?: File | null) {
    if (!file || !recordId) return;
    try {
      setUploadingLabel("Uploading ownership proof...");
      const uploaded = await uploadWarehouseIntakeSupportingFile(file, recordId, "ownership");
      const nextDraft = {
        ...draft,
        vehicleDetails: {
          ...draft.vehicleDetails,
          ownershipProof: uploaded
        }
      };
      setDraft(nextDraft);
      await persistDraft(nextDraft, "Ownership proof uploaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't upload that ownership proof.");
    } finally {
      setUploadingLabel("");
    }
  }

  async function handlePhotoUpload(category: string, label: string, files: FileList | null, multiple = true) {
    if (!files?.length || !recordId) return;

    try {
      setUploadingLabel(`Uploading ${label.toLowerCase()}...`);
      const uploadedPhotos = await uploadWarehouseIntakePhotos(Array.from(files), recordId, category, label);
      const retained = multiple
        ? draft.photos.concat(uploadedPhotos)
        : draft.photos.filter((photo) => photo.category !== category).concat(uploadedPhotos.slice(0, 1));
      const nextDraft = {
        ...draft,
        photos: retained
      };
      setDraft(nextDraft);
      await persistDraft(nextDraft, "Condition photos uploaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't upload those photos.");
    } finally {
      setUploadingLabel("");
    }
  }

  async function handleDamageRecordPhotoUpload(damageRecordId: string, files: FileList | null) {
    if (!files?.length || !recordId) return;

    const damageRecord = draft.vehicleReport.damageRecords.find((record) => record.id === damageRecordId);
    if (!damageRecord) return;

    try {
      setUploadingLabel(`Uploading ${VEHICLE_BODY_PANEL_LABELS[damageRecord.panelKey].toLowerCase()} damage photos...`);
      const uploadedPhotos = await uploadWarehouseIntakePhotos(
        Array.from(files),
        recordId,
        "damagePhotos",
        getDamagePhotoLabel(damageRecord.panelKey, damageRecord.damageType)
      );
      const nextDraft = {
        ...draft,
        photos: draft.photos.concat(uploadedPhotos),
        vehicleReport: {
          ...draft.vehicleReport,
          damageRecords: draft.vehicleReport.damageRecords.map((record) => (
            record.id === damageRecordId
              ? {
                  ...record,
                  photoIds: [...record.photoIds, ...uploadedPhotos.map((photo) => photo.id)],
                }
              : record
          )),
        }
      };
      setDraft(nextDraft);
      await persistDraft(nextDraft, "Damage record photos uploaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't upload those damage photos.");
    } finally {
      setUploadingLabel("");
    }
  }

  function updatePhotoNote(photoId: string, note: string) {
    setDraft((current) => ({
      ...current,
      photos: current.photos.map((photo) => (
        photo.id === photoId
          ? {
              ...photo,
              note
            }
          : photo
      ))
    }));
  }

  async function handleConfirmPhotoDelete() {
    if (!photoPendingDelete || !recordId || deletingPhotoId) return;

    try {
      setDeletingPhotoId(photoPendingDelete.id);
      setErrorMessage("");
      setNotice("");
      const idToken = await getAdminIdToken();
      await deleteAdminWarehouseIntakePhoto(recordId, photoPendingDelete.id, idToken);
      setDraft((current) => ({
        ...current,
        photos: current.photos.filter((photo) => photo.id !== photoPendingDelete.id),
        vehicleReport: {
          ...current.vehicleReport,
          damageRecords: (current.vehicleReport.damageRecords ?? []).map((record) => ({
            ...record,
            photoIds: record.photoIds.filter((photoId) => photoId !== photoPendingDelete.id),
          })),
        },
      }));
      setNotice("Photo deleted.");
      setPhotoPendingDelete(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete this photo right now. Please try again.");
    } finally {
      setDeletingPhotoId("");
    }
  }

  function validateFinalDraft() {
    const issues: string[] = [];
    if (
      !draft.agreement.informationAccurateConfirmed
      || !draft.agreement.storageAssistanceAuthorized
      || !draft.agreement.electronicSigningConsented
      || !draft.agreement.insuranceMaintainedConfirmed
      || !draft.agreement.directSaleResponsibilityConfirmed
      || !draft.agreement.conditionDocumentationConfirmed
    ) {
      issues.push("All agreement checkboxes must be confirmed before signing.");
    }
    if (!draft.signature.signerName.trim()) issues.push("Signer name is required before capturing the signature.");
    return issues;
  }

  async function sendCustomerEmail(finalRecord: WarehouseIntakeRecord) {
    if (!finalRecord.ownerDetails.email.trim()) {
      return {
        sent: false,
        reason: "no_customer_email_set" as const
      };
    }

    const idToken = await getAdminIdToken();

    const response = await fetch("/api/warehouse-intake-notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        customerEmail: finalRecord.ownerDetails.email,
        customerName: finalRecord.ownerDetails.fullName,
        vehicleTitle: finalRecord.vehicleTitle || "Vehicle listing",
        referenceId: finalRecord.vehicleReference || finalRecord.id,
        pdfStoragePath: finalRecord.signedPdfStoragePath,
        pdfFileName: finalRecord.signedPdfFileName,
        adminStaffName: finalRecord.signature.adminStaffName || finalRecord.adminStaffName,
        signedAt: finalRecord.signature.signedAt,
        financeOwing: finalRecord.declarations.financeOwing
      })
    });

    return await response.json().catch(() => ({ success: false, sent: false }));
  }

  async function handleFinalize() {
    const issues = validateFinalDraft();
    const signatureDrawnButNotSaved = Boolean(signatureRef.current && !signatureRef.current.isEmpty());
    const signatureSaved = Boolean(draft.signature.signatureStoragePath && draft.signature.signedAt);

    if (!signatureSaved && signatureDrawnButNotSaved) {
      issues.push("Please save the signature before finalising the intake.");
    } else if (!signatureSaved) {
      issues.push("Please capture and save the signature before finalising the intake.");
    }
    if (issues.length) {
      setErrorMessage(issues.join(" "));
      return;
    }
    if (!actor || !recordId) return;

    let slowPdfProgressEnabled = false;
    const slowPdfProgressTimer = window.setTimeout(() => {
      slowPdfProgressEnabled = true;
      setUploadingLabel("Generating signed PDF and preparing inspection images. This can take a few seconds.");
    }, 3500);
    const updateSlowPdfProgress = (message: string) => {
      if (!slowPdfProgressEnabled) return;
      setUploadingLabel(message);
    };

    try {
      setSaving(true);
      setErrorMessage("");
      setNotice("");

      const signedAt = draft.signature.signedAt || new Date().toISOString();
      const signatureStoragePath = draft.signature.signatureStoragePath || "";
      const signedDraft = {
        ...draft,
        status: "signed" as const,
        agreement: {
          ...draft.agreement,
          reviewedAt: signedAt
        },
        signature: {
          ...draft.signature,
          adminStaffName: draft.signature.adminStaffName || actor.displayName || actor.name || actor.email || "CarNest Admin",
          signedAt,
          signatureStoragePath
        },
        completedAt: signedAt,
        adminStaffName: draft.adminStaffName || actor.displayName || actor.name || actor.email || "CarNest Admin"
      };

      const previewRecord = {
        id: recordId,
        ...signedDraft,
        photoCount: signedDraft.photos.length,
        createdAt: draft.createdAt,
        updatedAt: signedAt
      } satisfies WarehouseIntakeRecord;
      const idToken = await getAdminIdToken();
      const pdfBytes = await generateWarehouseIntakePdf(previewRecord, {
        resolveStorageBytes: async (storagePath) => await fetchAdminWarehouseIntakeFileBytes(storagePath, idToken),
        onProgress: (message) => updateSlowPdfProgress(message)
      });
      updateSlowPdfProgress("Uploading signed PDF...");
      const pdfFileName = `${(signedDraft.vehicleReference || recordId).replace(/\s+/g, "-").toLowerCase()}-warehouse-intake.pdf`;
      const signedPdfStoragePath = await uploadWarehouseIntakePdf(pdfBytes, recordId, pdfFileName);

      updateSlowPdfProgress("Saving signed intake...");
      const saved = await persistDraft(
        {
          ...signedDraft,
          signedPdfStoragePath,
          signedPdfFileName: pdfFileName,
          pdfGeneratedAt: signedAt
        },
        "Signed intake saved."
      );

      updateSlowPdfProgress("Sending signed PDF to the customer...");
      const emailResult = await sendCustomerEmail(saved);
      if (emailResult?.sent) {
        const emailedDraft = {
          ...toDraft(saved),
          emailSentAt: new Date().toISOString()
        };
        await persistDraft(emailedDraft);
        setNotice("Signed intake completed, PDF generated, and customer email sent.");
      } else {
        setNotice(saved.ownerDetails.email ? "Signed intake completed. PDF generated, but customer email could not be sent." : "Signed intake completed. PDF generated, but no customer email was set.");
      }

      setCurrentStep(WAREHOUSE_INTAKE_STEPS.length - 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't finalise the warehouse intake.");
    } finally {
      window.clearTimeout(slowPdfProgressTimer);
      setUploadingLabel("");
      setSaving(false);
    }
  }

  async function handleResendEmail() {
    if (!recordId) return;
    try {
      setSaving(true);
      const record = {
        id: recordId,
        ...draft,
        photoCount: draft.photos.length
      } satisfies WarehouseIntakeRecord;
      const emailResult = await sendCustomerEmail(record);
      if (emailResult?.sent) {
        const emailedDraft = {
          ...draft,
          emailSentAt: new Date().toISOString()
        };
        setDraft(emailedDraft);
        await persistDraft(emailedDraft, "Customer email sent.");
      } else {
        setNotice("Intake saved, but no customer email was sent.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't send the customer email.");
    } finally {
      setSaving(false);
    }
  }

  function handlePrintPdf() {
    if (!draft.signedPdfStoragePath) return;
    void openPrivatePdf(draft.signedPdfStoragePath).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't open the signed PDF.");
    });
  }

  function handleDownloadPdf() {
    if (!draft.signedPdfStoragePath) return;
    void downloadPrivatePdf(draft.signedPdfStoragePath, draft.signedPdfFileName || "carnest-warehouse-intake.pdf").catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't download the signed PDF.");
    });
  }

  async function handleNextStep() {
    if (currentStep === 4) {
      try {
        await persistDraft(draft, draft.signature.signatureStoragePath ? "Signature details saved." : "Signature saved.");
      } catch {
        return;
      }
    }

    setCurrentStep((current) => Math.min(WAREHOUSE_INTAKE_STEPS.length - 1, current + 1));
  }

  if (!hasAdminPermission(appUser, "manageVehicles")) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm text-ink/60">You need vehicle-management permission to use the storage contracts workspace.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm text-ink/60">Preparing the storage contract workflow...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {photoPendingDelete ? (
        <PhotoDeleteDialog
          photo={photoPendingDelete}
          deleting={deletingPhotoId === photoPendingDelete.id}
          onCancel={() => {
            if (!deletingPhotoId) {
              setPhotoPendingDelete(null);
            }
          }}
          onConfirm={() => void handleConfirmPhotoDelete()}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">CarNest storage contract</p>
          <h2 className="mt-2 font-display text-3xl text-ink">{draft.vehicleTitle || "Standalone storage contract"}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
            Capture owner details, vehicle details, structured condition notes, storage terms, signatures, and the buyer-facing CarNest Condition Summary from one iPad-friendly workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={draft.status === "signed" ? "Signed agreement" : draft.status === "review_ready" ? "Ready for signature" : "Draft in progress"} tone={draft.status === "signed" ? "success" : "warning"} />
          {draft.signedPdfStoragePath ? <StatusPill label="PDF available" tone="success" /> : <StatusPill label="PDF pending" />}
          {draft.signature.signedAt && draft.signature.signatureStoragePath ? <StatusPill label="Signature captured" tone="success" /> : <StatusPill label="Signature pending" tone="warning" />}
          {conditionOverviewReady ? <StatusPill label="Condition Summary ready" tone="success" /> : <StatusPill label="Condition Summary pending" />}
        </div>
      </div>

      {notice ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}
      {activeEditorConflict ? (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {activeEditorConflict.name} last updated this intake at {formatAdminDateTime(activeEditorConflict.activeAt)}. Please double-check before making overlapping changes.
        </div>
      ) : null}
      <div className="rounded-[22px] border border-black/8 bg-shell px-4 py-3 text-sm text-ink/68">
        Draft onboarding can be saved at any stage. Missing documents, photos, ownership proof, or signatures can stay pending and be supplied later.
      </div>
      {uploadingLabel ? (
        <div className="rounded-[22px] border border-black/8 bg-shell px-4 py-3 text-sm text-ink/65">{uploadingLabel}</div>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-1">
        {WAREHOUSE_INTAKE_STEPS.map((step, index) => (
          <button
            key={step}
            type="button"
            onClick={() => setCurrentStep(index)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              currentStep === index ? "bg-ink text-white" : "border border-black/10 bg-white text-ink/68 hover:border-[#C6A87D]/35 hover:text-ink"
            }`}
          >
            {index + 1}. {step}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {currentStep === 0 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">1. Owner information</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                Select an existing customer profile for a returning owner, or continue with a new reusable customer profile. Identity and verification details remain admin-only.
              </p>
              <div className="mt-5 space-y-2">
                <FieldLabel>Existing customer</FieldLabel>
                <SelectInput value={draft.customerProfileId || ""} onChange={(event) => handleCustomerProfileSelection(event.target.value)}>
                  <option value="">Create new customer profile</option>
                  {customerProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {getCustomerProfileLabel(profile)} · {profile.email || profile.phone || profile.id}
                    </option>
                  ))}
                </SelectInput>
                <FieldNote>Returning customers can be selected here so staff do not need to re-enter their name, phone, or email for future vehicles.</FieldNote>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Full name</FieldLabel>
                  <TextInput value={draft.ownerDetails.fullName} onChange={(event) => updateOwnerField("fullName", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Email</FieldLabel>
                  <TextInput type="email" value={draft.ownerDetails.email} onChange={(event) => updateOwnerField("email", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Phone</FieldLabel>
                  <TextInput value={draft.ownerDetails.phone} onChange={(event) => updateOwnerField("phone", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Preferred contact method</FieldLabel>
                  <SelectInput
                    value={draft.ownerDetails.preferredContactMethod}
                    onChange={(event) => updateOwnerField("preferredContactMethod", event.target.value as WarehouseIntakeOwnerDetails["preferredContactMethod"])}
                  >
                    {WAREHOUSE_CONTACT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </SelectInput>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Address (optional)</FieldLabel>
                  <TextAreaInput value={draft.ownerDetails.address} onChange={(event) => updateOwnerField("address", event.target.value)} className="min-h-[96px]" />
                </div>
                {canViewSensitiveCustomerFields ? (
                  <div className="space-y-2">
                    <FieldLabel>Date of birth (admin only)</FieldLabel>
                    <TextInput type="date" value={draft.ownerDetails.dateOfBirth} onChange={(event) => updateOwnerField("dateOfBirth", event.target.value)} />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <FieldLabel>Identification type (optional)</FieldLabel>
                  <SelectInput
                    value={draft.ownerDetails.identificationDocumentType}
                    onChange={(event) => updateOwnerField("identificationDocumentType", event.target.value as WarehouseIntakeOwnerDetails["identificationDocumentType"])}
                  >
                    {WAREHOUSE_IDENTIFICATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </SelectInput>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Document number (optional)</FieldLabel>
                  <TextInput
                    value={draft.ownerDetails.identificationDocumentNumber}
                    onChange={(event) => updateOwnerField("identificationDocumentNumber", event.target.value)}
                    placeholder="Licence or passport number"
                  />
                </div>
                {canViewSensitiveCustomerFields ? (
                  <>
                    <label className="flex items-center gap-3 rounded-[18px] border border-black/8 bg-shell px-4 py-3 text-sm text-ink md:col-span-2">
                      <input
                        type="checkbox"
                        checked={draft.ownerDetails.companyOwned}
                        onChange={(event) => updateOwnerField("companyOwned", event.target.checked)}
                        className="h-4 w-4 rounded border-black/20 text-ink"
                      />
                      <span>Company-owned vehicle</span>
                    </label>
                    {draft.ownerDetails.companyOwned ? (
                      <>
                        <div className="space-y-2">
                          <FieldLabel>Company name (admin only)</FieldLabel>
                          <TextInput value={draft.ownerDetails.companyName} onChange={(event) => updateOwnerField("companyName", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>ABN (admin only)</FieldLabel>
                          <TextInput value={draft.ownerDetails.abn} onChange={(event) => updateOwnerField("abn", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>ACN (admin only)</FieldLabel>
                          <TextInput value={draft.ownerDetails.acn} onChange={(event) => updateOwnerField("acn", event.target.value)} />
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
                <div className="space-y-2">
                  <FieldLabel>ID document upload (optional)</FieldLabel>
                  <TextInput type="file" accept="image/*,.pdf" onChange={(event) => void handleOwnerFileUpload(event.target.files?.[0])} />
                  <FieldNote>{draft.ownerDetails.identificationDocument?.name || "Pending / to be supplied later if the customer has not brought ID yet."}</FieldNote>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Customer verification notes</FieldLabel>
                  <TextAreaInput
                    value={draft.ownerDetails.customerVerificationNotes}
                    onChange={(event) => updateOwnerField("customerVerificationNotes", event.target.value)}
                    className="min-h-[96px]"
                    placeholder="Verification observations, preferred contact timing, or admin-only customer notes"
                  />
                </div>
              </div>
              <label className="mt-5 flex items-start gap-3 rounded-[20px] border border-black/6 bg-shell px-4 py-4 text-sm text-ink/72">
                <input
                  type="checkbox"
                  checked={draft.ownerDetails.isLegalOwnerConfirmed}
                  onChange={(event) => updateOwnerField("isLegalOwnerConfirmed", event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-black/20 text-ink"
                />
                <span>I confirm I am the legal owner or authorised representative of this vehicle.</span>
              </label>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">2. Vehicle information</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                Select an existing private vehicle record for this owner, or capture the full vehicle information used by both the storage contract and buyer-facing CarNest Condition Summary.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Existing vehicle for this customer</FieldLabel>
                  <SelectInput value={draft.vehicleRecordId || ""} onChange={(event) => handleVehicleRecordSelection(event.target.value)}>
                    <option value="">Create new private vehicle record</option>
                    {customerVehicleRecords.map((record) => (
                      <option key={record.id} value={record.id}>
                        {getVehicleRecordLabel(record)} · {record.registrationPlate || record.vin || record.id}
                      </option>
                    ))}
                  </SelectInput>
                  <FieldNote>Select an existing customer first to narrow reusable vehicle records.</FieldNote>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Linked public listing (optional)</FieldLabel>
                  <SelectInput value={draft.vehicleId || ""} onChange={(event) => handleVehicleSelection(event.target.value)}>
                    <option value="">No public listing linked yet</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {getVehicleDisplayReference(vehicle)} · {vehicle.year} {vehicle.make} {vehicle.model}
                      </option>
                    ))}
                  </SelectInput>
                </div>

                {[
                  ["make", "Make"],
                  ["model", "Model"],
                  ["variant", "Variant"],
                  ["year", "Year"],
                  ["registrationPlate", "Rego"],
                  ["vin", "VIN"],
                  ["colour", "Colour"],
                  ["odometer", "Odometer"],
                  ["registrationExpiry", "Rego expiry"],
                  ["numberOfKeys", "Number of keys"],
                  ["askingPrice", "Asking price"],
                  ["reservePrice", "Reserve price"],
                  ["warrantyStatus", "Warranty status"],
                  ["numberOfOwners", "Number of owners"],
                  ["accidentHistory", "Accident history"]
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <FieldLabel>{label}</FieldLabel>
                    <TextInput
                      value={draft.vehicleDetails[key as keyof typeof draft.vehicleDetails] as string}
                      onChange={(event) => updateVehicleField(key as keyof typeof draft.vehicleDetails, event.target.value as never)}
                    />
                  </div>
                ))}

                <div className="space-y-2">
                  <FieldLabel>Fuel type</FieldLabel>
                  <SelectInput value={draft.vehicleDetails.fuelType} onChange={(event) => updateVehicleField("fuelType", event.target.value)}>
                    <option value="">Select fuel type</option>
                    {VEHICLE_FUEL_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </SelectInput>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Transmission</FieldLabel>
                  <SelectInput value={draft.vehicleDetails.transmission} onChange={(event) => updateVehicleField("transmission", event.target.value)}>
                    <option value="">Select transmission</option>
                    {VEHICLE_TRANSMISSION_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </SelectInput>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Drivetrain</FieldLabel>
                  <SelectInput value={draft.vehicleDetails.drivetrain} onChange={(event) => updateVehicleField("drivetrain", event.target.value)}>
                    <option value="">Select drivetrain</option>
                    {VEHICLE_DRIVETRAIN_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </SelectInput>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Ownership proof upload</FieldLabel>
                  <TextInput type="file" accept="image/*,.pdf" onChange={(event) => void handleOwnershipProofUpload(event.target.files?.[0])} />
                  <FieldNote>{draft.vehicleDetails.ownershipProof?.name || "Pending / to be supplied later. Preferably registration paper or ownership proof."}</FieldNote>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <FieldLabel>Service History</FieldLabel>
                      <FieldNote>Capture each service visit as a structured record. Existing free-text notes stay below as legacy notes.</FieldNote>
                    </div>
                    <button
                      type="button"
                      onClick={addServiceHistoryRecord}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                    >
                      Add service record
                    </button>
                  </div>

                  {serviceHistoryRecords.length ? (
                    <div className="space-y-4">
                      {serviceHistoryRecords.map((record) => (
                        <div key={record.id} className="rounded-[24px] border border-black/6 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-ink">{formatVehicleServiceHistoryDate(record)}</p>
                            <button
                              type="button"
                              onClick={() => removeServiceHistoryRecord(record.id)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-4 grid gap-4 md:grid-cols-5">
                            <div className="space-y-2">
                              <FieldLabel>Day</FieldLabel>
                              <SelectInput
                                value={record.serviceDateDay}
                                onChange={(event) => updateServiceHistoryRecord(record.id, { serviceDateDay: event.target.value })}
                              >
                                <option value="">Day</option>
                                {VEHICLE_SERVICE_HISTORY_DAY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </SelectInput>
                            </div>
                            <div className="space-y-2">
                              <FieldLabel>Month</FieldLabel>
                              <SelectInput
                                value={record.serviceDateMonth}
                                onChange={(event) => updateServiceHistoryRecord(record.id, { serviceDateMonth: event.target.value })}
                              >
                                <option value="">Month</option>
                                {VEHICLE_SERVICE_HISTORY_MONTH_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </SelectInput>
                            </div>
                            <div className="space-y-2">
                              <FieldLabel>Year</FieldLabel>
                              <SelectInput
                                value={record.serviceDateYear}
                                onChange={(event) => updateServiceHistoryRecord(record.id, { serviceDateYear: event.target.value })}
                              >
                                <option value="">Year</option>
                                {VEHICLE_SERVICE_HISTORY_YEAR_OPTIONS.map((year) => (
                                  <option key={year} value={year}>{year}</option>
                                ))}
                              </SelectInput>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <FieldLabel>Odometer / mileage at service</FieldLabel>
                              <TextInput
                                value={record.odometer}
                                onChange={(event) => updateServiceHistoryRecord(record.id, { odometer: event.target.value })}
                                placeholder="e.g. 45,000 km"
                              />
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <FieldLabel>Notes</FieldLabel>
                            <TextAreaInput
                              value={record.notes}
                              onChange={(event) => updateServiceHistoryRecord(record.id, { notes: event.target.value })}
                              className="min-h-[92px]"
                              placeholder="Optional service note"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-black/10 bg-white/65 px-4 py-5 text-sm text-ink/58">
                      No structured service records added yet.
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Legacy service history notes</FieldLabel>
                  <TextAreaInput
                    value={draft.vehicleDetails.serviceHistory}
                    onChange={(event) => updateVehicleField("serviceHistory", event.target.value)}
                    className="min-h-[96px]"
                    placeholder="Keep any older free-text service history notes here"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Vehicle notes</FieldLabel>
                  <TextAreaInput value={draft.vehicleDetails.notes} onChange={(event) => updateVehicleField("notes", event.target.value)} />
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-black/5 bg-shell p-4">
                <h4 className="text-lg font-semibold text-ink">Vehicle declarations</h4>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAllVehicleDeclarations("no")}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                  >
                    Set all to No
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllVehicleDeclarations("yes")}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                  >
                    Set all to Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllVehicleDeclarations("unknown")}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                  >
                    Set all to Unknown
                  </button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {[
                    ["writtenOffHistory", "Written-off history"],
                    ["repairableWriteOffHistory", "Repairable write-off history"],
                    ["stolenRecoveredHistory", "Stolen / recovered history"],
                    ["hailDamageHistory", "Hail damage history"],
                    ["floodDamageHistory", "Flood damage history"],
                    ["engineReplacementHistory", "Engine replacement history"],
                    ["odometerDiscrepancyKnown", "Odometer discrepancy known"],
                    ["financeOwing", "Finance owing"]
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <FieldLabel>{label}</FieldLabel>
                      <SelectInput
                        value={draft.declarations[key as keyof typeof draft.declarations] as string}
                        onChange={(event) => updateDeclarationField(key as keyof typeof draft.declarations, event.target.value as never)}
                      >
                        {WAREHOUSE_DECLARATION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </SelectInput>
                    </div>
                  ))}
                  {draft.declarations.financeOwing === "yes" ? (
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>Finance company name</FieldLabel>
                      <TextInput value={draft.declarations.financeCompanyName} onChange={(event) => updateDeclarationField("financeCompanyName", event.target.value)} />
                    </div>
                  ) : null}
                </div>
                <label className="mt-5 flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input
                    type="checkbox"
                    checked={draft.declarations.isInformationAccurate}
                    onChange={(event) => updateDeclarationField("isInformationAccurate", event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-black/20 text-ink"
                  />
                  <span>I declare that all information provided is true and correct to the best of my knowledge.</span>
                </label>
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">3. Vehicle condition</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                Capture the structured condition details that feed the CarNest Condition Summary. Keep owner/private notes out of this section and focus on vehicle condition evidence only.
              </p>
              <div className="mt-5 space-y-5">
                {(
                  Object.keys(VEHICLE_CONDITION_CATEGORY_LABELS) as VehicleConditionCategoryKey[]
                ).map((key) => {
                  const category = draft.vehicleReport.conditionCategories[key];
                  const isNotesOnly = NOTES_ONLY_CONDITION_CATEGORY_KEYS.has(key);
                  return (
                    <div key={key} className="rounded-[24px] border border-black/6 bg-shell p-5">
                      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-ink">{VEHICLE_CONDITION_CATEGORY_LABELS[key]}</p>
                          <FieldNote>{VEHICLE_CONDITION_CATEGORY_HELPERS[key]}</FieldNote>
                          {isNotesOnly ? (
                            <FieldNote>Internal notes only. This section is no longer scored or shown to buyers.</FieldNote>
                          ) : (
                            <SelectInput
                              value={category.score}
                              onChange={(event) => updateConditionCategory(key, { score: event.target.value as VehicleConditionScore | "" })}
                            >
                              <option value="">Select score</option>
                              {VEHICLE_CONDITION_SCORE_SELECT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </SelectInput>
                          )}
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>Optional notes</FieldLabel>
                          <TextAreaInput
                            className="min-h-[104px]"
                            placeholder={
                              isNotesOnly
                                ? `Capture internal ${VEHICLE_CONDITION_CATEGORY_LABELS[key].toLowerCase()} notes for admin reference.`
                                : `Capture ${VEHICLE_CONDITION_CATEGORY_LABELS[key].toLowerCase()} notes for buyers.`
                            }
                            value={category.notes}
                            onChange={(event) => updateConditionCategory(key, { notes: event.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>PPSR status</FieldLabel>
                    <TextInput
                      placeholder="e.g. Clear / finance owing / seller declaration pending"
                      value={draft.vehicleReport.ppsrStatus}
                      onChange={(event) => updateVehicleReportField("ppsrStatus", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>RWC cooperation</FieldLabel>
                    <SelectInput
                      value={draft.vehicleReport.rwcCooperation}
                      onChange={(event) => updateVehicleReportField("rwcCooperation", event.target.value as VehicleReportRwcCooperation | "")}
                    >
                      <option value="">Select RWC position</option>
                      {VEHICLE_REPORT_RWC_COOPERATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Wheel condition</FieldLabel>
                    <TextAreaInput
                      className="min-h-[96px]"
                      value={draft.vehicleReport.wheelCondition}
                      onChange={(event) => updateVehicleReportField("wheelCondition", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Panel repair / repaint notes</FieldLabel>
                    <TextAreaInput
                      className="min-h-[96px]"
                      value={draft.vehicleReport.panelRepairNotes}
                      onChange={(event) => updateVehicleReportField("panelRepairNotes", event.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/6 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">Exterior body map</p>
                      <FieldNote>Tap a smaller grid area on the vehicle map to mark exact damage locations, then choose the damage type from the floating picker.</FieldNote>
                    </div>
                  </div>
                  <div className="mt-4">
                    <VehicleConditionBodyMap
                      bodyMap={draft.vehicleReport.bodyMap}
                      editable
                      onPanelChange={updateBodyPanel}
                      selectedPanel={selectedDamageGridCell?.panelKey}
                      onPanelSelect={() => undefined}
                      damageRecords={damageRecords}
                      selectedGridCellId={selectedDamageGridCellId}
                      onGridCellSelect={(gridCellId) => {
                        setSelectedDamageGridCellId(gridCellId);
                        setSelectedDamageRecordId("");
                      }}
                      onGridCellDamageTypeChange={handleGridCellDamageTypeChange}
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/6 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">Selected damage grid area</p>
                      <FieldNote>
                        After you select a damage type on the floating picker, add optional notes and linked photos for that exact grid location here.
                      </FieldNote>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-black/6 bg-shell px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Selected grid cell</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {selectedDamageGridCell ? formatVehicleBodyDamageGridCellLabel(selectedDamageGridCell.id) : "Tap a grid cell on the body map"}
                    </p>
                    <p className="mt-1 text-sm text-ink/62">
                      {selectedDamageGridCell
                        ? `${VEHICLE_BODY_PANEL_LABELS[selectedDamageGridCell.panelKey]} • Cell ${selectedDamageGridCell.code}`
                        : "Choose a grid area first to start marking exact damage."}
                    </p>
                  </div>

                  <div className="mt-4 space-y-4">
                    {selectedDamageGridCell && selectedGridCellDamageRecords.length ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            {selectedGridCellDamageRecords.map((record) => (
                              <button
                                key={record.id}
                                type="button"
                                onClick={() => setSelectedDamageRecordId(record.id)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                  selectedGridCellActiveDamageRecord?.id === record.id
                                    ? "border-[#C6A87D] bg-white text-ink shadow-sm"
                                    : "border-black/10 bg-shell text-ink/72 hover:border-bronze hover:text-bronze"
                                }`}
                              >
                                {VEHICLE_DAMAGE_TYPE_LABELS[record.damageType]}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGridCellDamageTypeChange(selectedDamageGridCell.id, selectedDamageGridCell.panelKey, "none")}
                            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                          >
                            Clear grid cell
                          </button>
                        </div>

                        {selectedGridCellDamageRecords.map((record) => {
                          const recordPhotos = draft.photos.filter((photo) => record.photoIds.includes(photo.id));
                          const isActiveRecord = selectedGridCellActiveDamageRecord?.id === record.id;
                          return (
                            <div
                              key={record.id}
                              className={`rounded-[22px] border p-4 transition ${
                                isActiveRecord
                                  ? "border-[#C6A87D] bg-white shadow-[0_14px_34px_rgba(24,18,12,0.08)]"
                                  : "border-black/6 bg-shell"
                              }`}
                              onClick={() => setSelectedDamageRecordId(record.id)}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-ink">{VEHICLE_DAMAGE_TYPE_LABELS[record.damageType]}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">
                                    {formatVehicleBodyDamageGridCellLabel(selectedDamageGridCell.id)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    unlinkOrRemoveDamageRecord(record);
                                  }}
                                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                                >
                                  {record.photoIds.length || record.notes.trim() ? "Move to additional photos" : "Remove damage type"}
                                </button>
                              </div>

                              <div className="mt-4 space-y-2">
                                <FieldLabel>Notes</FieldLabel>
                                <TextAreaInput
                                  className="min-h-[96px]"
                                  placeholder="Optional buyer-facing damage note for this exact grid area."
                                  value={record.notes}
                                  onChange={(event) => updateDamageRecord(record.id, { notes: event.target.value })}
                                />
                              </div>

                              <div className="mt-4 space-y-2">
                                <FieldLabel>Linked photos</FieldLabel>
                                <TextInput
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  multiple
                                  disabled={!recordId}
                                  onChange={(event) => void handleDamageRecordPhotoUpload(record.id, event.target.files)}
                                />
                                <FieldNote>
                                  {recordId
                                    ? "Take or upload one or more photos for this exact grid cell on mobile, iPad, or desktop."
                                    : "Save the intake draft once before uploading grid-linked damage photos."}
                                </FieldNote>
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {recordPhotos.length ? (
                                  recordPhotos.map((photo) => (
                                    <WarehouseIntakePhotoCard
                                      key={photo.id}
                                      photo={photo}
                                      alt={photo.label || getDamagePhotoLabel(record.panelKey, record.damageType)}
                                      canDelete={canDeletePhotos}
                                      evidenceLocked={evidenceLocked}
                                      deleting={deletingPhotoId === photo.id}
                                      onRequestDelete={setPhotoPendingDelete}
                                    />
                                  ))
                                ) : (
                                  <div className="rounded-[18px] border border-dashed border-black/10 bg-white px-4 py-5 text-sm text-ink/55">
                                    No photos linked to this damage type yet.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-5 text-sm text-ink/58">
                        {selectedDamageGridCell
                          ? "Tap this grid cell on the body map and choose a damage type from the floating picker to create a linked damage record."
                          : "Tap a grid cell on the body map to start linking a precise damage location."}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Damage / condition notes</FieldLabel>
                  <TextAreaInput
                    className="min-h-[112px]"
                    placeholder="Record scratches, dents, wheel rash, interior marks, transport notes, or anything the buyer-facing overview should explain."
                    value={draft.vehicleReport.damageConditionNotes}
                    onChange={(event) => {
                      updateVehicleReportField("damageConditionNotes", event.target.value);
                      updateConditionItem("exterior", "visibleDefects", {
                        notes: event.target.value,
                        documented: Boolean(event.target.value.trim())
                      });
                    }}
                  />
                  <FieldNote>This note is included in the buyer-facing CarNest Condition Summary.</FieldNote>
                </div>

                <div className="rounded-[24px] border border-black/6 bg-shell p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <FieldLabel>Additional damage photos</FieldLabel>
                      <FieldNote>
                        Legacy or unlinked damage photos stay here for internal reference and buyer fallback when they are not attached to a specific grid location.
                      </FieldNote>
                    </div>
                    <div className="w-full max-w-sm">
                      <TextInput
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(event) => void handlePhotoUpload("damagePhotos", "Damage photos", event.target.files, true)}
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {additionalDamagePhotos.length ? additionalDamagePhotos.map((photo) => (
                      <div key={photo.id} className="space-y-2">
                        <WarehouseIntakePhotoCard
                          photo={photo}
                          alt={photo.label}
                          canDelete={canDeletePhotos}
                          evidenceLocked={evidenceLocked}
                          deleting={deletingPhotoId === photo.id}
                          onRequestDelete={setPhotoPendingDelete}
                        />
                        <TextAreaInput
                          className="min-h-[84px]"
                          value={photo.note || ""}
                          onChange={(event) => updatePhotoNote(photo.id, event.target.value)}
                          placeholder="Legacy damage note or extra buyer-facing context"
                        />
                      </div>
                    )) : (
                      <div className="rounded-[18px] border border-dashed border-black/10 bg-white px-4 py-5 text-sm text-ink/55">
                        No additional unlinked damage photos recorded.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {NON_DAMAGE_WAREHOUSE_PHOTO_SECTIONS.map((section) => {
                  const sectionPhotos = draft.photos.filter((photo) => photo.category === section.key);
                  return (
                    <div key={section.key} className="rounded-[24px] border border-black/5 bg-shell p-4">
                      <FieldLabel>{section.label}</FieldLabel>
                      <div className="mt-3">
                        <TextInput
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple={section.multiple}
                          onChange={(event) => void handlePhotoUpload(section.key, section.label, event.target.files, section.multiple)}
                        />
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {sectionPhotos.map((photo) => (
                          <div key={photo.id} className="space-y-2">
                            <WarehouseIntakePhotoCard
                              photo={photo}
                              alt={photo.label}
                              canDelete={canDeletePhotos}
                              evidenceLocked={evidenceLocked}
                              deleting={deletingPhotoId === photo.id}
                              onRequestDelete={setPhotoPendingDelete}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-[24px] border border-black/5 bg-shell p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-ink">Service fee items</h4>
                    <p className="mt-1 text-sm text-ink/58">Add optional operational fees for warehouse-managed vehicles. Amounts are stored GST-inclusive and shown on the customer PDF by default.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addServiceItem}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                  >
                    Add fee item
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {draft.serviceItems.map((item) => (
                    <div key={item.id} className="rounded-[20px] border border-black/8 bg-white p-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <FieldLabel>Service name</FieldLabel>
                          <TextInput
                            className="min-h-[44px]"
                            value={item.serviceName}
                            onChange={(event) => updateServiceItem(item.id, { serviceName: event.target.value })}
                            placeholder="e.g. Car wash"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <FieldLabel>Category</FieldLabel>
                            <SelectInput
                              className="min-h-[44px]"
                              value={item.category}
                              onChange={(event) => updateServiceItem(item.id, { category: event.target.value as WarehouseServiceFeeItem["category"] })}
                            >
                              {WAREHOUSE_SERVICE_FEE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </SelectInput>
                          </div>
                          <div className="space-y-2">
                            <FieldLabel>Amount</FieldLabel>
                            <TextInput
                              className="min-h-[44px]"
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={item.amount || ""}
                              onChange={(event) => updateServiceItem(item.id, { amount: Number(event.target.value || 0) })}
                            />
                          </div>
                        </div>
                        <p className="text-xs font-medium text-ink/58">GST inclusive · Customer visible on PDF</p>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleInternalNote(item.id)}
                            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                          >
                            {expandedInternalNotes[item.id] ? "Hide internal note" : "Add internal note"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeServiceItem(item.id)}
                            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {expandedInternalNotes[item.id] ? (
                        <div className="mt-3 space-y-2">
                          <FieldLabel>Internal note</FieldLabel>
                          <TextAreaInput className="min-h-[88px]" value={item.internalNote} onChange={(event) => updateServiceItem(item.id, { internalNote: event.target.value })} placeholder="Internal workshop, storage, or coordination note" />
                          <FieldNote>Internal notes stay admin-only and are not shown on the customer PDF.</FieldNote>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {!draft.serviceItems.length ? (
                    <div className="rounded-[18px] border border-dashed border-black/10 bg-white px-4 py-4 text-sm text-ink/58">
                      No service items added yet. Leave this empty if no operational fees apply.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">4. CarNest platform terms</h3>
              <div className="mt-5 rounded-[24px] border border-black/5 bg-shell p-5">
                <p className="text-sm leading-7 text-ink/72">
                  Customer: <strong className="text-ink">{draft.ownerDetails.fullName || "Pending"}</strong>
                  <br />
                  Vehicle: <strong className="text-ink">{draft.vehicleTitle || getVehicleRecordLabel(selectedVehicleRecord) || "Private vehicle record"}</strong>
                  <br />
                  Date: <strong className="text-ink">{new Date().toLocaleDateString("en-AU")}</strong>
                </p>
                <div className="mt-5 space-y-3">
                  {CARNEST_CONCIERGE_AGREEMENT_COPY.map((line) => (
                    <p key={line} className="text-sm leading-7 text-ink/72">{line}</p>
                  ))}
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <p className="text-sm leading-6 text-ink/58">
                  Agreement confirmation is only required when you are ready to finalise the intake and capture the signature.
                </p>
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.informationAccurateConfirmed} onChange={(event) => updateAgreementField("informationAccurateConfirmed", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I confirm that all information provided is true and accurate to the best of my knowledge.</span>
                </label>
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.storageAssistanceAuthorized} onChange={(event) => updateAgreementField("storageAssistanceAuthorized", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I authorise CarNest to provide storage, presentation, listing support, inspection coordination, and operational assistance only.</span>
                </label>
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.conditionDocumentationConfirmed} onChange={(event) => updateAgreementField("conditionDocumentationConfirmed", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I confirm the vehicle condition is documented as shown in the attached photos and intake notes.</span>
                </label>
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.insuranceMaintainedConfirmed} onChange={(event) => updateAgreementField("insuranceMaintainedConfirmed", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I confirm that valid comprehensive insurance will be maintained while the vehicle is in warehouse-managed service.</span>
                </label>
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.directSaleResponsibilityConfirmed} onChange={(event) => updateAgreementField("directSaleResponsibilityConfirmed", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I understand CarNest is not a dealer or party to the sale, does not handle funds, and all sale decisions and funds remain between buyer and seller.</span>
                </label>
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.electronicSigningConsented} onChange={(event) => updateAgreementField("electronicSigningConsented", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I agree to receive and sign this agreement electronically.</span>
                </label>
              </div>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">5. Signature</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Signer name</FieldLabel>
                  <TextInput value={draft.signature.signerName} onChange={(event) => updateSignatureField("signerName", event.target.value)} placeholder="Customer name" />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Admin staff name</FieldLabel>
                  <TextInput value={draft.signature.adminStaffName} onChange={(event) => updateSignatureField("adminStaffName", event.target.value)} placeholder="Staff member present" />
                </div>
              </div>
              <div className="mt-5">
                <SignaturePad ref={signatureRef} />
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    signatureRef.current?.clear();
                    setDraft((current) => ({
                      ...current,
                      signature: {
                        ...current.signature,
                        signedAt: "",
                        signatureStoragePath: ""
                      }
                    }));
                  }}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                >
                  Clear signature
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink/58">
                Tap <span className="font-semibold text-ink">Save draft</span> or <span className="font-semibold text-ink">Next</span> after signing so the signature is stored before finalising the intake.
              </p>
            </div>
          ) : null}

          {currentStep === 5 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">6. Complete, report, and email</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[22px] border border-black/6 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">Customer profile</p>
                  <p className="mt-2 text-sm text-ink/72">{draft.ownerDetails.fullName || "Pending"} · {draft.customerProfileId || "Will be linked on save"}</p>
                </div>
                <div className="rounded-[22px] border border-black/6 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">Vehicle record</p>
                  <p className="mt-2 text-sm text-ink/72">{getVehicleRecordLabel(selectedVehicleRecord) || draft.vehicleTitle || "Pending"} · {draft.vehicleRecordId || "Will be linked on save"}</p>
                </div>
                <div className="rounded-[22px] border border-black/6 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">Documentation</p>
                  <p className="mt-2 text-sm text-ink/72">{draft.photos.length} photos uploaded</p>
                </div>
                <div className="rounded-[22px] border border-black/6 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">Service items</p>
                  <p className="mt-2 text-sm text-ink/72">{draft.serviceItems.length} item{draft.serviceItems.length === 1 ? "" : "s"} · ${serviceFeeTotals.gstInclusiveTotal.toFixed(2)} incl GST</p>
                </div>
                <div className="rounded-[22px] border border-black/6 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">PDF</p>
                  <p className="mt-2 text-sm text-ink/72">{draft.signedPdfStoragePath ? "Generated and stored" : "Generate on final sign-off"}</p>
                </div>
                <div className="rounded-[22px] border border-black/6 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">Condition Summary</p>
                  <p className="mt-2 text-sm text-ink/72">{conditionOverviewReady ? "Available for signed-in buyers" : "Visible after Exterior & Body and Interior Condition are scored"}</p>
                </div>
              </div>
              {listingEligibilityWarning ? (
                <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {listingEligibilityWarning}
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleFinalize()}
                  disabled={saving}
                  className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Finalising..." : "Generate signed PDF"}
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  disabled={!draft.signedPdfStoragePath}
                  className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Print PDF
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!draft.signedPdfStoragePath}
                  className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => void handleResendEmail()}
                  disabled={!draft.signedPdfStoragePath || saving}
                  className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Email PDF to customer
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep((current) => Math.max(0, current - 1))}
              disabled={currentStep === 0}
              className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void persistDraft(draft, "Draft saved.").catch(() => undefined);
                }}
                disabled={saving}
                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => void handleNextStep()}
                disabled={currentStep === WAREHOUSE_INTAKE_STEPS.length - 1}
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-black/10 transition hover:bg-shell disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">Workflow summary</p>
            <p className="mt-2 text-sm leading-6 text-ink/58">
              This workflow keeps the private storage contract separate from the buyer-facing CarNest Condition Summary while reusing the same captured condition evidence.
            </p>
            <div className="mt-4 space-y-3 text-sm text-ink/68">
              <p><span className="font-semibold text-ink">Customer profile:</span> {draft.ownerDetails.fullName || draft.ownerDetails.email || "Pending onboarding"}</p>
              <p className="text-xs text-ink/50">{draft.customerProfileId || "Profile ID will be assigned after save"}</p>
              <p><span className="font-semibold text-ink">Vehicle record:</span> {[draft.vehicleDetails.year, draft.vehicleDetails.make, draft.vehicleDetails.model].filter(Boolean).join(" ") || "Pending vehicle details"}</p>
              <p className="text-xs text-ink/50">{draft.vehicleRecordId || "Vehicle record ID will be assigned after save"}</p>
              <p><span className="font-semibold text-ink">Intake event:</span> {recordId || "Pending creation"}</p>
              <p><span className="font-semibold text-ink">Reference:</span> {draft.vehicleReference || recordId || "Pending"}</p>
              <p><span className="font-semibold text-ink">Public listing:</span> {draft.vehicleTitle || "Not linked yet"}</p>
              <p><span className="font-semibold text-ink">Documentation:</span> {draft.photos.length ? "In progress" : "Pending / to be supplied later"}</p>
              <p><span className="font-semibold text-ink">Service fees:</span> {draft.serviceItems.length ? `${draft.serviceItems.length} item${draft.serviceItems.length === 1 ? "" : "s"} · $${serviceFeeTotals.gstInclusiveTotal.toFixed(2)} incl GST` : "None yet"}</p>
              <p><span className="font-semibold text-ink">Ownership proof:</span> {draft.vehicleDetails.ownershipProof ? "Uploaded" : "Pending / to be supplied later"}</p>
              <p><span className="font-semibold text-ink">Exterior &amp; Body:</span> {categoryScores.exteriorBody.score || "Pending"}</p>
              <p><span className="font-semibold text-ink">Interior Condition:</span> {categoryScores.interiorCondition.score || "Pending"}</p>
              <p><span className="font-semibold text-ink">Documentation &amp; Records notes:</span> {categoryScores.documentationRecords.notes.trim() ? "Added" : "None"}</p>
              <p><span className="font-semibold text-ink">Mechanical &amp; Function notes:</span> {categoryScores.mechanicalFunction.notes.trim() ? "Added" : "None"}</p>
              <p><span className="font-semibold text-ink">RWC cooperation:</span> {draft.vehicleReport.rwcCooperation ? draft.vehicleReport.rwcCooperation.replace(/_/g, " ") : "Pending"}</p>
              <p><span className="font-semibold text-ink">Finance declaration:</span> {draft.declarations.financeOwing}</p>
              <p><span className="font-semibold text-ink">PDF:</span> {draft.signedPdfStoragePath ? "Available" : "Pending"}</p>
              <p><span className="font-semibold text-ink">Condition Summary:</span> {conditionOverviewReady ? "Available" : "Pending"}</p>
              <p><span className="font-semibold text-ink">Admin staff:</span> {draft.signature.adminStaffName || draft.adminStaffName || appUser?.displayName || "Pending"}</p>
            </div>
            {draft.vehicleId ? (
              <Link href={`/admin/vehicles/${draft.vehicleId}`} className="mt-4 inline-flex text-sm font-medium text-ink/65 transition hover:text-bronze">
                Open linked listing →
              </Link>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
