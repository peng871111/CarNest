"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { isFirebaseStorageConfigured, storage } from "@/lib/firebase";
import { compressVehicleImage } from "@/lib/image-processing";
import type { CommunityMomentImage } from "@/types";

const ALLOWED_COMMUNITY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_COMMUNITY_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function sanitizeStorageName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.trim().toLowerCase() ?? "";
}

function getStorageExtension(file: File) {
  const extension = getFileExtension(file.name);
  if (extension === "jpeg") return "jpg";
  if (extension && ALLOWED_COMMUNITY_IMAGE_EXTENSIONS.has(extension)) return extension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function getImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the selected Community image."));
    };

    image.src = objectUrl;
  });
}

export function validateCommunityImageFile(file?: File | null) {
  if (!file) {
    throw new Error("Select a Community photo before uploading.");
  }

  const extension = getFileExtension(file.name);
  const isHeic =
    file.type === "image/heic"
    || file.type === "image/heif"
    || extension === "heic"
    || extension === "heif";

  if (isHeic) {
    throw new Error("HEIC photos are not supported yet. Please upload a JPG, PNG or WebP image.");
  }

  if (!ALLOWED_COMMUNITY_IMAGE_TYPES.has(file.type) && !ALLOWED_COMMUNITY_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error("Please upload a JPG, PNG or WebP image.");
  }
}

export async function uploadCommunityMomentImage(file: File, momentId: string): Promise<CommunityMomentImage> {
  validateCommunityImageFile(file);

  if (!momentId) {
    throw new Error("Create the Community moment before uploading a photo.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("Community image upload is temporarily unavailable. Please try again later.");
  }

  const timestamp = Date.now();
  const baseName = sanitizeStorageName(file.name.replace(/\.[^.]+$/, "")) || "community-photo";
  const originalExtension = getStorageExtension(file);
  const originalPath = `community/${momentId}/original/${timestamp}-${baseName}.${originalExtension}`;

  const displayFile = await compressVehicleImage(file, {
    maxWidth: 2400,
    quality: 0.86,
    minQuality: 0.76,
    maxBytes: 900 * 1024,
    outputMimeType: "image/webp",
  });
  const thumbnailFile = await compressVehicleImage(file, {
    maxWidth: 760,
    quality: 0.72,
    minQuality: 0.58,
    maxBytes: 140 * 1024,
    outputMimeType: "image/webp",
  });

  const [displayDimensions, thumbnailDimensions] = await Promise.all([
    getImageDimensions(displayFile),
    getImageDimensions(thumbnailFile),
  ]);

  const displayExtension = displayFile.type === "image/webp" ? "webp" : "jpg";
  const thumbnailExtension = thumbnailFile.type === "image/webp" ? "webp" : "jpg";
  const displayPath = `community/${momentId}/display/${timestamp}-display.${displayExtension}`;
  const thumbnailPath = `community/${momentId}/thumbnail/${timestamp}-thumbnail.${thumbnailExtension}`;

  const originalRef = ref(storage, originalPath);
  const displayRef = ref(storage, displayPath);
  const thumbnailRef = ref(storage, thumbnailPath);

  await Promise.all([
    uploadBytes(originalRef, file, {
      contentType: file.type || "image/jpeg",
    }),
    uploadBytes(displayRef, displayFile, {
      contentType: displayFile.type || "image/webp",
    }),
    uploadBytes(thumbnailRef, thumbnailFile, {
      contentType: thumbnailFile.type || "image/webp",
    }),
  ]);

  const [displayUrl, thumbnailUrl] = await Promise.all([
    getDownloadURL(displayRef),
    getDownloadURL(thumbnailRef),
  ]);

  return {
    originalPath,
    displayPath,
    thumbnailPath,
    displayUrl,
    thumbnailUrl,
    originalFileName: file.name,
    contentType: file.type || "image/jpeg",
    displayWidth: displayDimensions.width,
    displayHeight: displayDimensions.height,
    thumbnailWidth: thumbnailDimensions.width,
    thumbnailHeight: thumbnailDimensions.height,
    uploadedAt: new Date().toISOString(),
  };
}
