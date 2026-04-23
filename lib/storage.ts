"use client";

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { isFirebaseStorageConfigured, storage } from "@/lib/firebase";

const DEALER_PROOF_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const DEALER_PROOF_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export async function uploadVehicleImages(files: File[], ownerUid: string) {
  if (!files.length) return [];

  if (!isFirebaseStorageConfigured) {
    return [];
  }

  const uploaded = await Promise.all(
    files.map(async (file) => {
      const sanitizedName = file.name.replace(/\s+/g, "-").toLowerCase();
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

  const sanitizedName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
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

      const sanitizedName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
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
