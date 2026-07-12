import { NextRequest, NextResponse } from "next/server";
import {
  createPublicRouteErrorResponse,
  sendPublicActionVerificationCode,
  verifyPublicActionEmailCode
} from "@/lib/public-vehicle-actions";
import { isPublicVehicleActionType } from "@/lib/public-vehicle-action-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const mode = typeof body.mode === "string" ? body.mode : "";
    const actionType = body.actionType;
    const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId.trim() : "";
    const email = typeof body.email === "string" ? body.email : "";

    if (!isPublicVehicleActionType(actionType) || !vehicleId || !email) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          message: "Unable to process this verification request."
        },
        { status: 400 }
      );
    }

    if (mode === "send") {
      const result = await sendPublicActionVerificationCode({
        actionType,
        vehicleId,
        email,
        turnstileToken: typeof body.turnstileToken === "string" ? body.turnstileToken : "",
        request
      });

      return NextResponse.json({
        success: true,
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
        ...result
      });
    }

    return NextResponse.json(
      {
        success: false,
        code: "INVALID_REQUEST",
        message: "Unable to process this verification request."
      },
      { status: 400 }
    );
  } catch (error) {
    const response = createPublicRouteErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
