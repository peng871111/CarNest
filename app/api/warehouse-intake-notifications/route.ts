import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, hasAdminApiAccess } from "@/lib/admin-api-auth";
import { extractFirebaseStoragePath } from "@/lib/firebase-storage-paths";
import { isValidEmailAddress } from "@/lib/form-safety";
import { WAREHOUSE_INTAKE_EMAIL_FROM, sendWarehouseIntakeEmail } from "@/lib/warehouse-intake-email";
import { fetchPrivateWarehouseIntakeStorageObject } from "@/lib/warehouse-intake-storage-server";

interface WarehouseIntakeNotificationRequest {
  customerEmail: string;
  customerName?: string;
  vehicleTitle: string;
  referenceId: string;
  pdfStoragePath?: string;
  pdfFileName?: string;
  adminStaffName?: string;
  signedAt?: string;
  financeOwing?: string;
}

function parseRecipients(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0 && isValidEmailAddress(item))
    )
  );
}

function isValidPayload(body: unknown): body is WarehouseIntakeNotificationRequest {
  if (!body || typeof body !== "object") return false;
  const input = body as Record<string, unknown>;
  return typeof input.customerEmail === "string"
    && typeof input.vehicleTitle === "string"
    && input.vehicleTitle.trim().length > 0
    && typeof input.referenceId === "string"
    && input.referenceId.trim().length > 0
    && typeof input.pdfStoragePath === "string"
    && input.pdfStoragePath.trim().length > 0;
}

export async function POST(request: NextRequest) {
  if (!hasAdminApiAccess(request, "manageVehicles")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json({ success: false, error: "Invalid warehouse intake notification payload." }, { status: 400 });
    }

    const recipients = parseRecipients(body.customerEmail);
    if (!recipients.length) {
      return NextResponse.json({
        success: true,
        sent: false,
        reason: "no_customer_email_set"
      });
    }

    const idToken = getBearerToken(request);
    const pdfStoragePath = extractFirebaseStoragePath(body.pdfStoragePath);
    let pdfAttachment: { filename: string; content: string } | null = null;

    if (pdfStoragePath) {
      if (!pdfStoragePath.startsWith("warehouse-intakes/")) {
        return NextResponse.json({ success: false, error: "Invalid warehouse intake PDF path." }, { status: 400 });
      }

      if (!idToken) {
        return NextResponse.json({ success: false, error: "Missing Firebase ID token." }, { status: 401 });
      }

      const pdfResponse = await fetchPrivateWarehouseIntakeStorageObject(pdfStoragePath, idToken);
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      pdfAttachment = {
        filename: body.pdfFileName?.trim() || `carnest-warehouse-intake-${body.referenceId || "record"}.pdf`,
        content: pdfBuffer.toString("base64")
      };
    }

    const result = await sendWarehouseIntakeEmail({
      to: recipients,
      customerName: body.customerName,
      vehicleTitle: body.vehicleTitle,
      referenceId: body.referenceId,
      pdfAttachment,
      adminStaffName: body.adminStaffName,
      signedAt: body.signedAt,
      financeOwing: body.financeOwing
    });

    return NextResponse.json({
      success: true,
      from: WAREHOUSE_INTAKE_EMAIL_FROM,
      ...result
    });
  } catch (error) {
    console.error("[warehouse-intake-email] Failed to process warehouse intake email request.", error);
    return NextResponse.json({
      success: true,
      sent: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
