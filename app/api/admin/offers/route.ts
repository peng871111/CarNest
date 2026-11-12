import { NextRequest, NextResponse } from "next/server";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { serializeAdminOfferDoc } from "@/lib/admin-offers";
import { getDealerOffersForAdmin } from "@/lib/dealer-offers";
import { getAdminDb } from "@/lib/firebase-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function submittedAt(value?: string) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export async function GET(request: NextRequest) {
  try {
    await requireVerifiedAdminApiAccess(request, "manageOffers");
    const [privateSnapshot, dealerOffers] = await Promise.all([
      getAdminDb().collection("offers").get(),
      getDealerOffersForAdmin()
    ]);
    const offers = privateSnapshot.docs
      .map((item) => serializeAdminOfferDoc(item.id, item.data() ?? {}))
      .sort((left, right) => submittedAt(right.createdAt) - submittedAt(left.createdAt));

    return NextResponse.json({ offers, dealerOffers });
  } catch (error) {
    const status = error instanceof AdminApiAuthError ? error.status : 500;
    const message = error instanceof AdminApiAuthError ? error.message : "Unable to load offers.";
    return NextResponse.json({ error: message }, { status });
  }
}
