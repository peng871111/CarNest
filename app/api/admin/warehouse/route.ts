import { NextRequest, NextResponse } from "next/server";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import {
  bootstrapWarehousePms,
  checkInWarehousePmsBooking,
  checkOutWarehousePmsBooking,
  createWarehousePmsBooking,
  extendWarehousePmsBooking,
  loadWarehousePmsSnapshot,
  updateWarehousePmsBay,
  updateWarehousePmsSettings,
  upsertWarehousePmsManagedOccupancy,
  WarehousePmsError
} from "@/lib/warehouse-pms-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failureResponse(error: unknown) {
  if (error instanceof AdminApiAuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  if (error instanceof WarehousePmsError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code, details: error.details },
      { status: error.status }
    );
  }
  console.error("[warehouse-pms-api] Unexpected failure", error);
  return NextResponse.json({ success: false, error: "Unable to process the Warehouse request." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireVerifiedAdminApiAccess(request, "manageVehicles");
    return NextResponse.json({ success: true, snapshot: await loadWarehousePmsSnapshot() });
  } catch (error) {
    return failureResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireVerifiedAdminApiAccess(request, "manageVehicles");
    const body = await request.json() as { action?: string; [key: string]: unknown };
    const action = body.action;

    if (action === "bootstrap") {
      await bootstrapWarehousePms(admin.uid);
      return NextResponse.json({ success: true });
    }
    if (action === "create_booking") {
      return NextResponse.json({ success: true, booking: await createWarehousePmsBooking(body, admin.uid) });
    }
    if (action === "check_in") {
      await checkInWarehousePmsBooking(String(body.bookingId || ""), String(body.bayId || ""), admin.uid);
      return NextResponse.json({ success: true });
    }
    if (action === "check_out") {
      await checkOutWarehousePmsBooking(String(body.bookingId || ""), body, admin.uid);
      return NextResponse.json({ success: true });
    }
    if (action === "extend") {
      await extendWarehousePmsBooking(String(body.bookingId || ""), body.newPlannedCollectionAt, admin.uid);
      return NextResponse.json({ success: true });
    }
    if (action === "update_bay") {
      await updateWarehousePmsBay(String(body.bayId || ""), body);
      return NextResponse.json({ success: true });
    }
    if (action === "update_settings") {
      await updateWarehousePmsSettings(body);
      return NextResponse.json({ success: true });
    }
    if (action === "assign_managed_bay") {
      await upsertWarehousePmsManagedOccupancy(body, admin.uid);
      return NextResponse.json({ success: true });
    }

    throw new WarehousePmsError("Unknown Warehouse action.");
  } catch (error) {
    return failureResponse(error);
  }
}
