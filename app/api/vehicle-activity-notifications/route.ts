import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import {
  getVehicleActivityEmailContent,
  sendVehicleActivityEmail,
  VEHICLE_ACTIVITY_EMAIL_FROM
} from "@/lib/vehicle-activity-email";
import { isValidEmailAddress } from "@/lib/form-safety";
import { VehicleActivityEmailAttachment } from "@/types";

interface VehicleActivityEmailRequestBody {
  vehicleId: string;
  vehicleTitle: string;
  referenceId: string;
  message: string;
  customerEmail?: string;
  attachments?: VehicleActivityEmailAttachment[];
}

interface PreparedVehicleActivityEmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
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
    && (typeof payload.customerEmail === "undefined" || typeof payload.customerEmail === "string")
    && (
      typeof payload.attachments === "undefined"
      || (
        Array.isArray(payload.attachments)
        && payload.attachments.every((attachment) =>
          attachment
          && typeof attachment === "object"
          && typeof (attachment as Record<string, unknown>).filename === "string"
          && ((attachment as Record<string, string>).filename ?? "").trim().length > 0
          && typeof (attachment as Record<string, unknown>).content === "string"
          && ((attachment as Record<string, string>).content ?? "").trim().length > 0
          && (
            typeof (attachment as Record<string, unknown>).contentType === "undefined"
            || typeof (attachment as Record<string, unknown>).contentType === "string"
          )
        )
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

function sanitizeAttachments(attachments?: VehicleActivityEmailAttachment[]) {
  if (!attachments?.length) return [];

  return attachments
    .slice(0, 2)
    .filter((attachment) => attachment.filename.trim().length > 0 && attachment.content.trim().length > 0)
    .map((attachment) => ({
      filename: attachment.filename.trim(),
      content: attachment.content.trim()
    }));
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
    const rawAttachments = sanitizeAttachments(body.attachments);
    let attachments: PreparedVehicleActivityEmailAttachment[] = [];
    let totalBytes = 0;

    if (rawAttachments.length) {
      const decodedAttachments = rawAttachments.map((attachment) => {
        const buffer = Buffer.from(attachment.content, "base64");
        return {
          filename: attachment.filename,
          content: buffer,
          contentType: "image/jpeg"
        };
      });

      totalBytes = decodedAttachments.reduce((sum, attachment) => sum + attachment.content.byteLength, 0);
      console.log("attachments count:", decodedAttachments.length);
      console.log("total size:", totalBytes);

      if (totalBytes <= 800 * 1024) {
        attachments = decodedAttachments;
      } else {
        console.warn("[vehicle-activity-email] Attachments ignored because total payload is too large.", {
          vehicleId: body.vehicleId,
          attachmentCount: decodedAttachments.length,
          totalBytes
        });
      }
    } else {
      console.log("attachments count:", 0);
      console.log("total size:", 0);
    }

    const content = getVehicleActivityEmailContent(body);
    console.info("[vehicle-activity-email] Trigger received", {
      vehicleId: body.vehicleId,
      subject: content.subject,
      payloadCustomerEmail,
      recipientEmails,
      from: VEHICLE_ACTIVITY_EMAIL_FROM,
      attachmentCount: attachments.length
    });

    if (!recipientEmails.length) {
      console.warn("[vehicle-activity-email] No customer email set for vehicle activity update.", {
        vehicleId: body.vehicleId,
        payloadCustomerEmail,
        recipientEmails,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        attachmentCount: attachments.length
      });
      return NextResponse.json({
        success: true,
        sent: false,
        reason: "no_customer_email_set",
        error: "no customer email set"
      });
    }

    let result;
    try {
      result = await sendVehicleActivityEmail({
        ...body,
        to: recipientEmails,
        attachments
      });
    } catch (attachmentError) {
      console.error("[vehicle-activity-email] Attachment send failed; retrying without attachments.", {
        vehicleId: body.vehicleId,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        attachmentCount: attachments.length,
        totalBytes,
        error: attachmentError
      });

      try {
        result = await sendVehicleActivityEmail({
          ...body,
          to: recipientEmails,
          attachments: []
        });
      } catch (retryError) {
        console.error("[vehicle-activity-email] Fallback send without attachments failed.", {
          vehicleId: body.vehicleId,
          from: VEHICLE_ACTIVITY_EMAIL_FROM,
          error: retryError
        });
        return NextResponse.json({
          success: true,
          sent: false,
          error: retryError instanceof Error ? retryError.message : String(retryError)
        });
      }
    }

    if (result.sent) {
      console.info("[vehicle-activity-email] Email sent", {
        vehicleId: body.vehicleId,
        recipientEmails,
        subject: result.subject,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        attachmentCount: attachments.length,
        providerMessageId: "providerMessageId" in result ? result.providerMessageId : null
      });
    } else {
      console.warn("[vehicle-activity-email] Email skipped", {
        vehicleId: body.vehicleId,
        recipientEmails,
        subject: content.subject,
        from: VEHICLE_ACTIVITY_EMAIL_FROM,
        attachmentCount: attachments.length,
        reason: "reason" in result ? result.reason : "skipped"
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[vehicle-activity-email] Failed to send vehicle activity email", {
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
