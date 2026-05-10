"use client";

import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createEmptyWarehouseIntakeRecord,
  getVehiclesData,
  getWarehouseIntakeById,
  saveWarehouseIntake
} from "@/lib/data";
import {
  CARNEST_CONCIERGE_AGREEMENT_COPY,
  WAREHOUSE_CONDITION_OPTIONS,
  WAREHOUSE_CONDITION_SECTIONS,
  WAREHOUSE_DECLARATION_OPTIONS,
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
  Vehicle,
  VehicleActor,
  WarehouseConditionItem,
  WarehouseIntakeOwnerDetails,
  WarehouseIntakePhotoRecord,
  WarehouseIntakeRecord
} from "@/types";

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
  const { appUser, firebaseUser } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const selectedVehicleId = searchParams.get("vehicleId") || "";
  const signatureRef = useRef<SignaturePadHandle | null>(null);
  const bootstrappedRef = useRef(false);

  const [recordId, setRecordId] = useState(intakeId || "");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [draft, setDraft] = useState<Omit<WarehouseIntakeRecord, "id">>(createEmptyWarehouseIntakeRecord());
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState("");
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === draft.vehicleId) || null,
    [vehicles, draft.vehicleId]
  );

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
      const vehiclesResult = await getVehiclesData();
      if (cancelled) return;
      setVehicles(vehiclesResult.items);

      if (intakeId) {
        const existing = await getWarehouseIntakeById(intakeId);
        if (cancelled) return;
        if (existing) {
          setRecordId(existing.id);
          setDraft(toDraft(existing));
        }
        setLoading(false);
        return;
      }

      if (bootstrappedRef.current || !actor || !hasAdminPermission(appUser, "manageVehicles")) {
        setLoading(false);
        return;
      }

      bootstrappedRef.current = true;
      const seedVehicle = vehiclesResult.items.find((vehicle) => vehicle.id === selectedVehicleId) || null;
      const seededDraft = mergeVehicleIntoDraft(createEmptyWarehouseIntakeRecord(seedVehicle), seedVehicle);

      try {
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
  }, [actor, appUser, intakeId, router, selectedVehicleId]);

  async function persistDraft(nextDraft = draft, successMessage?: string) {
    if (!actor) {
      throw new Error("Admin session unavailable.");
    }

    setSaving(true);
    setErrorMessage("");
    const result = await saveWarehouseIntake(
      {
        ...nextDraft,
        adminStaffName: nextDraft.adminStaffName || actor.displayName || actor.name || actor.email || "CarNest Admin"
      },
      actor,
      recordId || undefined
    );

    setRecordId(result.intake.id);
    setDraft(toDraft(result.intake));
    if (successMessage) {
      setNotice(successMessage);
    }
    setSaving(false);
    return result.intake;
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

  function handleVehicleSelection(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId) || null;
    setDraft((current) => mergeVehicleIntoDraft(current, vehicle));
  }

  async function handleOwnerFileUpload(bucket: "licence" | "ownership", file?: File | null) {
    if (!file || !recordId) return;
    try {
      setUploadingLabel(bucket === "licence" ? "Uploading licence document..." : "Uploading ownership proof...");
      const uploaded = await uploadWarehouseIntakeSupportingFile(file, recordId, bucket);
      const nextDraft = {
        ...draft,
        ownerDetails: {
          ...draft.ownerDetails,
          [bucket === "licence" ? "licencePhoto" : "ownershipVerification"]: uploaded
        }
      };
      setDraft(nextDraft);
      await persistDraft(nextDraft, "Supporting document uploaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't upload that file.");
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
    if (!draft.ownerDetails.fullName.trim()) issues.push("Owner full name is required.");
    if (!draft.ownerDetails.email.trim()) issues.push("Owner email is required.");
    if (!draft.ownerDetails.phone.trim()) issues.push("Owner phone is required.");
    if (!draft.ownerDetails.address.trim()) issues.push("Owner address is required.");
    if (!draft.ownerDetails.isLegalOwnerConfirmed) issues.push("Legal ownership confirmation is required.");
    if (!draft.declarations.isInformationAccurate) issues.push("Declaration confirmation is required.");
    if (!draft.agreement.informationAccurateConfirmed || !draft.agreement.storageAssistanceAuthorized || !draft.agreement.electronicSigningConsented) {
      issues.push("All agreement checkboxes must be confirmed before signing.");
    }
    if (!draft.signature.signerName.trim()) issues.push("Signer name is required before capturing the signature.");
    if (!draft.photos.length) issues.push("Upload at least one condition photo before finalising.");
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
    if (signatureRef.current?.isEmpty()) {
      issues.push("Customer signature is required before finalising.");
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

      const signedAt = new Date().toISOString();
      const signatureStoragePath = await uploadWarehouseIntakeSignature(signatureRef.current?.toDataUrl() || "", recordId);
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
            Complete the owner verification, condition report, digital agreement, signature, PDF, print, and customer email workflow from one iPad-friendly workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={draft.status === "signed" ? "Signed agreement" : draft.status === "review_ready" ? "Ready for signature" : "Draft in progress"} tone={draft.status === "signed" ? "success" : "warning"} />
          {draft.signedPdfStoragePath ? <StatusPill label="PDF available" tone="success" /> : <StatusPill label="PDF pending" />}
          {draft.signature.signedAt ? <StatusPill label="Signature captured" tone="success" /> : <StatusPill label="Signature pending" tone="warning" />}
        </div>
      </div>

      {notice ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}
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
              <h3 className="text-xl font-semibold text-ink">1. Select existing listing or continue standalone</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                Link this intake to an existing CarNest listing now, or continue as a standalone record and attach it later.
              </p>
              <div className="mt-5 space-y-2">
                <FieldLabel>Linked listing</FieldLabel>
                <SelectInput
                  value={draft.vehicleId || ""}
                  onChange={(event) => handleVehicleSelection(event.target.value)}
                >
                  <option value="">Standalone intake (attach later)</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {getVehicleDisplayReference(vehicle)} · {vehicle.year} {vehicle.make} {vehicle.model}
                    </option>
                  ))}
                </SelectInput>
              </div>
              {activeVehicle ? (
                <div className="mt-5 rounded-[24px] border border-black/5 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">{getVehicleDisplayReference(activeVehicle)}</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{activeVehicle.year} {activeVehicle.make} {activeVehicle.model}</p>
                  <p className="mt-1 text-sm text-ink/58">{activeVehicle.variant || "Vehicle variant not provided"}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">2. Owner details</h3>
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
                  <FieldLabel>Driver licence number</FieldLabel>
                  <TextInput value={draft.ownerDetails.driverLicenceNumber} onChange={(event) => updateOwnerField("driverLicenceNumber", event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Address</FieldLabel>
                  <TextAreaInput value={draft.ownerDetails.address} onChange={(event) => updateOwnerField("address", event.target.value)} className="min-h-[96px]" />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Licence photo upload</FieldLabel>
                  <TextInput type="file" accept="image/*,.pdf" onChange={(event) => void handleOwnerFileUpload("licence", event.target.files?.[0])} />
                  <FieldNote>{draft.ownerDetails.licencePhoto?.name || "Optional. Useful for warehouse intake verification."}</FieldNote>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Ownership verification upload</FieldLabel>
                  <TextInput type="file" accept="image/*,.pdf" onChange={(event) => void handleOwnerFileUpload("ownership", event.target.files?.[0])} />
                  <FieldNote>{draft.ownerDetails.ownershipVerification?.name || "Optional. Upload registration or other proof if supplied."}</FieldNote>
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

          {currentStep === 2 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">3. Vehicle details</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  ["make", "Make"],
                  ["model", "Model"],
                  ["year", "Year"],
                  ["registrationPlate", "Registration plate"],
                  ["vin", "VIN"],
                  ["colour", "Colour"],
                  ["odometer", "Odometer"],
                  ["registrationExpiry", "Registration expiry"],
                  ["numberOfKeys", "Number of keys"],
                  ["serviceHistory", "Service history"],
                  ["accidentHistory", "Accident history"]
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <FieldLabel>{label}</FieldLabel>
                    <TextInput
                      value={draft.vehicleDetails[key as keyof typeof draft.vehicleDetails]}
                      onChange={(event) => updateVehicleField(key as keyof typeof draft.vehicleDetails, event.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <TextAreaInput value={draft.vehicleDetails.notes} onChange={(event) => updateVehicleField("notes", event.target.value)} />
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">4. Vehicle history declarations</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  ["writtenOffHistory", "Written off history"],
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
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
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
              <label className="mt-5 flex items-start gap-3 rounded-[20px] border border-black/6 bg-shell px-4 py-4 text-sm text-ink/72">
                <input
                  type="checkbox"
                  checked={draft.declarations.isInformationAccurate}
                  onChange={(event) => updateDeclarationField("isInformationAccurate", event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-black/20 text-ink"
                />
                <span>I declare that all information provided is true and correct to the best of my knowledge.</span>
              </label>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">5. Condition report</h3>
              <div className="mt-5 space-y-6">
                {(Object.entries(WAREHOUSE_CONDITION_SECTIONS) as unknown as Array<[keyof typeof WAREHOUSE_CONDITION_SECTIONS, ReadonlyArray<{ key: string; label: string }>]>).map(
                  ([sectionKey, items]) => (
                    <div key={sectionKey} className="rounded-[24px] border border-black/5 bg-shell p-4">
                      <h4 className="text-lg font-semibold capitalize text-ink">{sectionKey}</h4>
                      <div className="mt-4 space-y-4">
                        {items.map((item) => (
                          <div key={item.key} className="grid gap-3 md:grid-cols-[14rem,1fr,1.2fr] md:items-start">
                            <div>
                              <FieldLabel>{item.label}</FieldLabel>
                            </div>
                            <SelectInput
                              value={draft.conditionReport[sectionKey][item.key].condition}
                              onChange={(event) => updateConditionItem(sectionKey, item.key, { condition: event.target.value as WarehouseConditionItem["condition"] })}
                            >
                              {WAREHOUSE_CONDITION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </SelectInput>
                            <TextInput
                              placeholder="Optional admin notes"
                              value={draft.conditionReport[sectionKey][item.key].notes}
                              onChange={(event) => updateConditionItem(sectionKey, item.key, { notes: event.target.value })}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          {currentStep === 5 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">6. Capture condition photos</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                Use the iPad camera or upload from the photo library. Images are compressed automatically before saving to Firebase Storage.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
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
            </div>
          ) : null}

          {currentStep === 6 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">7. Review agreement</h3>
              <div className="mt-5 rounded-[24px] border border-black/5 bg-shell p-5">
                <p className="text-sm leading-7 text-ink/72">
                  Owner: <strong className="text-ink">{draft.ownerDetails.fullName || "Pending"}</strong>
                  <br />
                  Vehicle: <strong className="text-ink">{draft.vehicleTitle || "Standalone intake"}</strong>
                  <br />
                  Date: <strong className="text-ink">{new Date().toLocaleDateString("en-AU")}</strong>
                </p>
                <div className="mt-5 space-y-3">
                  {CARNEST_CONCIERGE_AGREEMENT_COPY.map((line) => (
                    <p key={line} className="text-sm leading-7 text-ink/72">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.informationAccurateConfirmed} onChange={(event) => updateAgreementField("informationAccurateConfirmed", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I confirm the information provided is accurate.</span>
                </label>
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.storageAssistanceAuthorized} onChange={(event) => updateAgreementField("storageAssistanceAuthorized", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I authorise CarNest to provide storage and operational assistance.</span>
                </label>
                <label className="flex items-start gap-3 rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-ink/72">
                  <input type="checkbox" checked={draft.agreement.electronicSigningConsented} onChange={(event) => updateAgreementField("electronicSigningConsented", event.target.checked)} className="mt-1 h-4 w-4 rounded border-black/20 text-ink" />
                  <span>I agree to receive and sign this agreement electronically.</span>
                </label>
              </div>
            </div>
          ) : null}

          {currentStep === 7 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">8. Digital signature</h3>
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
                  onClick={() => signatureRef.current?.clear()}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                >
                  Clear signature
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === 8 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">9. Complete, print, and email</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[22px] border border-black/6 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">Condition report</p>
                  <p className="mt-2 text-sm text-ink/72">{draft.photos.length} photos uploaded</p>
                </div>
                <div className="rounded-[22px] border border-black/6 bg-shell p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-bronze">Agreement</p>
                  <p className="mt-2 text-sm text-ink/72">{draft.signature.signedAt ? `Signed ${formatAdminDateTime(draft.signature.signedAt)}` : "Awaiting signature"}</p>
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
                onClick={() => void persistDraft(draft, "Draft saved.")}
                disabled={saving}
                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep((current) => Math.min(WAREHOUSE_INTAKE_STEPS.length - 1, current + 1))}
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
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">Listing integration</p>
            <div className="mt-4 space-y-3 text-sm text-ink/68">
              <p><span className="font-semibold text-ink">Reference:</span> {draft.vehicleReference || recordId || "Pending"}</p>
              <p><span className="font-semibold text-ink">Listing:</span> {draft.vehicleTitle || "Standalone record"}</p>
              <p><span className="font-semibold text-ink">Condition report:</span> {draft.photos.length ? "In progress" : "Pending"}</p>
              <p><span className="font-semibold text-ink">Ownership verification:</span> {draft.ownerDetails.ownershipVerification ? "Uploaded" : "Pending"}</p>
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
