import { NextRequest, NextResponse } from "next/server";
import {
  getDealerInfoRequestEmailContent,
  sendDealerInfoRequestEmail,
  type DealerInfoRequestEmailPayload
} from "@/lib/dealer-email";

function isValidPayload(body: unknown): body is DealerInfoRequestEmailPayload {
  if (!body || typeof body !== "object") return false;
  const payload = body as Record<string, unknown>;
  return typeof payload.to === "string"
    && payload.to.trim().length > 0
    && typeof payload.applicationId === "string"
    && payload.applicationId.trim().length > 0
    && typeof payload.businessName === "string"
    && typeof payload.adminNote === "string"
    && payload.adminNote.trim().length > 0
    && (
      !("status" in payload)
      || payload.status === "info_requested"
      || payload.status === "approved"
      || payload.status === "rejected"
    )
    && (!("note" in payload) || typeof payload.note === "string");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json({ success: false, error: "Invalid dealer notification payload" }, { status: 400 });
    }

    const content = getDealerInfoRequestEmailContent(body);
    console.info("[dealer-email] Trigger received", {
      event: `dealer_${body.status ?? "info_requested"}`,
      applicationId: body.applicationId,
      recipientEmail: body.to,
      subject: content.subject
    });

    const result = await sendDealerInfoRequestEmail(body);
    if (result.sent) {
      console.info("[dealer-email] Email sent", {
        event: `dealer_${body.status ?? "info_requested"}`,
        applicationId: body.applicationId,
        recipientEmail: body.to,
        subject: result.subject,
        providerMessageId: "providerMessageId" in result ? result.providerMessageId : null
      });
    } else {
      console.warn("[dealer-email] Email skipped", {
        event: `dealer_${body.status ?? "info_requested"}`,
        applicationId: body.applicationId,
        recipientEmail: body.to,
        subject: content.subject,
        reason: "reason" in result ? result.reason : "skipped"
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[dealer-email] Failed to send dealer notification email", {
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
