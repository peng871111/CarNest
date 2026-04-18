"use client";

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { isFirebaseStorageConfigured, storage } from "@/lib/firebase";

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
