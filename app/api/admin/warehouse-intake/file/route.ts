import { NextRequest, NextResponse } from "next/server";
import { hasAdminApiAccess, getBearerToken } from "@/lib/admin-api-auth";
import { fetchPrivateWarehouseIntakeStorageObject } from "@/lib/warehouse-intake-storage-server";
import { extractFirebaseStoragePath } from "@/lib/firebase-storage-paths";

export async function GET(request: NextRequest) {
  if (!hasAdminApiAccess(request, "manageVehicles")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const idToken = getBearerToken(request);
  if (!idToken) {
    return NextResponse.json({ success: false, error: "Missing Firebase ID token." }, { status: 401 });
  }

  const rawPath = request.nextUrl.searchParams.get("path") ?? "";
  const storagePath = extractFirebaseStoragePath(rawPath);
  if (!storagePath || !storagePath.startsWith("warehouse-intakes/")) {
    return NextResponse.json({ success: false, error: "Invalid warehouse intake file path." }, { status: 400 });
  }

  const downloadName = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  try {
    const storageResponse = await fetchPrivateWarehouseIntakeStorageObject(storagePath, idToken);
    const contentType = storageResponse.headers.get("content-type") || "application/octet-stream";
    const fileBuffer = await storageResponse.arrayBuffer();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        ...(downloadName ? { "Content-Disposition": `${disposition}; filename="${downloadName.replace(/"/g, "")}"` } : {})
      }
    });
  } catch (error) {
    console.error("[warehouse-intake-file] Failed to load private intake file.", {
      storagePath,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load the requested intake file."
      },
      { status: 502 }
    );
  }
}
