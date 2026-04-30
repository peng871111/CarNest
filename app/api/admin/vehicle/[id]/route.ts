import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

function parsePermissions(value?: string) {
  if (!value) return {} as Record<string, boolean>;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, Boolean(entry)]));
  } catch {
    return {} as Record<string, boolean>;
  }
}

function canPermanentlyDeleteVehicle(request: NextRequest) {
  const role = request.cookies.get("carnest_role")?.value;
  const session = request.cookies.get("carnest_session")?.value;
  const permissions = parsePermissions(request.cookies.get("carnest_permissions")?.value);

  if (!session) return false;
  if (role === "super_admin") return true;
  return role === "admin" && Boolean(permissions.deleteListings);
}

async function deleteDocsByVehicleId(
  adminDb: NonNullable<ReturnType<typeof getAdminDb>>,
  collectionName: string,
  vehicleId: string
) {
  let deletedCount = 0;

  while (true) {
    const snapshot = await adminDb
      .collection(collectionName)
      .where("vehicleId", "==", vehicleId)
      .limit(200)
      .get();

    if (snapshot.empty) {
      break;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    deletedCount += snapshot.size;
    await batch.commit();
  }

  return deletedCount;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!canPermanentlyDeleteVehicle(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ success: false, error: "Vehicle id is required." }, { status: 400 });
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({ success: false, error: "Admin Firestore is not configured." }, { status: 503 });
  }

  try {
    const vehicleRef = adminDb.collection("vehicles").doc(id);
    const vehicleSnapshot = await vehicleRef.get();

    if (!vehicleSnapshot.exists) {
      return NextResponse.json({ success: false, error: "Vehicle not found." }, { status: 404 });
    }

    const [
      deletedActivityEvents,
      deletedViewEvents,
      deletedViewVisitors,
      deletedOffers,
      deletedInspectionRequests,
      deletedSavedVehicles
    ] = await Promise.all([
      deleteDocsByVehicleId(adminDb, "vehicleActivityEvents", id),
      deleteDocsByVehicleId(adminDb, "vehicleViewEvents", id),
      deleteDocsByVehicleId(adminDb, "vehicleViewVisitors", id),
      deleteDocsByVehicleId(adminDb, "offers", id),
      deleteDocsByVehicleId(adminDb, "inspectionRequests", id),
      deleteDocsByVehicleId(adminDb, "savedVehicles", id)
    ]);

    const cleanupBatch = adminDb.batch();
    cleanupBatch.delete(vehicleRef);
    cleanupBatch.delete(adminDb.collection("vehicleAnalytics").doc(id));
    cleanupBatch.delete(adminDb.collection("vehicle_private").doc(id));
    await cleanupBatch.commit();

    return NextResponse.json({
      success: true,
      deletedVehicleId: id,
      cleanup: {
        activityEvents: deletedActivityEvents,
        viewEvents: deletedViewEvents,
        viewVisitors: deletedViewVisitors,
        offers: deletedOffers,
        inspectionRequests: deletedInspectionRequests,
        savedVehicles: deletedSavedVehicles
      }
    });
  } catch (error) {
    console.error("[admin-vehicle-delete] Permanent delete failed.", {
      vehicleId: id,
      reason: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to permanently delete vehicle."
      },
      { status: 500 }
    );
  }
}
