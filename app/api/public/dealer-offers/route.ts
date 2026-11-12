import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DealerOfferRouteError, submitDealerOffer } from "@/lib/dealer-offers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || request.headers.get("x-vercel-id") || randomUUID();

  try {
    const body = await request.json() as Record<string, unknown>;
    const vehicleId = typeof body.vehicleId === "string"
      ? body.vehicleId
      : typeof body.listingId === "string"
        ? body.listingId
        : "";
    const result = await submitDealerOffer({
      input: {
        vehicleId,
        dealershipName: typeof body.dealershipName === "string" ? body.dealershipName : "",
        contactName: typeof body.contactName === "string" ? body.contactName : "",
        phone: typeof body.phone === "string" ? body.phone : "",
        offerAmount: Number(body.offerAmount),
        email: typeof body.email === "string" ? body.email : "",
        preferredInspectionDate: typeof body.preferredInspectionDate === "string" ? body.preferredInspectionDate : "",
        comments: typeof body.comments === "string" ? body.comments : "",
        idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : ""
      },
      request,
      honeypot: typeof body.website === "string" ? body.website : "",
      turnstileToken: typeof body.turnstileToken === "string"
        ? body.turnstileToken
        : typeof body.captchaToken === "string"
          ? body.captchaToken
          : ""
    });

    return NextResponse.json({ success: true, requestId, ...result });
  } catch (error) {
    if (error instanceof DealerOfferRouteError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message, requestId }, { status: error.status });
    }
    console.error("[dealer-offers] Public submission failed", { requestId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, code: "SUBMISSION_FAILED", message: "Unable to submit this dealer offer. Please try again.", requestId },
      { status: 500 }
    );
  }
}
