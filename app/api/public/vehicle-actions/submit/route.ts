import { NextRequest, NextResponse } from "next/server";
import {
  createPublicRouteErrorResponse,
  submitPublicInspectionRequest,
  submitPublicOffer
} from "@/lib/public-vehicle-actions";
import { isPublicVehicleActionType } from "@/lib/public-vehicle-action-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const actionType = body.actionType;
    const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId.trim() : "";
    const buyerName = typeof body.buyerName === "string" ? body.buyerName : "";
    const buyerEmail = typeof body.buyerEmail === "string" ? body.buyerEmail : "";
    const buyerPhone = typeof body.buyerPhone === "string" ? body.buyerPhone : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    const authorization = request.headers.get("authorization")?.trim() ?? "";
    const authToken = authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : "";
    const verificationSessionId = typeof body.verificationSessionId === "string" ? body.verificationSessionId : "";
    const verificationToken = typeof body.verificationToken === "string" ? body.verificationToken : "";

    if (!isPublicVehicleActionType(actionType) || !vehicleId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          message: "Unable to submit this request."
        },
        { status: 400 }
      );
    }

    if (actionType === "offer") {
      const offerAmount = Number(body.offerAmount ?? NaN);
      const result = await submitPublicOffer({
        vehicleId,
        buyerName,
        buyerEmail,
        buyerPhone,
        offerAmount,
        message: typeof body.message === "string" ? body.message : "",
        turnstileToken: typeof body.turnstileToken === "string" ? body.turnstileToken : "",
        idempotencyKey,
        request,
        authToken,
        verificationSessionId,
        verificationToken
      });

      return NextResponse.json({
        success: true,
        ...result
      });
    }

    const result = await submitPublicInspectionRequest({
      vehicleId,
      buyerName,
      buyerEmail,
      buyerPhone,
      preferredDate: typeof body.preferredDate === "string" ? body.preferredDate : "",
      preferredTime: typeof body.preferredTime === "string" ? body.preferredTime : "",
      message: typeof body.message === "string" ? body.message : "",
      turnstileToken: typeof body.turnstileToken === "string" ? body.turnstileToken : "",
      idempotencyKey,
      request,
      authToken,
      verificationSessionId,
      verificationToken
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    const response = createPublicRouteErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
