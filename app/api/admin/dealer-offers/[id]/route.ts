import { NextRequest, NextResponse } from "next/server";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { DealerOfferRouteError, updateDealerOfferStatus } from "@/lib/dealer-offers";
import { isDealerOfferStatus } from "@/lib/dealer-offer-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireVerifiedAdminApiAccess(request, "manageOffers");
    const { id } = await params;
    const body = await request.json().catch(() => null) as { status?: unknown } | null;
    if (!isDealerOfferStatus(body?.status)) {
      return NextResponse.json({ error: "Please choose a valid dealer offer status." }, { status: 400 });
    }
    return NextResponse.json({ offer: await updateDealerOfferStatus({ id, status: body.status, actorUid: admin.uid }) });
  } catch (error) {
    if (error instanceof AdminApiAuthError || error instanceof DealerOfferRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to update dealer offer." }, { status: 500 });
  }
}
