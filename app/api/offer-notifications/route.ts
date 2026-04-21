import { NextRequest, NextResponse } from "next/server";
import { getOfferEmailContent, sendOfferEmail, type OfferEmailEvent, type OfferEmailPayload } from "@/lib/offer-email";

function isOfferEmailEvent(value: unknown): value is OfferEmailEvent {
  return value === "new_offer_to_seller"
    || value === "seller_countered_offer"
    || value === "seller_accepted_offer"
    || value === "buyer_accepted_counteroffer";
}

function isValidPayload(body: unknown): body is OfferEmailPayload {
  if (!body || typeof body !== "object") return false;
  const payload = body as Record<string, unknown>;
  return isOfferEmailEvent(payload.event)
    && typeof payload.to === "string"
    && payload.to.trim().length > 0
    && typeof payload.vehicleTitle === "string"
    && payload.vehicleTitle.trim().length > 0
    && typeof payload.offerId === "string"
    && payload.offerId.trim().length > 0
    && typeof payload.amount === "number"
    && Number.isFinite(payload.amount)
    && payload.amount > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json({ success: false, error: "Invalid email payload" }, { status: 400 });
    }

    const content = getOfferEmailContent(body);
    console.log("EMAIL_TRIGGERED");
    console.log("TO:", body.to);
    console.info("[offer-email] Trigger received", {
      event: body.event,
      offerId: body.offerId,
      recipientEmail: body.to,
      subject: content.subject
    });

    const result = await sendOfferEmail(body);
    if (result.sent) {
      console.info("[offer-email] Email sent", {
        event: body.event,
        offerId: body.offerId,
        recipientEmail: body.to,
        subject: result.subject,
        providerMessageId: "providerMessageId" in result ? result.providerMessageId : null
      });
    } else {
      console.warn("[offer-email] Email skipped", {
        event: body.event,
        offerId: body.offerId,
        recipientEmail: body.to,
        subject: content.subject,
        reason: "reason" in result ? result.reason : "skipped"
      });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[offer-email] Failed to send offer email", {
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
