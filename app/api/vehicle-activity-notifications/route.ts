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
  message: string;
  customerEmail?: string;
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
    && typeof payload.message === "string"
    && payload.message.trim().length > 0
    && (typeof payload.customerEmail === "undefined" || typeof payload.customerEmail === "string");
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

export async function POST(request: NextRequest) {
  try {
    console.log("API route hit");
    const body = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json({ success: false, error: "Invalid vehicle activity email payload" }, { status: 400 });
    }

    const payloadCustomerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
    const recipientEmails = parseCustomerEmailList(payloadCustomerEmail);
    const content = getVehicleActivityEmailContent(body);
    console.info("[vehicle-activity-email] Trigger received", {
      vehicleId: body.vehicleId,
      subject: content.subject,
      payloadCustomerEmail,
      recipientEmails,
      from: VEHICLE_ACTIVITY_EMAIL_FROM
    });

    if (!recipientEmails.length) {
      console.warn("[vehicle-activity-email] No customer email set for vehicle activity update.", {
        vehicleId: body.vehicleId,
        payloadCustomerEmail,
        recipientEmails,
        from: VEHICLE_ACTIVITY_EMAIL_FROM
      });
      return NextResponse.json({
        success: true,
        sent: false,
        reason: "no_customer_email_set",
        error: "no customer email set"
      });
    }

    const result = await sendVehicleActivityEmail({
      ...body,
      to: recipientEmails
    });
    if (result.sent) {
      console.info("[vehicle-activity-email] Email sent", {
        vehicleId: body.vehicleId,
        recipientEmails,
        subject: result.subject,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        providerMessageId: "providerMessageId" in result ? result.providerMessageId : null
      });
    } else {
      console.warn("[vehicle-activity-email] Email skipped", {
        vehicleId: body.vehicleId,
        recipientEmails,
        subject: content.subject,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        reason: "reason" in result ? result.reason : "skipped"
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[vehicle-activity-email] Failed to send vehicle activity email", {
      from: VEHICLE_ACTIVITY_EMAIL_FROM,
      error
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
