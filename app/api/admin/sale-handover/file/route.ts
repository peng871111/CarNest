import { NextRequest, NextResponse } from "next/server";
import {
  AdminApiAuthError,
  requireVerifiedAdminApiAccess
} from "@/lib/admin-api-auth";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin-server";
import { extractFirebaseStoragePath } from "@/lib/firebase-storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTECTED_FILE_ACCESS_ERROR =
  "This protected sale and handover file could not be opened with your current access. Please refresh your session or contact a CarNest administrator.";

function sanitizeDownloadName(value: string) {
  return value.replace(/["\r\n\\/]/g, "").trim().slice(0, 180);
}

function getFallbackFileName(storagePath: string) {
  return sanitizeDownloadName(storagePath.split("/").pop() || "sale-handover-file");
}

function isSafeSaleHandoverStoragePath(storagePath: string) {
  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/") || storagePath.includes("\0")) {
    return false;
  }

  const segments = storagePath.split("/");
  return (
    segments.length >= 4
    && segments[0] === "sale-handover-records"
    && /^[A-Za-z0-9_-]{8,120}$/.test(segments[1] ?? "")
    && ["signatures", "pdf"].includes(segments[2] ?? "")
    && segments.every((segment) => segment.length > 0)
  );
}

function getRecordIdFromStoragePath(storagePath: string) {
  return storagePath.split("/")[1] ?? "";
}

function collectAllowedRecordPaths(data: Record<string, unknown>) {
  const paths = new Set<string>();
  const pdf = data.pdf && typeof data.pdf === "object" ? data.pdf as Record<string, unknown> : {};
  if (typeof pdf.storagePath === "string") paths.add(extractFirebaseStoragePath(pdf.storagePath));

  if (Array.isArray(data.pdfHistory)) {
    data.pdfHistory.forEach((entry) => {
      if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).storagePath === "string") {
        paths.add(extractFirebaseStoragePath(String((entry as Record<string, unknown>).storagePath)));
      }
    });
  }

  const sellerSignature = data.sellerSignature && typeof data.sellerSignature === "object" ? data.sellerSignature as Record<string, unknown> : {};
  const buyerSignature = data.buyerSignature && typeof data.buyerSignature === "object" ? data.buyerSignature as Record<string, unknown> : {};
  if (typeof sellerSignature.signatureStoragePath === "string") paths.add(extractFirebaseStoragePath(sellerSignature.signatureStoragePath));
  if (typeof buyerSignature.signatureStoragePath === "string") paths.add(extractFirebaseStoragePath(buyerSignature.signatureStoragePath));
  return paths;
}

async function writePdfAccessAuditEvent(input: {
  recordId: string;
  data: Record<string, unknown>;
  uid: string;
  email: string;
  download: boolean;
}) {
  const db = getAdminDb();
  await db.collection("adminOperationalEvents").add({
    recordType: "sale_handover",
    actionType: input.download ? "pdf_downloaded" : "pdf_viewed",
    affectedRecordId: input.recordId,
    customerProfileId: typeof input.data.sellerCustomerId === "string" ? input.data.sellerCustomerId : "",
    vehicleRecordId: typeof input.data.vehicleRecordId === "string" ? input.data.vehicleRecordId : "",
    intakeEventId: typeof input.data.storageContractId === "string" ? input.data.storageContractId : "",
    publicListingId: typeof input.data.listingId === "string" ? input.data.listingId : "",
    staffUid: input.uid,
    staffName: input.email || "CarNest Admin",
    staffEmail: input.email,
    summary: `${typeof input.data.recordNumber === "string" ? input.data.recordNumber : "Sale and handover record"} PDF ${input.download ? "downloaded" : "viewed"}.`,
    createdAt: new Date()
  }).catch(() => undefined);
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path") ?? "";
  const storagePath = extractFirebaseStoragePath(rawPath);
  if (!isSafeSaleHandoverStoragePath(storagePath)) {
    return NextResponse.json({ success: false, error: "Invalid sale and handover file path." }, { status: 400 });
  }

  const downloadName = sanitizeDownloadName(request.nextUrl.searchParams.get("name") ?? "") || getFallbackFileName(storagePath);
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  try {
    const access = await requireVerifiedAdminApiAccess(request, "manageVehicles");
    const recordId = getRecordIdFromStoragePath(storagePath);
    const recordSnapshot = await getAdminDb().collection("saleHandoverRecords").doc(recordId).get();
    if (!recordSnapshot.exists) {
      return NextResponse.json({ success: false, error: "Sale and handover record not found." }, { status: 404 });
    }
    const recordData = recordSnapshot.data() ?? {};
    const allowedPaths = collectAllowedRecordPaths(recordData);
    if (!allowedPaths.has(storagePath)) {
      return NextResponse.json({ success: false, error: "This sale and handover file is not linked to the selected record." }, { status: 403 });
    }

    const file = getAdminStorageBucket().file(storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({ success: false, error: "The requested sale and handover file could not be found." }, { status: 404 });
    }

    const [[metadata], [fileBuffer]] = await Promise.all([
      file.getMetadata(),
      file.download()
    ]);
    const contentType = metadata.contentType || (storagePath.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    const responseBody = new Blob([new Uint8Array(fileBuffer)], { type: contentType });
    if (storagePath.endsWith(".pdf")) {
      await writePdfAccessAuditEvent({
        recordId,
        data: recordData,
        uid: access.uid,
        email: access.email,
        download: disposition === "attachment"
      });
    }

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `${disposition}; filename="${downloadName}"`
      }
    });
  } catch (error) {
    const status = error instanceof AdminApiAuthError ? error.status : 500;
    console.error("[sale-handover-file] Failed to load private file.", {
      storagePath,
      status,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      {
        success: false,
        error: status === 401 || status === 403
          ? PROTECTED_FILE_ACCESS_ERROR
          : "Unable to load the requested sale and handover file right now."
      },
      { status }
    );
  }
}
