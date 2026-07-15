import { NextRequest, NextResponse } from "next/server";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { deleteWarehouseIntakeDraft, WarehouseIntakeDeleteError } from "@/lib/warehouse-intake-delete-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DRAFT_DELETE_FAILURE_MESSAGE =
  "Unable to delete this draft completely. No vehicle or customer record was removed. Please try again or check the admin logs.";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const admin = await requireVerifiedAdminApiAccess(request, "manageVehicles");
    const result = await deleteWarehouseIntakeDraft({
      intakeId: id,
      actorUid: admin.uid,
      actorEmail: admin.email,
    });

    return NextResponse.json({
      success: true,
      message: "Storage contract draft deleted.",
      result,
    });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    if (error instanceof WarehouseIntakeDeleteError) {
      console.error("[warehouse-intake-draft-delete] Delete failed.", {
        intakeId: id,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        {
          success: false,
          error: error.code === "evidence_locked" ? error.message : DRAFT_DELETE_FAILURE_MESSAGE,
        },
        { status: error.status }
      );
    }

    console.error("[warehouse-intake-draft-delete] Unexpected delete failure.", {
      intakeId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: DRAFT_DELETE_FAILURE_MESSAGE }, { status: 500 });
  }
}
