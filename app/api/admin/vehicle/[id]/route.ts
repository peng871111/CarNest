import { NextRequest, NextResponse } from "next/server";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, where, writeBatch } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

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
  collectionName: string,
  vehicleId: string
) {
  let deletedCount = 0;

  while (true) {
    const snapshot = await getDocs(
      query(collection(db, collectionName), where("vehicleId", "==", vehicleId), limit(200))
    );

    if (snapshot.empty) {
      break;
    }

    const batch = writeBatch(db);
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

  if (!isFirebaseConfigured) {
    return NextResponse.json({ success: false, error: "Firestore is not configured." }, { status: 503 });
  }

  try {
    const vehicleRef = doc(db, "vehicles", id);
    const vehicleSnapshot = await getDoc(vehicleRef);

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
      deleteDocsByVehicleId("vehicleActivityEvents", id),
      deleteDocsByVehicleId("vehicleViewEvents", id),
      deleteDocsByVehicleId("vehicleViewVisitors", id),
      deleteDocsByVehicleId("offers", id),
      deleteDocsByVehicleId("inspectionRequests", id),
      deleteDocsByVehicleId("savedVehicles", id)
    ]);

    const cleanupBatch = writeBatch(db);
    cleanupBatch.delete(vehicleRef);
    cleanupBatch.delete(doc(db, "vehicleAnalytics", id));
    cleanupBatch.delete(doc(db, "vehicle_private", id));
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
