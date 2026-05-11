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
  WAREHOUSE_CONTACT_METHOD_OPTIONS,
  WAREHOUSE_DECLARATION_OPTIONS,
  WAREHOUSE_IDENTIFICATION_OPTIONS,
  WAREHOUSE_INTAKE_STEPS,
  WAREHOUSE_PHOTO_SECTIONS
} from "@/lib/warehouse-intake-config";
import { formatAdminDateTime, getVehicleDisplayReference } from "@/lib/utils";
import {
  fetchAdminWarehouseIntakeFileBlob,
  fetchAdminWarehouseIntakeFileBytes,
  uploadWarehouseIntakePdf,
  uploadWarehouseIntakePhotos,
  uploadWarehouseIntakeSignature,
  uploadWarehouseIntakeSupportingFile
} from "@/lib/storage";
import { generateWarehouseIntakePdf } from "@/lib/warehouse-intake-pdf";
import { hasAdminPermission } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { SignaturePad, SignaturePadHandle } from "@/components/admin/signature-pad";
import {
  CustomerProfile,
  Vehicle,
  VehicleActor,
  VehicleRecord,
  WarehouseConditionItem,
  WarehouseIntakeOwnerDetails,
  WarehouseIntakePhotoRecord,
  WarehouseIntakeRecord,
  WarehouseServiceFeeItem
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
        askingPrice: "",
        reservePrice: "",
        serviceHistory: "",
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
      askingPrice: record.askingPrice,
      reservePrice: record.reservePrice,
      serviceHistory: record.serviceHistory,
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
      askingPrice: vehicle.price ? String(vehicle.price) : draft.vehicleDetails.askingPrice,
      serviceHistory: vehicle.serviceHistory || draft.vehicleDetails.serviceHistory,
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

  const customerVehicleRecords = useMemo(
    () => vehicleRecords.filter((record) => !draft.customerProfileId || record.customerProfileId === draft.customerProfileId),
    [draft.customerProfileId, vehicleRecords]
  );
  const canViewSensitiveCustomerFields = hasAdminPermission(appUser, "manageUsers");
  const selectedVehicleRecord = useMemo(
    () => customerVehicleRecords.find((record) => record.id === draft.vehicleRecordId) || null,
    [customerVehicleRecords, draft.vehicleRecordId]
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

  function addServiceItem() {
    setDraft((current) => ({
      ...current,
      serviceItems: current.serviceItems.concat(createEmptyWarehouseServiceFeeItem())
    }));
  }

  function updateServiceItem(id: string, updates: Partial<WarehouseServiceFeeItem>) {
    setDraft((current) => ({
      ...current,
      serviceItems: current.serviceItems.map((item) => (item.id === id ? { ...item, ...updates } : item))
    }));
  }

  function removeServiceItem(id: string) {
    setDraft((current) => ({
      ...current,
      serviceItems: current.serviceItems.filter((item) => item.id !== id)
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
        resolveStorageBytes: async (storagePath) => await fetchAdminWarehouseIntakeFileBytes(storagePath, idToken)
      });
      const pdfFileName = `${(signedDraft.vehicleReference || recordId).replace(/\s+/g, "-").toLowerCase()}-warehouse-intake.pdf`;
      const signedPdfStoragePath = await uploadWarehouseIntakePdf(pdfBytes, recordId, pdfFileName);

      const saved = await persistDraft(
        {
          ...signedDraft,
          signedPdfStoragePath,
          signedPdfFileName: pdfFileName,
          pdfGeneratedAt: signedAt
        },
        "Signed intake saved."
      );

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
        <p className="text-sm text-ink/60">You need vehicle-management permission to use the warehouse intake workspace.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm text-ink/60">Preparing the warehouse intake workflow...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">CarNest warehouse intake</p>
          <h2 className="mt-2 font-display text-3xl text-ink">{draft.vehicleTitle || "Standalone intake record"}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
            Complete reusable customer onboarding, private vehicle record setup, intake-event documentation, digital agreement, signature, PDF, print, and customer email workflow from one iPad-friendly workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={draft.status === "signed" ? "Signed agreement" : draft.status === "review_ready" ? "Ready for signature" : "Draft in progress"} tone={draft.status === "signed" ? "success" : "warning"} />
          {draft.signedPdfStoragePath ? <StatusPill label="PDF available" tone="success" /> : <StatusPill label="PDF pending" />}
          {draft.signature.signedAt && draft.signature.signatureStoragePath ? <StatusPill label="Signature captured" tone="success" /> : <StatusPill label="Signature pending" tone="warning" />}
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
              <h3 className="text-xl font-semibold text-ink">1. Customer profile</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                Select an existing customer profile for a returning warehouse-managed customer, or continue with a new reusable customer profile.
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
              <h3 className="text-xl font-semibold text-ink">2. Vehicle record</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                Select an existing private vehicle record for this customer, or capture a new private vehicle record that can later be linked to an optional public listing.
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
                  ["registrationPlate", "Registration plate"],
                  ["vin", "VIN"],
                  ["colour", "Colour"],
                  ["odometer", "Odometer"],
                  ["registrationExpiry", "Registration expiry"],
                  ["numberOfKeys", "Number of keys"],
                  ["fuelType", "Fuel type"],
                  ["transmission", "Transmission"],
                  ["askingPrice", "Asking price"],
                  ["reservePrice", "Reserve price"],
                  ["serviceHistory", "Service history"],
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
                  <FieldLabel>Ownership proof upload</FieldLabel>
                  <TextInput type="file" accept="image/*,.pdf" onChange={(event) => void handleOwnershipProofUpload(event.target.files?.[0])} />
                  <FieldNote>{draft.vehicleDetails.ownershipProof?.name || "Pending / to be supplied later. Preferably registration paper or ownership proof."}</FieldNote>
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
              <h3 className="text-xl font-semibold text-ink">3. Intake documentation</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                Capture evidence only. Do not rate the vehicle subjectively. Document defects, wheel rash, interior marks, odometer, VIN, and the general stored state through notes and photos.
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/56">
                If some documentation is not available yet, save the draft and continue. Missing photos can remain pending until the vehicle or owner is ready.
              </p>
              <div className="mt-5 rounded-[24px] border border-black/5 bg-shell p-4">
                <div className="space-y-2">
                  <FieldLabel>Visible defects / condition comments</FieldLabel>
                  <TextAreaInput
                    className="min-h-[112px]"
                    placeholder="Record scratches, dents, wheel rash, interior marks, transport notes, or any condition comments that staff should reference with the photo evidence."
                    value={draft.conditionReport.exterior.visibleDefects.notes}
                    onChange={(event) => updateConditionItem("exterior", "visibleDefects", { notes: event.target.value, documented: Boolean(event.target.value.trim()) })}
                  />
                  <FieldNote>Use uploaded photos as the primary condition record. Add notes only where extra context helps staff or the owner later.</FieldNote>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {WAREHOUSE_PHOTO_SECTIONS.map((section) => {
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
                          <WarehouseIntakeSecureImage
                            key={photo.id}
                            storagePath={photo.storagePath}
                            fileName={photo.name}
                            alt={photo.label}
                          />
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
                    <p className="mt-1 text-sm text-ink/58">Add optional operational fees for warehouse-managed vehicles. Customer-visible items will appear on the PDF.</p>
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
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <div className="space-y-2 xl:col-span-2">
                          <FieldLabel>Service name</FieldLabel>
                          <TextInput value={item.serviceName} onChange={(event) => updateServiceItem(item.id, { serviceName: event.target.value })} placeholder="e.g. Car wash" />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>Category</FieldLabel>
                          <SelectInput value={item.category} onChange={(event) => updateServiceItem(item.id, { category: event.target.value as WarehouseServiceFeeItem["category"] })}>
                            {WAREHOUSE_SERVICE_FEE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </SelectInput>
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>Amount</FieldLabel>
                          <TextInput
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={item.amount || ""}
                            onChange={(event) => updateServiceItem(item.id, { amount: Number(event.target.value || 0) })}
                          />
                        </div>
                        <label className="flex items-center gap-3 rounded-[18px] border border-black/8 bg-shell px-4 py-3 text-sm text-ink">
                          <input type="checkbox" checked={item.gstIncluded} onChange={(event) => updateServiceItem(item.id, { gstIncluded: event.target.checked })} className="h-4 w-4 rounded border-black/20 text-ink" />
                          <span>GST included</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-[18px] border border-black/8 bg-shell px-4 py-3 text-sm text-ink">
                          <input type="checkbox" checked={item.customerVisible} onChange={(event) => updateServiceItem(item.id, { customerVisible: event.target.checked })} className="h-4 w-4 rounded border-black/20 text-ink" />
                          <span>Customer visible</span>
                        </label>
                        <div className="space-y-2 md:col-span-2 xl:col-span-5">
                          <FieldLabel>Internal note</FieldLabel>
                          <TextAreaInput className="min-h-[88px]" value={item.internalNote} onChange={(event) => updateServiceItem(item.id, { internalNote: event.target.value })} placeholder="Internal workshop, storage, or coordination note" />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeServiceItem(item.id)}
                            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
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
              <h3 className="text-xl font-semibold text-ink">4. Owner declaration and agreement</h3>
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
              <h3 className="text-xl font-semibold text-ink">5. Owner declaration and signature</h3>
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
              <h3 className="text-xl font-semibold text-ink">6. Complete, print, and email</h3>
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
              </div>
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
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">Relationship tree</p>
            <p className="mt-2 text-sm leading-6 text-ink/58">
              This onboarding flow creates a private customer profile, a persistent internal vehicle record, a warehouse intake event, and optionally links a public listing.
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
              <p><span className="font-semibold text-ink">Customer-visible fees:</span> ${serviceFeeTotals.customerVisibleTotal.toFixed(2)}</p>
              <p><span className="font-semibold text-ink">GST component:</span> ${serviceFeeTotals.gstComponent.toFixed(2)}</p>
              <p><span className="font-semibold text-ink">Ownership proof:</span> {draft.vehicleDetails.ownershipProof ? "Uploaded" : "Pending / to be supplied later"}</p>
              <p><span className="font-semibold text-ink">Finance declaration:</span> {draft.declarations.financeOwing}</p>
              <p><span className="font-semibold text-ink">PDF:</span> {draft.signedPdfStoragePath ? "Available" : "Pending"}</p>
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
