import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { getAdminDb } from "@/lib/firebase-admin-server";
import { getVehicleDisplayReference } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeTimestamp(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString() : "";
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return typeof value === "string" ? value : "";
}

function isSafeUserId(value: string) {
  return /^[A-Za-z0-9_-]{3,160}$/.test(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireVerifiedAdminApiAccess(request, "manageAdmins");
    const { id } = await params;
    const userId = id.trim();

    if (!isSafeUserId(userId)) {
      return NextResponse.json({ success: false, error: "Invalid user ID." }, { status: 400 });
    }

    const db = getAdminDb();
    const userSnapshot = await db.collection("users").doc(userId).get();
    if (!userSnapshot.exists) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    const activitySnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("vehicleViewHistory")
      .orderBy("lastViewedAt", "desc")
      .limit(100)
      .get();

    const vehicleIds = activitySnapshot.docs
      .map((documentSnapshot) => String(documentSnapshot.data().vehicleId ?? documentSnapshot.id).trim())
      .filter(Boolean);
    const uniqueVehicleIds = Array.from(new Set(vehicleIds));
    const vehicleSnapshots = await Promise.all(
      uniqueVehicleIds.map(async (vehicleId) => [vehicleId, await db.collection("vehicles").doc(vehicleId).get()] as const)
    );
    const vehiclesById = new Map(vehicleSnapshots);

    const items = activitySnapshot.docs.map((documentSnapshot) => {
      const data = documentSnapshot.data();
      const vehicleId = String(data.vehicleId ?? documentSnapshot.id).trim();
      const listingId = String(data.listingId ?? vehicleId).trim();
      const vehicleSnapshot = vehiclesById.get(vehicleId);
      const vehicleData = vehicleSnapshot?.exists ? vehicleSnapshot.data() ?? {} : null;
      const vehicleAvailable = Boolean(vehicleSnapshot?.exists && !vehicleData?.deleted);

      return {
        id: documentSnapshot.id,
        userId,
        vehicleId,
        listingId,
        firstViewedAt: serializeTimestamp(data.firstViewedAt),
        lastViewedAt: serializeTimestamp(data.lastViewedAt),
        viewCount: Number(data.viewCount ?? 0),
        vehicle: vehicleAvailable
          ? {
              id: vehicleId,
              year: Number(vehicleData?.year ?? 0),
              make: String(vehicleData?.make ?? ""),
              model: String(vehicleData?.model ?? ""),
              variant: String(vehicleData?.variant ?? ""),
              reference: getVehicleDisplayReference({
                id: vehicleId,
                displayReference: typeof vehicleData?.displayReference === "string" ? vehicleData.displayReference : undefined
              }),
              adminHref: `/admin/vehicles/${encodeURIComponent(vehicleId)}`,
              publicHref: `/inventory/${encodeURIComponent(listingId || vehicleId)}`
            }
          : null
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;
    const message = error instanceof Error ? error.message : "Unable to load vehicle viewing activity.";
    console.error("[admin-user-vehicle-view-history] Activity read failed.", {
      status,
      error: message
    });
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
