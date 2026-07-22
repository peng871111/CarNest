import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { updateAdminAccessForUser } from "@/lib/admin-access-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireVerifiedAdminApiAccess(request, "manageAdmins");
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!id?.trim()) {
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Invalid admin access payload." }, { status: 400 });
    }

    const user = await updateAdminAccessForUser({
      userId: id,
      role: (body as { role?: unknown }).role,
      adminPermissions: (body as { adminPermissions?: unknown }).adminPermissions,
      actor: {
        id: actor.uid,
        role: actor.role,
        email: actor.email,
        adminPermissions: actor.adminPermissions,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Admin access updated successfully.",
      user,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;
    const message = error instanceof Error ? error.message : "Unable to update admin access.";

    console.error("[admin-users-access] Access update failed.", {
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
