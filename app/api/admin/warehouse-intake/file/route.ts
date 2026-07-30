import { NextRequest, NextResponse } from "next/server";
import {
  AdminApiAuthError,
  requireVerifiedAdminApiAccess
} from "@/lib/admin-api-auth";
import { getAdminStorageBucket } from "@/lib/firebase-admin-server";
import { extractFirebaseStoragePath } from "@/lib/firebase-storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTECTED_FILE_ACCESS_ERROR =
  "This protected contract file could not be opened with your current access. Please refresh your session or contact a CarNest administrator.";

function sanitizeDownloadName(value: string) {
  return value.replace(/["\r\n\\/]/g, "").trim().slice(0, 180);
}

function getFallbackFileName(storagePath: string) {
  return sanitizeDownloadName(storagePath.split("/").pop() || "warehouse-intake-file");
}

function isSafeWarehouseIntakeStoragePath(storagePath: string) {
  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/") || storagePath.includes("\0")) {
    return false;
  }

  const segments = storagePath.split("/");
  return (
    segments.length >= 3
    && segments[0] === "warehouse-intakes"
    && /^[A-Za-z0-9_-]{8,100}$/.test(segments[1] ?? "")
    && segments.every((segment) => segment.length > 0)
  );
}

async function requireWarehouseFileAccess(request: NextRequest) {
  await requireVerifiedAdminApiAccess(request, "manageVehicles");
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path") ?? "";
  const storagePath = extractFirebaseStoragePath(rawPath);
  if (!isSafeWarehouseIntakeStoragePath(storagePath)) {
    return NextResponse.json({ success: false, error: "Invalid warehouse intake file path." }, { status: 400 });
  }

  const downloadName = sanitizeDownloadName(request.nextUrl.searchParams.get("name") ?? "") || getFallbackFileName(storagePath);
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  try {
    await requireWarehouseFileAccess(request);
    const file = getAdminStorageBucket().file(storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({ success: false, error: "The requested contract file could not be found." }, { status: 404 });
    }

    const [[metadata], [fileBuffer]] = await Promise.all([
      file.getMetadata(),
      file.download()
    ]);
    const contentType = metadata.contentType || "application/octet-stream";
    const responseBody = new Blob([new Uint8Array(fileBuffer)], { type: contentType });

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `${disposition}; filename="${downloadName}"`
      }
    });
  } catch (error) {
    const status = error instanceof AdminApiAuthError ? error.status : 500;
    console.error("[warehouse-intake-file] Failed to load private intake file.", {
      storagePath,
      status,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      {
        success: false,
        error: status === 401 || status === 403
          ? PROTECTED_FILE_ACCESS_ERROR
          : "Unable to load the requested contract file right now."
      },
      { status }
    );
  }
}
