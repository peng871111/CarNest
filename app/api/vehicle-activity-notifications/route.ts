import { NextRequest, NextResponse } from "next/server";
import {
  getVehicleActivityEmailContent,
  sendVehicleActivityEmail,
  VEHICLE_ACTIVITY_EMAIL_FROM
} from "@/lib/vehicle-activity-email";
import { isValidEmailAddress } from "@/lib/form-safety";

interface VehicleActivityEmailRequestBody {
  vehicleId: string;
  vehicleTitle: string;
  referenceId: string;
  noteContent?: string;
  message?: string;
  customerEmail?: string;
  customerName?: string | null;
  updateType?: string;
  imageUrls?: string[];
}

function isValidPayload(body: unknown): body is VehicleActivityEmailRequestBody {
  if (!body || typeof body !== "object") return false;
  const payload = body as Record<string, unknown>;
  return typeof payload.vehicleId === "string"
    && payload.vehicleId.trim().length > 0
    && typeof payload.vehicleTitle === "string"
    && payload.vehicleTitle.trim().length > 0
    && typeof payload.referenceId === "string"
    && payload.referenceId.trim().length > 0
    && (
      (typeof payload.noteContent === "string" && payload.noteContent.trim().length > 0)
      || (typeof payload.message === "string" && payload.message.trim().length > 0)
    )
    && (typeof payload.customerEmail === "undefined" || typeof payload.customerEmail === "string")
    && (
      typeof payload.customerName === "undefined"
      || typeof payload.customerName === "string"
      || payload.customerName === null
    )
    && (typeof payload.updateType === "undefined" || typeof payload.updateType === "string")
    && (
      typeof payload.imageUrls === "undefined"
      || (
        Array.isArray(payload.imageUrls)
        && payload.imageUrls.every((imageUrl) => typeof imageUrl === "string")
      )
    );
}

function parseCustomerEmailList(value?: string) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0 && isValidEmailAddress(item))
    )
  );
}

function sanitizeImageUrls(imageUrls?: string[]) {
  if (!imageUrls?.length) return [];

  return Array.from(
    new Set(
      imageUrls
        .map((imageUrl) => imageUrl.trim())
        .filter((imageUrl) => /^https?:\/\//i.test(imageUrl))
    )
  ).slice(0, 5);
}

export async function POST(request: NextRequest) {
  try {
    console.log("API route hit");
    const body = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json({ success: false, error: "Invalid vehicle activity email payload" }, { status: 400 });
    }

    const noteContent = typeof body.noteContent === "string" && body.noteContent.trim().length > 0
      ? body.noteContent.trim()
      : typeof body.message === "string"
        ? body.message.trim()
        : "";
    const payloadCustomerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
    const payloadCustomerName =
      typeof body.customerName === "string"
        ? body.customerName.trim()
        : "";
    const recipientEmails = parseCustomerEmailList(payloadCustomerEmail);
    const imageUrls = sanitizeImageUrls(body.imageUrls);
    const content = getVehicleActivityEmailContent({
      vehicleTitle: body.vehicleTitle,
      referenceId: body.referenceId,
      message: noteContent,
      customerName: payloadCustomerName,
      imageUrls
    });

    console.info("[vehicle-activity-email] Trigger received", {
      vehicleId: body.vehicleId,
      updateType: body.updateType ?? "",
      subject: content.subject,
      payloadCustomerEmail,
      recipientEmails,
      from: VEHICLE_ACTIVITY_EMAIL_FROM,
      imageUrlCount: imageUrls.length
    });

    if (!recipientEmails.length) {
      console.warn("[vehicle-activity-email] No customer email set for vehicle activity update.", {
        vehicleId: body.vehicleId,
        payloadCustomerEmail,
        recipientEmails,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        imageUrlCount: imageUrls.length
      });
      return NextResponse.json({
        success: true,
        sent: false,
        reason: "no_customer_email_set",
        error: "no customer email set"
      });
    }

    try {
      const result = await sendVehicleActivityEmail({
        to: recipientEmails,
        vehicleId: body.vehicleId,
        vehicleTitle: body.vehicleTitle,
        referenceId: body.referenceId,
        message: noteContent,
        customerName: payloadCustomerName,
        imageUrls
      });

      console.info("[vehicle-activity-email] Email sent", {
        vehicleId: body.vehicleId,
        recipientEmails,
        subject: result.subject,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        imageUrlCount: imageUrls.length,
        providerMessageId: "providerMessageId" in result ? result.providerMessageId : null
      });

      return NextResponse.json({ success: true, ...result });
    } catch (sendError) {
      console.error("[vehicle-activity-email] Failed to send vehicle activity email", {
        vehicleId: body.vehicleId,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        imageUrlCount: imageUrls.length,
        error: sendError
      });
      return NextResponse.json({
        success: true,
        sent: false,
        error: sendError instanceof Error ? sendError.message : String(sendError)
      });
    }
  } catch (error) {
    console.error("[vehicle-activity-email] Failed to process vehicle activity email request", {
      from: VEHICLE_ACTIVITY_EMAIL_FROM,
      error
    });
    return NextResponse.json({
      success: true,
      sent: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
