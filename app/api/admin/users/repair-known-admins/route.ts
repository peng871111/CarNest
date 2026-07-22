import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { repairKnownAdminAccess } from "@/lib/admin-access-server";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireVerifiedAdminApiAccess(request, "manageAdmins");
    const results = await repairKnownAdminAccess({
      actor: {
        id: actor.uid,
        role: actor.role,
        email: actor.email,
        adminPermissions: actor.adminPermissions,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Known admin access repaired successfully.",
      results,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;
    const message = error instanceof Error ? error.message : "Unable to repair known admin access.";

    console.error("[admin-users-repair-known-admins] Repair failed.", {
      status,
      error: message,
    });

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
