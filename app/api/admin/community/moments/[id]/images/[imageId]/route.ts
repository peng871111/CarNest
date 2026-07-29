import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin-server";
import type { CommunityMomentImage } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMUNITY_MAX_IMAGES = 12;
const COMMUNITY_LEGACY_PRIMARY_IMAGE_ID = "legacy-primary";

function isSafeCommunityId(value: string) {
  return /^[A-Za-z0-9_-]{3,120}$/.test(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serializeDate(value: unknown) {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
  }
  return new Date().toISOString();
}

function normalizeImage(value: unknown, fallbackId: string): CommunityMomentImage | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const id = normalizeString(data.id) || fallbackId;
  const originalPath = normalizeString(data.originalPath);
  const displayPath = normalizeString(data.displayPath);
  const thumbnailPath = normalizeString(data.thumbnailPath);
  const displayUrl = normalizeString(data.displayUrl);
  const thumbnailUrl = normalizeString(data.thumbnailUrl);

  if (!isSafeCommunityId(id) || !originalPath || !displayPath || !thumbnailPath || !displayUrl || !thumbnailUrl) {
    return null;
  }

  return {
    id,
    originalPath,
    displayPath,
    thumbnailPath,
    displayUrl,
    thumbnailUrl,
    originalFileName: normalizeString(data.originalFileName) || "community-photo",
    contentType: normalizeString(data.contentType) || "image/jpeg",
    displayWidth: typeof data.displayWidth === "number" ? data.displayWidth : 1600,
    displayHeight: typeof data.displayHeight === "number" ? data.displayHeight : 1000,
    thumbnailWidth: typeof data.thumbnailWidth === "number" ? data.thumbnailWidth : 760,
    thumbnailHeight: typeof data.thumbnailHeight === "number" ? data.thumbnailHeight : 480,
    uploadedAt: serializeDate(data.uploadedAt),
  };
}

function getMomentImages(data: Record<string, unknown>) {
  const seen = new Set<string>();
  const images = Array.isArray(data.images)
    ? data.images
      .map((item, index) => normalizeImage(item, `community-image-${index + 1}`))
      .filter((item): item is CommunityMomentImage => Boolean(item))
    : [];
  const legacyImage = normalizeImage(data.image, COMMUNITY_LEGACY_PRIMARY_IMAGE_ID);
  const normalizedImages = images.length ? images : legacyImage ? [legacyImage] : [];

  return normalizedImages
    .filter((image) => {
      if (seen.has(image.id)) return false;
      seen.add(image.id);
      return true;
    })
    .slice(0, COMMUNITY_MAX_IMAGES);
}

function isSafeImageStoragePath(momentId: string, imageId: string, storagePath: string) {
  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/")) return false;
  if (!storagePath.startsWith(`community/${momentId}/`)) return false;

  const newImagePrefix = `community/${momentId}/images/${imageId}/`;
  const legacyPrefixes = [
    `community/${momentId}/original/`,
    `community/${momentId}/display/`,
    `community/${momentId}/thumbnail/`,
  ];

  return storagePath.startsWith(newImagePrefix) || legacyPrefixes.some((prefix) => storagePath.startsWith(prefix));
}

async function deleteStoragePath(storagePath: string) {
  const bucket = getAdminStorageBucket();

  try {
    await bucket.file(storagePath).delete();
    return { storagePath, deleted: true };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number((error as { code?: unknown }).code) : 0;
    if (code === 404) {
      console.warn("[community-image-delete] Community image file already missing.", { storagePath });
      return { storagePath, deleted: false, missing: true };
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;

  try {
    const admin = await requireVerifiedAdminApiAccess(request, "manageVehicles");

    if (!isSafeCommunityId(id) || !isSafeCommunityId(imageId)) {
      return NextResponse.json({ success: false, error: "Invalid Community photo ID." }, { status: 400 });
    }

    const db = getAdminDb();
    const momentRef = db.collection("communityMoments").doc(id);
    const snapshot = await momentRef.get();

    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: "Community moment not found." }, { status: 404 });
    }

    const data = snapshot.data() ?? {};
    const images = getMomentImages(data);
    const imageToDelete = images.find((image) => image.id === imageId);

    if (!imageToDelete) {
      return NextResponse.json({ success: false, error: "Community photo not found." }, { status: 404 });
    }

    const isPublished = data.status === "published" && data.published === true;
    if (isPublished && images.length <= 1) {
      return NextResponse.json(
        { success: false, error: "Unpublish or delete this Moment before removing its final photo." },
        { status: 400 }
      );
    }

    if (images.length <= 1) {
      return NextResponse.json(
        { success: false, error: "Delete the Community Moment instead of removing its final photo." },
        { status: 400 }
      );
    }

    const targetPaths = [
      imageToDelete.originalPath,
      imageToDelete.displayPath,
      imageToDelete.thumbnailPath,
    ];
    const unsafePath = targetPaths.find((path) => !isSafeImageStoragePath(id, imageId, path));

    if (unsafePath) {
      console.error("[community-image-delete] Unsafe Community image path rejected.", {
        momentId: id,
        imageId,
        pathPrefix: unsafePath.slice(0, 80),
      });
      return NextResponse.json({ success: false, error: "Unable to delete this photo safely." }, { status: 400 });
    }

    const deleteResults = await Promise.allSettled(targetPaths.map((path) => deleteStoragePath(path)));
    const failedDeletes = deleteResults.filter((result) => result.status === "rejected");

    if (failedDeletes.length) {
      console.error("[community-image-delete] Community image file deletion failed.", {
        momentId: id,
        imageId,
        failedCount: failedDeletes.length,
      });
      return NextResponse.json(
        { success: false, error: "Unable to delete this photo right now. Please try again." },
        { status: 500 }
      );
    }

    const remainingImages = images.filter((image) => image.id !== imageId);
    const currentCoverImageId = normalizeString(data.coverImageId);
    const coverImage = remainingImages.find((image) => image.id === currentCoverImageId) ?? remainingImages[0];

    await momentRef.update({
      image: coverImage,
      images: remainingImages,
      coverImageId: coverImage.id,
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "Photo deleted.",
      image: coverImage,
      images: remainingImages,
      coverImageId: coverImage.id,
    });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("[community-image-delete] Unexpected delete failure.", {
      momentId: id,
      imageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Unable to delete this photo right now. Please try again." },
      { status: 500 }
    );
  }
}
