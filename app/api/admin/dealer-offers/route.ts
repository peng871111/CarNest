import { NextRequest, NextResponse } from "next/server";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { getDealerOffersForAdmin } from "@/lib/dealer-offers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireVerifiedAdminApiAccess(request, "manageOffers");
    return NextResponse.json({ offers: await getDealerOffersForAdmin() });
  } catch (error) {
    const status = error instanceof AdminApiAuthError ? error.status : 500;
    const message = error instanceof AdminApiAuthError ? error.message : "Unable to load dealer offers.";
    return NextResponse.json({ error: message }, { status });
  }
}
