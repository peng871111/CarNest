import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin-server";

function isSafeCommunityMomentId(id: string) {
  return /^[A-Za-z0-9_-]{8,80}$/.test(id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireVerifiedAdminApiAccess(request, "manageVehicles");
    const { id } = await params;

    if (!id || !isSafeCommunityMomentId(id)) {
      return NextResponse.json({ success: false, error: "Invalid Community moment ID." }, { status: 400 });
    }

    const db = getAdminDb();
    const momentRef = db.collection("communityMoments").doc(id);
    const snapshot = await momentRef.get();

    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: "Community moment not found." }, { status: 404 });
    }

    const prefix = `community/${id}/`;
    const bucket = getAdminStorageBucket();
    const [files] = await bucket.getFiles({ prefix });
    const invalidFile = files.find((file) => !file.name.startsWith(prefix));

    if (invalidFile) {
      console.error("[community] Unsafe delete prefix result.", {
        momentId: id,
        fileName: invalidFile.name,
      });
      return NextResponse.json(
        { success: false, error: "Unable to delete this Community moment safely." },
        { status: 500 }
      );
    }

    const deleteResults = await Promise.allSettled(files.map((file) => file.delete()));
    const failedDeletes = deleteResults.filter((result) => result.status === "rejected");

    if (failedDeletes.length) {
      console.error("[community] Community image deletion failed.", {
        momentId: id,
        failedCount: failedDeletes.length,
      });
      return NextResponse.json(
        { success: false, error: "Unable to delete this Community moment completely. Please try again." },
        { status: 500 }
      );
    }

    await momentRef.delete();

    return NextResponse.json({
      success: true,
      message: "Community moment deleted.",
      deletedFiles: files.length,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;

    console.error("[community] Delete Community moment failed.", {
      status,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Unable to delete this Community moment right now." },
      { status }
    );
  }
}
