"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { SignaturePad, SignaturePadHandle } from "@/components/admin/signature-pad";
import { AdminShell } from "@/components/layout/admin-shell";
import { useAuth } from "@/lib/auth";
import {
  createSaleHandoverRecordForListing,
  getSaleHandoverRecordsByListingId,
  getWarehouseRelationshipTreeByVehicleId,
  markSaleHandoverPdfGenerated,
  markSaleHandoverReadyForSignature,
  saveSaleHandoverRecord,
  signSaleHandoverRecord,
} from "@/lib/data";
import {
  SALE_HANDOVER_AGREEMENT_TERMS,
  SALE_HANDOVER_PREPARATION_LABELS,
  buildSaleHandoverPdfFileName,
  calculateSaleHandoverBalance,
  calculateSaleHandoverDocumentHash,
  canSaleHandoverBeSigned,
  getSaleHandoverActionLabel,
  getSaleHandoverBuyerDisplayName,
  getSaleHandoverMissingRequiredFields,
  getSaleHandoverStatusLabel,
  importSaleHandoverSnapshots,
  maskSensitiveIdentifier,
} from "@/lib/sale-handover";
import { generateSaleHandoverPdf } from "@/lib/sale-handover-pdf";
import { hasAdminPermission } from "@/lib/permissions";
import {
  fetchAdminSaleHandoverFileBlob,
  fetchAdminSaleHandoverFileBytes,
  uploadSaleHandoverPdf,
  uploadSaleHandoverSignature,
} from "@/lib/storage";
import { formatAdminDateTime, formatCurrency } from "@/lib/utils";
import {
  AppUser,
  SaleHandoverBuyerSnapshot,
  SaleHandoverRecord,
  SaleHandoverRegistrationStatus,
  SaleHandoverSellerSnapshot,
  SaleHandoverSignatureRole,
  SaleHandoverTransactionDetails,
  SaleHandoverVehicleSnapshot,
  VehicleActor,
} from "@/types";

const STEPS = [
  "Buyer details",
  "Seller details",
  "Vehicle details",
  "Transaction",
  "Review",
  "Signatures",
  "Final PDF",
] as const;

function createActorFromUser(user: AppUser | null): VehicleActor | null {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
    name: user.name,
    adminPermissions: user.adminPermissions,
  };
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-ink/50">{hint}</span> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-bronze ${props.className ?? ""}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze ${props.className ?? ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-bronze ${props.className ?? ""}`}
    />
  );
}

function BooleanField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-black/6 bg-shell px-4 py-3 text-sm text-ink/75">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-black/20 text-bronze"
      />
      <span>{children}</span>
    </label>
  );
}

function Card({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-bronze">{eyebrow}</p> : null}
      <h2 className="mt-1 font-display text-3xl text-ink">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function statusPillClass(status: SaleHandoverRecord["status"]) {
  if (status === "signed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partially_signed" || status === "ready_for_signature") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "superseded") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-black/10 bg-shell text-ink/65";
}

function buildAddressLine(value: { address: string; suburb: string; state: string; postcode: string }) {
  return [value.address, value.suburb, value.state, value.postcode].filter(Boolean).join(", ");
}

function summarizeImportedChanges(current: SaleHandoverRecord, imported: Omit<SaleHandoverRecord, "id">) {
  const fields: Array<[string, string, string]> = [
    ["Seller legal name", current.seller.legalName, imported.seller.legalName],
    ["Seller phone", current.seller.phone, imported.seller.phone],
    ["Seller email", current.seller.email, imported.seller.email],
    ["Seller address", current.seller.address, imported.seller.address],
    ["Vehicle year", current.vehicle.year, imported.vehicle.year],
    ["Vehicle make", current.vehicle.make, imported.vehicle.make],
    ["Vehicle model", current.vehicle.model, imported.vehicle.model],
    ["Vehicle registration", current.vehicle.registrationNumber, imported.vehicle.registrationNumber],
    ["Vehicle VIN/chassis", current.vehicle.vinOrChassis, imported.vehicle.vinOrChassis],
    ["Vehicle odometer", current.vehicle.odometerAtAgreement, imported.vehicle.odometerAtAgreement],
  ];
  return fields.filter(([, before, after]) => after.trim() && before.trim() !== after.trim());
}

export function SaleHandoverWorkspace({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const sellerSignatureRef = useRef<SignaturePadHandle | null>(null);
  const buyerSignatureRef = useRef<SignaturePadHandle | null>(null);
  const bootstrappedRef = useRef(false);

  const [record, setRecord] = useState<SaleHandoverRecord | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sellerSignerName, setSellerSignerName] = useState("");
  const [buyerSignerName, setBuyerSignerName] = useState("");

  const missingFields = useMemo(() => (record ? getSaleHandoverMissingRequiredFields(record) : []), [record]);
  const readyForSignature = record ? canSaleHandoverBeSigned(record) : false;
  const signatureCollectionOpen = record?.status === "ready_for_signature" || record?.status === "partially_signed";
  const buyerDisplayName = record ? getSaleHandoverBuyerDisplayName(record.buyer) : "Buyer";
  const canManage = hasAdminPermission(appUser, "manageVehicles");

  useEffect(() => {
    if (authLoading || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    async function loadOrCreate() {
      if (!actor || !canManage) {
        setErrorMessage("You do not have access to manage sale and handover records.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");
        const existing = await getSaleHandoverRecordsByListingId(listingId);
        if (existing.items[0]) {
          setRecord(existing.items[0]);
          return;
        }
        const result = await createSaleHandoverRecordForListing(listingId, actor);
        setRecord(result.record);
        if (!result.record.storageContractId) {
          setNotice("Draft created. No linked Storage Contract was found, so seller and vehicle details must be verified manually.");
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "We couldn't load the sale and handover record.");
      } finally {
        setLoading(false);
      }
    }

    void loadOrCreate();
  }, [actor, authLoading, canManage, listingId]);

  function updateRecord(updater: (current: SaleHandoverRecord) => SaleHandoverRecord) {
    setRecord((current) => (current ? updater(current) : current));
  }

  function updateBuyer<K extends keyof SaleHandoverBuyerSnapshot>(key: K, value: SaleHandoverBuyerSnapshot[K]) {
    updateRecord((current) => ({
      ...current,
      buyer: {
        ...current.buyer,
        [key]: value,
      },
      buyerCustomerId: key === "buyerCustomerId" ? String(value ?? "") : current.buyerCustomerId,
    }));
  }

  function updateSeller<K extends keyof SaleHandoverSellerSnapshot>(key: K, value: SaleHandoverSellerSnapshot[K]) {
    updateRecord((current) => ({
      ...current,
      seller: {
        ...current.seller,
        [key]: value,
      },
      sellerCustomerId: key === "customerId" ? String(value ?? "") : current.sellerCustomerId,
    }));
  }

  function updateVehicle<K extends keyof SaleHandoverVehicleSnapshot>(key: K, value: SaleHandoverVehicleSnapshot[K]) {
    updateRecord((current) => ({
      ...current,
      vehicle: {
        ...current.vehicle,
        [key]: value,
      },
      vehicleRecordId: key === "vehicleRecordId" ? String(value ?? "") : current.vehicleRecordId,
    }));
  }

  function updateTransaction<K extends keyof SaleHandoverTransactionDetails>(key: K, value: SaleHandoverTransactionDetails[K]) {
    updateRecord((current) => {
      const transaction = {
        ...current.transaction,
        [key]: value,
      };
      return {
        ...current,
        transaction: {
          ...transaction,
          balance: calculateSaleHandoverBalance(transaction),
        },
      };
    });
  }

  async function handleSave() {
    if (!record || !actor) return;

    try {
      setSaving(true);
      setErrorMessage("");
      const result = await saveSaleHandoverRecord(record, actor);
      setRecord(result.record);
      setNotice(result.record.documentVersion > record.documentVersion
        ? "Saved as a new unsigned version because a material signed field changed."
        : "Sale and handover record saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't save the sale and handover record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshFromStorageContract() {
    if (!record || !actor) return;
    if (record.status !== "draft") {
      setErrorMessage("Storage Contract details can only be refreshed while this record is Draft.");
      return;
    }

    try {
      const relationship = await getWarehouseRelationshipTreeByVehicleId(record.listingId);
      const storageContract = relationship.intakeRecords[0] ?? null;
      if (!relationship.listing || !storageContract) {
        setErrorMessage("No linked Storage Contract was found for this listing.");
        return;
      }
      const imported = importSaleHandoverSnapshots({
        recordId: record.id,
        listing: relationship.listing,
        storageContract,
        vehicleRecord: relationship.vehicleRecord,
        actor,
        now: new Date().toISOString(),
      });
      const changes = summarizeImportedChanges(record, imported);
      if (!changes.length) {
        setNotice("No newer Storage Contract details were found to refresh.");
        return;
      }
      const confirmed = window.confirm(
        `Refresh unsigned details from the linked Storage Contract?\n\nFields that may change:\n${changes.map(([label, before, after]) => `${label}: ${before || "blank"} → ${after}`).join("\n")}`
      );
      if (!confirmed) return;

      const nextRecord: SaleHandoverRecord = {
        ...record,
        seller: imported.seller,
        sellerCustomerId: imported.sellerCustomerId,
        vehicle: imported.vehicle,
        vehicleRecordId: imported.vehicleRecordId,
        storageContractId: imported.storageContractId,
        sourceSnapshot: imported.sourceSnapshot,
      };
      setRecord(nextRecord);
      const result = await saveSaleHandoverRecord(nextRecord, actor);
      setRecord(result.record);
      setNotice("Unsigned details refreshed from the linked Storage Contract.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't refresh details from the Storage Contract.");
    }
  }

  async function handleReadyForSignature() {
    if (!record || !actor) return;
    try {
      setSaving(true);
      setErrorMessage("");
      const saved = await saveSaleHandoverRecord(record, actor);
      const result = await markSaleHandoverReadyForSignature(saved.record.id, actor);
      setRecord(result.record);
      setStepIndex(5);
      setNotice("Record is ready for seller and buyer signatures.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't mark this record ready for signature.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSign(role: SaleHandoverSignatureRole) {
    if (!record || !actor || !firebaseUser) return;
    const ref = role === "seller" ? sellerSignatureRef.current : buyerSignatureRef.current;
    const signerName = role === "seller" ? sellerSignerName : buyerSignerName;
    if (!ref || ref.isEmpty()) {
      setErrorMessage(`Capture the ${role} signature before saving.`);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      const storagePath = await uploadSaleHandoverSignature(ref.toDataUrl(), record.id, role);
      const result = await signSaleHandoverRecord(record.id, role, signerName, storagePath, actor);
      setRecord(result.record);
      setNotice(`${role === "seller" ? "Seller" : "Buyer"} signature recorded.`);
      if (role === "seller") {
        sellerSignatureRef.current?.clear();
      } else {
        buyerSignatureRef.current?.clear();
      }
      await firebaseUser.getIdToken(true).catch(() => undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `We couldn't save the ${role} signature.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePdf() {
    if (!record || !actor || !firebaseUser) return;

    try {
      setSaving(true);
      setErrorMessage("");
      const idToken = await firebaseUser.getIdToken();
      const saved = await saveSaleHandoverRecord(record, actor);
      const documentHash = await calculateSaleHandoverDocumentHash(saved.record);
      const pdfBytes = await generateSaleHandoverPdf(saved.record, {
        documentHash,
        resolveStorageBytes: (storagePath) => fetchAdminSaleHandoverFileBytes(storagePath, idToken),
      });
      const fileName = buildSaleHandoverPdfFileName(saved.record);
      const storagePath = await uploadSaleHandoverPdf(pdfBytes, saved.record.id, fileName);
      const pdf = {
        storagePath,
        fileName,
        generatedAt: new Date().toISOString(),
        generatedByUid: actor.id,
        generatedByName: actor.displayName || actor.name || actor.email || "CarNest Admin",
        documentVersion: saved.record.documentVersion,
        agreementTermsVersion: saved.record.agreementTermsVersion,
        documentHash,
        status: saved.record.sellerSignature?.signatureStoragePath && saved.record.buyerSignature?.signatureStoragePath ? "signed" as const : "draft" as const,
      };
      const result = await markSaleHandoverPdfGenerated(saved.record.id, pdf, actor);
      setRecord(result.record);
      setStepIndex(6);
      setNotice("PDF generated. Historical signed PDFs are preserved in record history.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't generate the sale and handover PDF.");
    } finally {
      setSaving(false);
    }
  }

  async function handleViewPdf(download = false) {
    if (!record?.pdf?.storagePath || !firebaseUser) {
      setErrorMessage("No PDF has been generated for this record yet.");
      return;
    }

    try {
      const idToken = await firebaseUser.getIdToken();
      const blob = await fetchAdminSaleHandoverFileBlob(record.pdf.storagePath, idToken, {
        download,
        name: record.pdf.fileName,
      });
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "This protected sale and handover file could not be opened with your current access.");
    }
  }

  function renderBuyerDetails() {
    if (!record) return null;
    return (
      <Card title="Buyer details" eyebrow="Step 1">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Buyer type">
            <Select value={record.buyer.buyerType} onChange={(event) => updateBuyer("buyerType", event.target.value as SaleHandoverBuyerSnapshot["buyerType"])}>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </Select>
          </Field>
          <BooleanField checked={record.buyer.createOrLinkCustomerProfile} onChange={(checked) => updateBuyer("createOrLinkCustomerProfile", checked)}>
            Create or link a Buyer customer profile. This records the admin’s intent only and will not overwrite any Customer record silently.
          </BooleanField>
          {record.buyer.buyerType === "individual" ? (
            <>
              <Field label="Legal first name">
                <Input value={record.buyer.legalFirstName} onChange={(event) => updateBuyer("legalFirstName", event.target.value)} />
              </Field>
              <Field label="Legal family name">
                <Input value={record.buyer.legalFamilyName} onChange={(event) => updateBuyer("legalFamilyName", event.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Company legal name">
                <Input value={record.buyer.companyLegalName} onChange={(event) => updateBuyer("companyLegalName", event.target.value)} />
              </Field>
              <Field label="ACN">
                <Input value={record.buyer.acn} onChange={(event) => updateBuyer("acn", event.target.value)} />
              </Field>
              <Field label="Authorised representative name">
                <Input value={record.buyer.authorisedRepresentativeName} onChange={(event) => updateBuyer("authorisedRepresentativeName", event.target.value)} />
              </Field>
            </>
          )}
          <Field label="Phone">
            <Input type="tel" value={record.buyer.phone} onChange={(event) => updateBuyer("phone", event.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={record.buyer.email} onChange={(event) => updateBuyer("email", event.target.value)} />
          </Field>
          <Field label={record.buyer.buyerType === "company" ? "Business address" : "Residential address"}>
            <Input value={record.buyer.address} onChange={(event) => updateBuyer("address", event.target.value)} />
          </Field>
          <Field label="Suburb">
            <Input value={record.buyer.suburb} onChange={(event) => updateBuyer("suburb", event.target.value)} />
          </Field>
          <Field label="State">
            <Input value={record.buyer.state} onChange={(event) => updateBuyer("state", event.target.value)} />
          </Field>
          <Field label="Postcode">
            <Input inputMode="numeric" value={record.buyer.postcode} onChange={(event) => updateBuyer("postcode", event.target.value)} />
          </Field>
          <Field label="VicRoads customer number" hint={record.buyer.vicRoadsCustomerNumber ? `Saved display: ${maskSensitiveIdentifier(record.buyer.vicRoadsCustomerNumber)}` : "Optional. Collect only when actually required for the parties' transfer process."}>
            <Input value={record.buyer.vicRoadsCustomerNumber} onChange={(event) => updateBuyer("vicRoadsCustomerNumber", event.target.value)} />
          </Field>
          {record.buyer.buyerType === "individual" ? (
            <Field label="Driver licence number" hint={record.buyer.driverLicenceNumber ? `Saved display: ${maskSensitiveIdentifier(record.buyer.driverLicenceNumber)}` : "Optional. Do not upload a driver's licence photograph."}>
              <Input value={record.buyer.driverLicenceNumber} onChange={(event) => updateBuyer("driverLicenceNumber", event.target.value)} />
            </Field>
          ) : null}
        </div>
      </Card>
    );
  }

  function renderSellerDetails() {
    if (!record) return null;
    return (
      <Card title="Seller details" eyebrow={record.storageContractId ? "Imported from linked Storage Contract" : "Manual verification required"}>
        {!record.storageContractId ? (
          <div className="mb-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No linked Storage Contract was found. Seller information must be entered and verified manually before this record can be signed or finalised.
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Customer ID">
            <Input value={record.seller.customerId || ""} onChange={(event) => updateSeller("customerId", event.target.value)} />
          </Field>
          <Field label="Legal name">
            <Input value={record.seller.legalName} onChange={(event) => updateSeller("legalName", event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={record.seller.phone} onChange={(event) => updateSeller("phone", event.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={record.seller.email} onChange={(event) => updateSeller("email", event.target.value)} />
          </Field>
          <Field label="Address">
            <Input value={record.seller.address} onChange={(event) => updateSeller("address", event.target.value)} />
          </Field>
          <Field label="Suburb">
            <Input value={record.seller.suburb} onChange={(event) => updateSeller("suburb", event.target.value)} />
          </Field>
          <Field label="State">
            <Input value={record.seller.state} onChange={(event) => updateSeller("state", event.target.value)} />
          </Field>
          <Field label="Postcode">
            <Input inputMode="numeric" value={record.seller.postcode} onChange={(event) => updateSeller("postcode", event.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <BooleanField checked={record.seller.ownershipAuthorityConfirmed} onChange={(checked) => updateSeller("ownershipAuthorityConfirmed", checked)}>
            Seller confirms legal ownership of the vehicle or written authority from the legal owner to sell it.
          </BooleanField>
        </div>
      </Card>
    );
  }

  function renderVehicleDetails() {
    if (!record) return null;
    return (
      <Card title="Vehicle details" eyebrow={record.storageContractId ? "Snapshot imported where available" : "Manual verification required"}>
        {!record.storageContractId ? (
          <div className="mb-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No linked Storage Contract was found. Vehicle details must be entered and verified manually before this record can be signed or finalised.
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Listing ID">
            <Input value={record.vehicle.listingId} onChange={(event) => updateVehicle("listingId", event.target.value)} />
          </Field>
          <Field label="Vehicle record ID">
            <Input value={record.vehicle.vehicleRecordId} onChange={(event) => updateVehicle("vehicleRecordId", event.target.value)} />
          </Field>
          <Field label="Year">
            <Input value={record.vehicle.year} onChange={(event) => updateVehicle("year", event.target.value)} />
          </Field>
          <Field label="Make">
            <Input value={record.vehicle.make} onChange={(event) => updateVehicle("make", event.target.value)} />
          </Field>
          <Field label="Model">
            <Input value={record.vehicle.model} onChange={(event) => updateVehicle("model", event.target.value)} />
          </Field>
          <Field label="Variant">
            <Input value={record.vehicle.variant} onChange={(event) => updateVehicle("variant", event.target.value)} />
          </Field>
          <Field label="Colour">
            <Input value={record.vehicle.colour} onChange={(event) => updateVehicle("colour", event.target.value)} />
          </Field>
          <Field label="Registration status">
            <Select value={record.vehicle.registrationStatus} onChange={(event) => updateVehicle("registrationStatus", event.target.value as SaleHandoverRegistrationStatus)}>
              <option value="registered">Registered</option>
              <option value="unregistered">Unregistered</option>
              <option value="unknown">Unknown</option>
            </Select>
          </Field>
          <Field label="Registration number">
            <Input value={record.vehicle.registrationNumber} onChange={(event) => updateVehicle("registrationNumber", event.target.value)} />
          </Field>
          <Field label="Registration expiry">
            <Input type="date" value={record.vehicle.registrationExpiry} onChange={(event) => updateVehicle("registrationExpiry", event.target.value)} />
          </Field>
          <Field label="VIN / chassis number">
            <Input value={record.vehicle.vinOrChassis} onChange={(event) => updateVehicle("vinOrChassis", event.target.value)} />
          </Field>
          <Field label="Engine number">
            <Input value={record.vehicle.engineNumber} onChange={(event) => updateVehicle("engineNumber", event.target.value)} />
          </Field>
          <Field label="Odometer at agreement">
            <Input value={record.vehicle.odometerAtAgreement} onChange={(event) => updateVehicle("odometerAtAgreement", event.target.value)} />
          </Field>
          <Field label="Odometer at handover">
            <Input value={record.vehicle.odometerAtHandover} onChange={(event) => updateVehicle("odometerAtHandover", event.target.value)} />
          </Field>
          <Field label="Keys supplied">
            <Input value={record.vehicle.keysSupplied} onChange={(event) => updateVehicle("keysSupplied", event.target.value)} />
          </Field>
        </div>
      </Card>
    );
  }

  function renderTransaction() {
    if (!record) return null;
    const handleMoneyChange = (key: "purchasePrice" | "deposit" | "balance") => (event: ChangeEvent<HTMLInputElement>) => {
      updateTransaction(key, Number(event.target.value || 0));
    };

    return (
      <Card title="Transaction and handover details" eyebrow="Information record only">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Purchase price">
            <Input type="number" inputMode="decimal" min="0" value={record.transaction.purchasePrice} onChange={handleMoneyChange("purchasePrice")} />
          </Field>
          <Field label="Deposit">
            <Input type="number" inputMode="decimal" min="0" value={record.transaction.deposit} onChange={handleMoneyChange("deposit")} />
          </Field>
          <Field label="Balance">
            <Input type="number" inputMode="decimal" min="0" value={record.transaction.balance} disabled={!record.transaction.balanceOverrideEnabled} onChange={handleMoneyChange("balance")} />
          </Field>
          <BooleanField checked={record.transaction.balanceOverrideEnabled} onChange={(checked) => updateTransaction("balanceOverrideEnabled", checked)}>
            Override calculated balance. The default balance is purchase price minus deposit.
          </BooleanField>
          {record.transaction.balanceOverrideEnabled ? (
            <Field label="Balance override explanation">
              <Input value={record.transaction.balanceOverrideReason} onChange={(event) => updateTransaction("balanceOverrideReason", event.target.value)} />
            </Field>
          ) : null}
          <Field label="Payment method">
            <Input value={record.transaction.paymentMethod} onChange={(event) => updateTransaction("paymentMethod", event.target.value)} />
          </Field>
          <Field label="Sale date">
            <Input type="date" value={record.transaction.saleDate} onChange={(event) => updateTransaction("saleDate", event.target.value)} />
          </Field>
          <Field label="Settlement date">
            <Input type="date" value={record.transaction.settlementDate} onChange={(event) => updateTransaction("settlementDate", event.target.value)} />
          </Field>
          <Field label="Handover date">
            <Input type="date" value={record.transaction.handoverDate} onChange={(event) => updateTransaction("handoverDate", event.target.value)} />
          </Field>
          <Field label="Exact handover time">
            <Input type="time" value={record.transaction.handoverTime} onChange={(event) => updateTransaction("handoverTime", event.target.value)} />
          </Field>
          <Field label="Handover location">
            <Input value={record.transaction.handoverLocation} onChange={(event) => updateTransaction("handoverLocation", event.target.value)} />
          </Field>
          <Field label="Documents supplied">
            <Input value={record.transaction.documentsSupplied} onChange={(event) => updateTransaction("documentsSupplied", event.target.value)} />
          </Field>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Payment arrangement">
            <Textarea value={record.transaction.paymentArrangement} onChange={(event) => updateTransaction("paymentArrangement", event.target.value)} />
          </Field>
          <Field label="Additional terms or notes">
            <Textarea value={record.transaction.additionalTerms} onChange={(event) => updateTransaction("additionalTerms", event.target.value)} />
          </Field>
        </div>

        <div className="mt-6 rounded-[22px] border border-black/6 bg-shell p-4">
          <p className="text-sm font-semibold text-ink">Vehicle Preparation</p>
          <p className="mt-1 text-xs text-ink/55">
            This checklist is an information record only. It is not a warranty or mechanical certification.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SALE_HANDOVER_PREPARATION_LABELS.map(([key, label]) => (
              <BooleanField
                key={key}
                checked={record.preparation[key] === true}
                onChange={(checked) => updateRecord((current) => ({
                  ...current,
                  preparation: {
                    ...current.preparation,
                    [key]: checked,
                  },
                }))}
              >
                {label}
              </BooleanField>
            ))}
          </div>
          {record.preparation.other ? (
            <div className="mt-4">
              <Field label="Other preparation notes">
                <Input value={record.preparation.otherNotes} onChange={(event) => updateRecord((current) => ({
                  ...current,
                  preparation: {
                    ...current.preparation,
                    otherNotes: event.target.value,
                  },
                }))} />
              </Field>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <BooleanField checked={record.confirmations.sellerInformationReviewed} onChange={(checked) => updateRecord((current) => ({ ...current, confirmations: { ...current.confirmations, sellerInformationReviewed: checked } }))}>
            Seller information reviewed.
          </BooleanField>
          <BooleanField checked={record.confirmations.buyerInformationReviewed} onChange={(checked) => updateRecord((current) => ({ ...current, confirmations: { ...current.confirmations, buyerInformationReviewed: checked } }))}>
            Buyer information reviewed.
          </BooleanField>
          <BooleanField checked={record.confirmations.vehicleInformationReviewed} onChange={(checked) => updateRecord((current) => ({ ...current, confirmations: { ...current.confirmations, vehicleInformationReviewed: checked } }))}>
            Vehicle information reviewed.
          </BooleanField>
          <BooleanField checked={record.confirmations.noVicRoadsTransferAcknowledged} onChange={(checked) => updateRecord((current) => ({ ...current, confirmations: { ...current.confirmations, noVicRoadsTransferAcknowledged: checked } }))}>
            Parties understand this record does not itself complete the VicRoads transfer.
          </BooleanField>
          <BooleanField checked={record.confirmations.termsProvided} onChange={(checked) => updateRecord((current) => ({ ...current, confirmations: { ...current.confirmations, termsProvided: checked } }))}>
            Parties received or can download the terms page.
          </BooleanField>
        </div>
      </Card>
    );
  }

  function renderReview() {
    if (!record) return null;
    return (
      <Card title="Review" eyebrow="Before signature">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[22px] border border-black/6 bg-shell p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Seller</p>
            <p className="mt-2 font-semibold">{record.seller.legalName || "Not provided"}</p>
            <p className="mt-1 text-sm text-ink/60">{buildAddressLine(record.seller) || "Address not provided"}</p>
          </div>
          <div className="rounded-[22px] border border-black/6 bg-shell p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Buyer</p>
            <p className="mt-2 font-semibold">{buyerDisplayName}</p>
            <p className="mt-1 text-sm text-ink/60">{buildAddressLine(record.buyer) || "Address not provided"}</p>
          </div>
          <div className="rounded-[22px] border border-black/6 bg-shell p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Transaction</p>
            <p className="mt-2 font-semibold">{formatCurrency(record.transaction.purchasePrice)}</p>
            <p className="mt-1 text-sm text-ink/60">Balance {formatCurrency(record.transaction.balance)}</p>
          </div>
        </div>

        <div className="mt-6 rounded-[22px] border border-black/6 bg-shell p-5">
          <p className="font-semibold text-ink">Administrative positioning</p>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            CarNest is not the buyer, seller, owner or guarantor under this agreement. This record does not itself transfer vehicle registration and does not replace VicRoads or government requirements.
          </p>
        </div>

        {missingFields.length ? (
          <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <p className="font-semibold">Complete these fields before signing:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {missingFields.map((field) => (
                <span key={field} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">{field}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">
            Required fields are complete. This record can be marked ready for signature.
          </div>
        )}

        <div className="mt-6 rounded-[22px] border border-black/6 bg-shell p-5">
          <p className="text-sm font-semibold text-ink">Agreement terms included on page 2</p>
          <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-2 text-sm leading-6 text-ink/65">
            {SALE_HANDOVER_AGREEMENT_TERMS.map((clause) => (
              <div key={clause.title}>
                <p className="font-semibold text-ink">{clause.title}</p>
                {clause.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  function renderSignatures() {
    if (!record) return null;
    return (
      <Card title="Signatures" eyebrow="Seller and buyer only">
        {!readyForSignature ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Complete the required fields in Review before signatures can be collected.
          </div>
        ) : !signatureCollectionOpen ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Required fields are complete. Click “Mark ready for signature” before collecting seller or buyer signatures.
          </div>
        ) : null}
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[24px] border border-black/6 bg-shell p-5">
            <p className="text-sm font-semibold text-ink">Seller signature</p>
            {record.sellerSignature?.signatureStoragePath ? (
              <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-emerald-700">
                Seller signature recorded by {record.sellerSignature.recordedByName || "CarNest Admin"} on {formatAdminDateTime(record.sellerSignature.signedAt)}.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <Field label="Signer name">
                  <Input value={sellerSignerName} onChange={(event) => setSellerSignerName(event.target.value)} placeholder={record.seller.legalName || "Seller legal name"} />
                </Field>
                <SignaturePad ref={sellerSignatureRef} />
                <button
                  type="button"
                  disabled={!readyForSignature || !signatureCollectionOpen || saving}
                  onClick={() => void handleSign("seller")}
                  className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-bronze disabled:cursor-not-allowed disabled:bg-ink/30"
                >
                  Save seller signature
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-black/6 bg-shell p-5">
            <p className="text-sm font-semibold text-ink">Buyer signature</p>
            {record.buyerSignature?.signatureStoragePath ? (
              <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-emerald-700">
                Buyer signature recorded by {record.buyerSignature.recordedByName || "CarNest Admin"} on {formatAdminDateTime(record.buyerSignature.signedAt)}.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <Field label="Signer name">
                  <Input value={buyerSignerName} onChange={(event) => setBuyerSignerName(event.target.value)} placeholder={buyerDisplayName === "Buyer" ? "Buyer legal name" : buyerDisplayName} />
                </Field>
                <SignaturePad ref={buyerSignatureRef} />
                <button
                  type="button"
                  disabled={!readyForSignature || !signatureCollectionOpen || saving}
                  onClick={() => void handleSign("buyer")}
                  className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-bronze disabled:cursor-not-allowed disabled:bg-ink/30"
                >
                  Save buyer signature
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-ink/55">
          CarNest is recorded only as the staff-prepared administrative record. There is no CarNest contractual signature as buyer, seller or guarantor.
        </p>
      </Card>
    );
  }

  function renderFinalPdf() {
    if (!record) return null;
    const hasPdf = Boolean(record.pdf?.storagePath);
    const signed = Boolean(record.sellerSignature?.signatureStoragePath && record.buyerSignature?.signatureStoragePath);
    return (
      <Card title="Final PDF" eyebrow={signed ? "Signed record" : "Draft PDF"}>
        <div className="rounded-[22px] border border-black/6 bg-shell p-5">
          <p className="text-sm font-semibold text-ink">{hasPdf ? "PDF available" : "No PDF has been generated for this record yet."}</p>
          {hasPdf ? (
            <div className="mt-3 space-y-1 text-sm text-ink/65">
              <p>{record.pdf?.fileName}</p>
              <p>Generated {formatAdminDateTime(record.pdf?.generatedAt)}</p>
              <p>Version {record.pdf?.documentVersion} · {record.pdf?.status === "signed" ? "Signed" : "Draft"}</p>
            </div>
          ) : null}
          {record.pdfHistory.length ? (
            <p className="mt-3 text-xs text-ink/50">
              {record.pdfHistory.length} historical PDF {record.pdfHistory.length === 1 ? "version is" : "versions are"} preserved.
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleGeneratePdf()}
            disabled={saving}
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-bronze disabled:cursor-not-allowed disabled:bg-ink/30"
          >
            Generate PDF
          </button>
          <button
            type="button"
            onClick={() => void handleViewPdf(false)}
            disabled={!hasPdf || saving}
            className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:text-ink/35"
          >
            View PDF
          </button>
          <button
            type="button"
            onClick={() => void handleViewPdf(true)}
            disabled={!hasPdf || saving}
            className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:text-ink/35"
          >
            Download PDF
          </button>
        </div>
      </Card>
    );
  }

  function renderStep() {
    switch (stepIndex) {
      case 0:
        return renderBuyerDetails();
      case 1:
        return renderSellerDetails();
      case 2:
        return renderVehicleDetails();
      case 3:
        return renderTransaction();
      case 4:
        return renderReview();
      case 5:
        return renderSignatures();
      case 6:
        return renderFinalPdf();
      default:
        return renderBuyerDetails();
    }
  }

  if (authLoading || loading) {
    return (
      <AdminShell
        title="Private Vehicle Sale & Handover Record"
        description="Preparing the administrative private-sale record workflow."
        requiredPermission="manageVehicles"
      >
        <div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">
          Loading sale and handover record...
        </div>
      </AdminShell>
    );
  }

  if (errorMessage && !record) {
    return (
      <AdminShell
        title="Private Vehicle Sale & Handover Record"
        description="Prepare an administrative private-sale and handover record for warehouse-managed vehicles."
        requiredPermission="manageVehicles"
      >
        <div className="space-y-4">
          <Link href="/admin/vehicles" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
            ← Back to vehicles
          </Link>
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-sm text-red-800 shadow-panel">
            {errorMessage}
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Private Vehicle Sale & Handover Record"
      description="Administrative transaction template and information summary for private buyer and private seller handover."
      requiredPermission="manageVehicles"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin/vehicles" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
            ← Back to vehicles
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {record ? (
              <span className={`rounded-full border px-4 py-2 text-xs font-semibold ${statusPillClass(record.status)}`}>
                {getSaleHandoverStatusLabel(record.status)}
              </span>
            ) : null}
            {record?.listingId ? (
              <Link href={`/admin/vehicles/${record.listingId}`} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
                Open listing
              </Link>
            ) : null}
          </div>
        </div>

        {record ? (
          <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-panel">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-bronze">Record No: {record.recordNumber}</p>
                <h1 className="mt-2 font-display text-4xl text-ink">{getSaleHandoverActionLabel(record)}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
                  CarNest prepared this document as an administrative template and information summary. CarNest is not the buyer, seller, owner or guarantor under the private sale.
                </p>
              </div>
              <div className="rounded-[22px] border border-black/6 bg-shell px-4 py-3 text-sm text-ink/65">
                <p>Vehicle: {[record.vehicle.year, record.vehicle.make, record.vehicle.model, record.vehicle.variant].filter(Boolean).join(" ") || "Not provided"}</p>
                <p>Seller: {record.seller.legalName || "Not provided"}</p>
                <p>Buyer: {buyerDisplayName}</p>
              </div>
            </div>
            {record.sourceSnapshot.warnings.length ? (
              <div className="mt-5 space-y-2">
                {record.sourceSnapshot.warnings.map((warning) => (
                  <p key={warning} className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {notice ? (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STEPS.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setStepIndex(index)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                stepIndex === index
                  ? "border-ink bg-ink text-white"
                  : "border-black/10 bg-white text-ink/65 hover:border-bronze hover:text-bronze"
              }`}
            >
              {index + 1}. {step}
            </button>
          ))}
        </div>

        {renderStep()}

        <div className="sticky bottom-4 z-10 rounded-[26px] border border-black/8 bg-white/95 p-4 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-ink/60">
              {record?.status === "draft"
                ? "Drafts may contain blanks. Signature collection is blocked until the review checklist is complete and the record is marked ready."
                : "Signed material fields are version-protected and ordinary saves preserve existing signatures."}
            </p>
            <div className="flex flex-wrap gap-3">
              {record?.status === "draft" && record.storageContractId ? (
                <button type="button" onClick={() => void handleRefreshFromStorageContract()} disabled={saving} className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:text-ink/35">
                  Refresh unsigned details
                </button>
              ) : null}
              <button type="button" onClick={() => void handleSave()} disabled={saving || !record} className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:text-ink/35">
                Save record
              </button>
              <button type="button" onClick={() => void handleReadyForSignature()} disabled={saving || !record || !readyForSignature || record.status !== "draft"} className="rounded-full bg-bronze px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-bronze/35">
                Mark ready for signature
              </button>
              <button type="button" onClick={() => router.push("/admin/vehicles")} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-bronze">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
