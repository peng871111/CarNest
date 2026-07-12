import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  createPublicRouteErrorResponse,
  sendPublicActionVerificationCode,
  verifyPublicActionEmailCode
} from "@/lib/public-vehicle-actions";
import { isPublicVehicleActionType } from "@/lib/public-vehicle-action-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || request.headers.get("x-vercel-id") || randomUUID();

  try {
    const body = await request.json() as Record<string, unknown>;
    const mode = typeof body.mode === "string" ? body.mode : "";
    const actionType = body.actionType;
    const vehicleId =
      typeof body.vehicleId === "string"
        ? body.vehicleId.trim()
        : typeof body.listingId === "string"
          ? body.listingId.trim()
          : "";
    const email = typeof body.email === "string" ? body.email : "";

    console.info("[public-vehicle-actions] verification route reached", {
      requestId,
      mode,
      actionType: typeof actionType === "string" ? actionType : "invalid",
      hasVehicleId: Boolean(vehicleId),
      hasEmail: Boolean(email)
    });

    if (!isPublicVehicleActionType(actionType) || !vehicleId || !email) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          message: "Unable to process this verification request.",
          requestId
        },
        { status: 400 }
      );
    }

    if (mode === "send") {
      const result = await sendPublicActionVerificationCode({
        actionType,
        vehicleId,
        email,
        turnstileToken:
          typeof body.turnstileToken === "string"
            ? body.turnstileToken
            : typeof body.captchaToken === "string"
              ? body.captchaToken
              : "",
        request,
        requestId
      });

      return NextResponse.json({
        success: true,
        requestId,
        ...result
      });
    }

    if (mode === "verify") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      const code = typeof body.code === "string" ? body.code : "";

      const result = await verifyPublicActionEmailCode({
        actionType,
        vehicleId,
        email,
        sessionId,
        code
      });

      return NextResponse.json({
        success: true,
        requestId,
        ...result
      });
    }

    return NextResponse.json(
      {
        success: false,
        code: "INVALID_REQUEST",
        message: "Unable to process this verification request.",
        requestId
      },
      { status: 400 }
    );
  } catch (error) {
    const response = createPublicRouteErrorResponse(
      error,
      requestId,
      "We could not send the verification email right now. Please try again shortly."
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
