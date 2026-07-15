import { NextRequest, NextResponse } from "next/server";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { deleteWarehouseIntakePhoto, WarehouseIntakeDeleteError } from "@/lib/warehouse-intake-delete-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { id, photoId } = await params;

  try {
    const admin = await requireVerifiedAdminApiAccess(request, "manageVehicles");
    const body = await request.json().catch(() => null) as { deletionReason?: unknown } | null;
    const deletionReason = typeof body?.deletionReason === "string" ? body.deletionReason : undefined;
    const result = await deleteWarehouseIntakePhoto({
      intakeId: id,
      photoId,
      actorUid: admin.uid,
      actorEmail: admin.email,
      deletionReason,
    });

    return NextResponse.json({
      success: true,
      message: "Photo deleted.",
      result,
    });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    if (error instanceof WarehouseIntakeDeleteError) {
      console.error("[warehouse-intake-photo-delete] Delete failed.", {
        intakeId: id,
        photoId,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        {
          success: false,
          error: error.code === "listing_linked" || error.code === "protected_photo"
            ? error.message
            : "Unable to delete this photo right now. Please try again.",
        },
        { status: error.status }
      );
    }

    console.error("[warehouse-intake-photo-delete] Unexpected delete failure.", {
      intakeId: id,
      photoId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Unable to delete this photo right now. Please try again." },
      { status: 500 }
    );
  }
}
