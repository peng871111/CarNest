"use client";

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { isFirebaseStorageConfigured, storage } from "@/lib/firebase";
import { PreparedVehicleImageUpload, VehicleImageAsset } from "@/types";

const DEALER_PROOF_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const DEALER_PROOF_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function sanitizeStorageName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
}

export async function uploadVehicleImageAssets(images: PreparedVehicleImageUpload[], ownerUid: string): Promise<VehicleImageAsset[]> {
  if (!images.length) return [];

  if (!isFirebaseStorageConfigured) {
    return [];
  }

  const batchPrefix = `${Date.now()}`;

  return Promise.all(
    images.map(async (image, index) => {
      const baseName = sanitizeStorageName(image.sourceName.replace(/\.[^.]+$/, ""));
      const thumbnailExtension = image.thumbnailFile.name.split(".").pop() || "webp";
      const fullExtension = image.fullFile.name.split(".").pop() || "webp";

      const thumbnailRef = ref(storage, `vehicle-images/${ownerUid}/${batchPrefix}-${index}-${baseName}-thumb.${thumbnailExtension}`);
      const fullRef = ref(storage, `vehicle-images/${ownerUid}/${batchPrefix}-${index}-${baseName}-full.${fullExtension}`);

      await Promise.all([
        uploadBytes(thumbnailRef, image.thumbnailFile, {
          contentType: image.thumbnailFile.type || undefined
        }),
        uploadBytes(fullRef, image.fullFile, {
          contentType: image.fullFile.type || undefined
        })
      ]);

      const [thumbnailUrl, fullUrl] = await Promise.all([getDownloadURL(thumbnailRef), getDownloadURL(fullRef)]);
      return {
        thumbnailUrl,
        fullUrl
      };
    })
  );
}

export async function uploadVehicleImages(files: File[], ownerUid: string) {
  if (!files.length) return [];

  if (!isFirebaseStorageConfigured) {
    return [];
  }

  const uploaded = await Promise.all(
    files.map(async (file) => {
      const sanitizedName = sanitizeStorageName(file.name);
      const storageRef = ref(storage, `vehicle-images/${ownerUid}/${Date.now()}-${sanitizedName}`);
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    })
  );

  return uploaded;
}

function isAllowedDealerProofFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    DEALER_PROOF_ALLOWED_TYPES.includes(file.type)
    || DEALER_PROOF_ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  );
}

export async function uploadDealerProof(file: File, applicantUid: string) {
  if (!file) {
    throw new Error("Upload the LMCT proof document before submitting.");
  }

  if (!isAllowedDealerProofFile(file)) {
    throw new Error("LMCT proof must be a PDF, JPG, JPEG, or PNG file.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("Document upload is temporarily unavailable. Please try again later.");
  }

  const sanitizedName = sanitizeStorageName(file.name);
  const storageRef = ref(storage, `dealer-proofs/${applicantUid}/${Date.now()}-${sanitizedName}`);
  await uploadBytes(storageRef, file, {
    contentType: file.type || undefined
  });

  return getDownloadURL(storageRef);
}

export async function uploadDealerAdditionalDocuments(files: File[], applicantUid: string) {
  if (!files.length) return [];

  if (!isFirebaseStorageConfigured) {
    throw new Error("Document upload is temporarily unavailable. Please try again later.");
  }

  return Promise.all(
    files.map(async (file) => {
      if (!isAllowedDealerProofFile(file)) {
        throw new Error("Additional documents must be PDF, JPG, JPEG, or PNG files.");
      }

      const sanitizedName = sanitizeStorageName(file.name);
      const storageRef = ref(storage, `dealer-proofs/${applicantUid}/additional/${Date.now()}-${sanitizedName}`);
      await uploadBytes(storageRef, file, {
        contentType: file.type || undefined
      });

      return {
        url: await getDownloadURL(storageRef),
        name: file.name,
        contentType: file.type || undefined
      };
    })
  );
}

function isManagedVehicleImageUrl(imageUrl: string) {
  try {
    const parsedUrl = new URL(imageUrl);
    return (
      (parsedUrl.hostname === "firebasestorage.googleapis.com" || parsedUrl.hostname === "storage.googleapis.com")
      && imageUrl.includes("/vehicle-images/")
    );
  } catch {
    return imageUrl.startsWith("gs://") && imageUrl.includes("/vehicle-images/");
  }
}

export async function deleteVehicleImageFile(imageUrl: string) {
  if (!imageUrl || !isFirebaseStorageConfigured || !isManagedVehicleImageUrl(imageUrl)) {
    return false;
  }

  try {
    await deleteObject(ref(storage, imageUrl));
    return true;
  } catch {
    return false;
  }
}

export async function deleteVehicleImageFiles(imageUrls: string[]) {
  const uniqueUrls = Array.from(new Set(imageUrls.filter(Boolean)));
  if (!uniqueUrls.length) return false;

  const results = await Promise.all(uniqueUrls.map((imageUrl) => deleteVehicleImageFile(imageUrl)));
  return results.every(Boolean);
}
