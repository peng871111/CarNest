import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { sanitizeAdminPricingUpdateInput, serializeAdminPricingRequestDoc } from "@/lib/admin-pricing";
import { getAdminDb } from "@/lib/firebase-admin-server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidPricingRequestId(id: string) {
  return /^[A-Za-z0-9_-]{8,120}$/.test(id);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireVerifiedAdminApiAccess(request, "managePricing");

    const { id } = await params;
    if (!isValidPricingRequestId(id)) {
      return jsonError("Invalid pricing request id.", 400);
    }

    const input = sanitizeAdminPricingUpdateInput(await request.json().catch(() => null));
    const ref = getAdminDb().collection("pricingRequests").doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      return jsonError("Pricing request not found.", 404);
    }

    await ref.update({
      status: input.status,
      response: input.response,
      leadRating: input.leadRating ?? FieldValue.delete(),
      nextAction: input.nextAction ?? FieldValue.delete(),
      respondedAt: input.response ? FieldValue.serverTimestamp() : FieldValue.delete()
    });

    const updated = await ref.get();
    return NextResponse.json({
      pricingRequest: serializeAdminPricingRequestDoc(updated.id, updated.data() ?? {}),
      writeSucceeded: true
    });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Unable to update pricing request.", 400);
  }
}
