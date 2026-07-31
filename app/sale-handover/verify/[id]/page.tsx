import Link from "next/link";
import { notFound } from "next/navigation";
import {
  calculateSaleHandoverDocumentHash,
  createEmptySaleHandoverBuyer,
  createEmptySaleHandoverConfirmations,
  createEmptySaleHandoverPreparation,
  createEmptySaleHandoverSeller,
  createEmptySaleHandoverSourceSnapshot,
  createEmptySaleHandoverTransaction,
  createEmptySaleHandoverVehicle,
} from "@/lib/sale-handover";
import { getAdminDb } from "@/lib/firebase-admin-server";
import { SaleHandoverRecordStatus } from "@/types";

export const dynamic = "force-dynamic";

function serializeDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  return typeof value === "string" ? value : "";
}

function formatDate(value?: string) {
  if (!value) return "Not signed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  }).format(date);
}

function isSafeRecordId(value: string) {
  return /^[A-Za-z0-9_-]{8,120}$/.test(value);
}

export default async function SaleHandoverVerificationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSafeRecordId(id)) notFound();

  const snapshot = await getAdminDb().collection("saleHandoverRecords").doc(id).get();
  if (!snapshot.exists) notFound();

  const data = snapshot.data() ?? {};
  const sellerSignature = data.sellerSignature && typeof data.sellerSignature === "object"
    ? data.sellerSignature as Record<string, unknown>
    : {};
  const buyerSignature = data.buyerSignature && typeof data.buyerSignature === "object"
    ? data.buyerSignature as Record<string, unknown>
    : {};
  const pdf = data.pdf && typeof data.pdf === "object" ? data.pdf as Record<string, unknown> : {};
  const fullySigned = Boolean(sellerSignature.signatureStoragePath && buyerSignature.signatureStoragePath);
  const storedHash = typeof pdf.documentHash === "string" ? pdf.documentHash : "";
  const status: SaleHandoverRecordStatus =
    data.status === "ready_for_signature" || data.status === "partially_signed" || data.status === "signed" || data.status === "superseded"
      ? data.status
      : "draft";
  const computedHash = await calculateSaleHandoverDocumentHash({
    id,
    recordNumber: typeof data.recordNumber === "string" ? data.recordNumber : "Not available",
    status,
    listingId: "",
    vehicleId: "",
    vehicleRecordId: "",
    storageContractId: "",
    sellerCustomerId: "",
    buyerCustomerId: "",
    seller: {
      ...createEmptySaleHandoverSeller(),
      ...(data.seller && typeof data.seller === "object" ? data.seller as Record<string, unknown> : {}),
    },
    buyer: {
      ...createEmptySaleHandoverBuyer(),
      ...(data.buyer && typeof data.buyer === "object" ? data.buyer as Record<string, unknown> : {}),
    },
    vehicle: {
      ...createEmptySaleHandoverVehicle(),
      ...(data.vehicle && typeof data.vehicle === "object" ? data.vehicle as Record<string, unknown> : {}),
    },
    preparation: {
      ...createEmptySaleHandoverPreparation(),
      ...(data.preparation && typeof data.preparation === "object" ? data.preparation as Record<string, unknown> : {}),
    },
    transaction: {
      ...createEmptySaleHandoverTransaction(),
      ...(data.transaction && typeof data.transaction === "object" ? data.transaction as Record<string, unknown> : {}),
    },
    confirmations: {
      ...createEmptySaleHandoverConfirmations(),
      ...(data.confirmations && typeof data.confirmations === "object" ? data.confirmations as Record<string, unknown> : {}),
    },
    sellerSignature: sellerSignature.signatureStoragePath
      ? {
          signerRole: "seller",
          signerName: typeof sellerSignature.signerName === "string" ? sellerSignature.signerName : "",
          signatureStoragePath: String(sellerSignature.signatureStoragePath),
          signedAt: serializeDate(sellerSignature.signedAt),
          timezone: "Australia/Melbourne",
          documentVersion: Number(sellerSignature.documentVersion || data.documentVersion || 1),
          agreementTermsVersion: typeof sellerSignature.agreementTermsVersion === "string" ? sellerSignature.agreementTermsVersion : String(data.agreementTermsVersion || ""),
          recordId: id,
          recordedByUid: "",
          recordedByName: "",
        }
      : null,
    buyerSignature: buyerSignature.signatureStoragePath
      ? {
          signerRole: "buyer",
          signerName: typeof buyerSignature.signerName === "string" ? buyerSignature.signerName : "",
          signatureStoragePath: String(buyerSignature.signatureStoragePath),
          signedAt: serializeDate(buyerSignature.signedAt),
          timezone: "Australia/Melbourne",
          documentVersion: Number(buyerSignature.documentVersion || data.documentVersion || 1),
          agreementTermsVersion: typeof buyerSignature.agreementTermsVersion === "string" ? buyerSignature.agreementTermsVersion : String(data.agreementTermsVersion || ""),
          recordId: id,
          recordedByUid: "",
          recordedByName: "",
        }
      : null,
    documentVersion: Number(data.documentVersion || 1),
    agreementTermsVersion: typeof data.agreementTermsVersion === "string" ? data.agreementTermsVersion : "",
    sourceSnapshot: {
      ...createEmptySaleHandoverSourceSnapshot(),
      ...(data.sourceSnapshot && typeof data.sourceSnapshot === "object" ? data.sourceSnapshot as Record<string, unknown> : {}),
    },
    pdf: null,
    pdfHistory: [],
    previousVersions: [],
    preparedByUid: "",
    preparedByName: "",
  });
  const hashValid = Boolean(storedHash && storedHash === computedHash);
  const signedDate = serializeDate(data.signedAt) || serializeDate(sellerSignature.signedAt) || serializeDate(buyerSignature.signedAt);

  return (
    <main className="min-h-screen bg-shell px-5 py-12 text-ink">
      <div className="mx-auto max-w-2xl rounded-[30px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-bronze">CarNest verification</p>
        <h1 className="mt-3 font-display text-4xl">Private Sale & Handover Record</h1>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          This page verifies the record ID and signed document version only. It does not display private buyer, seller, contact, transaction or signature information.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[22px] border border-black/6 bg-shell p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Record number</p>
            <p className="mt-2 font-semibold">{typeof data.recordNumber === "string" ? data.recordNumber : "Not available"}</p>
          </div>
          <div className="rounded-[22px] border border-black/6 bg-shell p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Document version</p>
            <p className="mt-2 font-semibold">Version {Number(data.documentVersion || 1)}</p>
          </div>
          <div className="rounded-[22px] border border-black/6 bg-shell p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Signed status</p>
            <p className="mt-2 font-semibold">{fullySigned ? "Signed" : "Unsigned or draft"}</p>
          </div>
          <div className="rounded-[22px] border border-black/6 bg-shell p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Signed date</p>
            <p className="mt-2 font-semibold">{formatDate(signedDate)}</p>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] border border-black/6 bg-shell p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/45">Document hash validity</p>
          <p className={`mt-2 font-semibold ${hashValid ? "text-emerald-700" : "text-amber-700"}`}>
            {hashValid ? "Hash matches the stored signed document record." : "Hash is not available or does not match the current stored record."}
          </p>
        </div>

        <Link href="/" className="mt-8 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-bronze">
          Return to CarNest
        </Link>
      </div>
    </main>
  );
}
