import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getBearerToken } from "@/lib/admin-api-auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSafeDocumentId(value: string) {
  return /^[A-Za-z0-9_-]{3,160}$/.test(value);
}

function isCustomerRole(role: unknown) {
  return role === "buyer" || role === "seller" || role === "dealer";
}

export async function POST(request: NextRequest) {
  try {
    const idToken = getBearerToken(request);
    if (!idToken) {
      return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
    if (!decodedToken?.uid) {
      return NextResponse.json({ success: false, error: "Authentication has expired." }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as { vehicleId?: unknown; listingId?: unknown } | null;
    const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId.trim() : "";
    const listingId = typeof body?.listingId === "string" && body.listingId.trim() ? body.listingId.trim() : vehicleId;

    if (!isSafeDocumentId(vehicleId) || !isSafeDocumentId(listingId)) {
      return NextResponse.json({ success: false, error: "Invalid vehicle activity payload." }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(decodedToken.uid);
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists || !isCustomerRole(userSnapshot.data()?.role)) {
      return NextResponse.json({ success: true, tracked: false });
    }

    const vehicleRef = db.collection("vehicles").doc(vehicleId);
    const activityRef = userRef.collection("vehicleViewHistory").doc(vehicleId);

    const tracked = await db.runTransaction(async (transaction) => {
      const [vehicleSnapshot, activitySnapshot] = await Promise.all([
        transaction.get(vehicleRef),
        transaction.get(activityRef)
      ]);

      if (!vehicleSnapshot.exists) return false;

      const currentViewCount = Number(activitySnapshot.data()?.viewCount ?? 0);
      transaction.set(
        activityRef,
        {
          userId: decodedToken.uid,
          vehicleId,
          listingId,
          ...(activitySnapshot.exists ? {} : { firstViewedAt: FieldValue.serverTimestamp() }),
          lastViewedAt: FieldValue.serverTimestamp(),
          viewCount: currentViewCount + 1
        },
        { merge: true }
      );

      return true;
    });

    if (!tracked) {
      return NextResponse.json({ success: false, error: "Vehicle not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, tracked: true });
  } catch (error) {
    console.error("[vehicle-view-history] Failed to track registered-user vehicle view.", {
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
