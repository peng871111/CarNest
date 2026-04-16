"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
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
