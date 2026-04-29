import { NextRequest, NextResponse } from "next/server";
import {
  getVehicleActivityEmailContent,
  sendVehicleActivityEmail,
  type VehicleActivityEmailPayload
} from "@/lib/vehicle-activity-email";

function isValidPayload(body: unknown): body is VehicleActivityEmailPayload {
  if (!body || typeof body !== "object") return false;
  const payload = body as Record<string, unknown>;
  return typeof payload.to === "string"
    && payload.to.trim().length > 0
    && typeof payload.vehicleId === "string"
    && payload.vehicleId.trim().length > 0
    && typeof payload.vehicleTitle === "string"
    && payload.vehicleTitle.trim().length > 0
    && typeof payload.referenceId === "string"
    && payload.referenceId.trim().length > 0
    && typeof payload.message === "string"
    && payload.message.trim().length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json({ success: false, error: "Invalid vehicle activity email payload" }, { status: 400 });
    }

    const content = getVehicleActivityEmailContent(body);
    console.info("[vehicle-activity-email] Trigger received", {
      vehicleId: body.vehicleId,
      recipientEmail: body.to,
      subject: content.subject
    });

    const result = await sendVehicleActivityEmail(body);
    if (result.sent) {
      console.info("[vehicle-activity-email] Email sent", {
        vehicleId: body.vehicleId,
        recipientEmail: body.to,
        subject: result.subject,
        providerMessageId: "providerMessageId" in result ? result.providerMessageId : null
      });
    } else {
      console.warn("[vehicle-activity-email] Email skipped", {
        vehicleId: body.vehicleId,
        recipientEmail: body.to,
        subject: content.subject,
        reason: "reason" in result ? result.reason : "skipped"
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[vehicle-activity-email] Failed to send vehicle activity email", {
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
