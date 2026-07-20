"use client";

import { deleteObject, getBlob, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { isFirebaseStorageConfigured, storage } from "@/lib/firebase";
import { compressVehicleImage } from "@/lib/image-processing";
import { PreparedVehicleImageUpload, VehicleImageAsset } from "@/types";

const DEALER_PROOF_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const DEALER_PROOF_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function sanitizeStorageName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
}

async function dataUrlToFile(dataUrl: string, fileName: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

function getFirebaseStorageErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
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

export async function uploadVehicleActivityImages(files: File[], vehicleId: string, activityId: string) {
  if (!files.length) return [];

  if (!vehicleId || !activityId) {
    throw new Error("Vehicle activity image upload requires a vehicle ID and activity ID.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("Image upload is temporarily unavailable. Please try again later.");
  }

  const uploadedUrls: string[] = [];

  for (const [index, file] of files.slice(0, 5).entries()) {
    const optimizedFile = await compressVehicleImage(file, {
      maxWidth: 1200,
      quality: 0.72,
      minQuality: 0.65,
      maxBytes: 250 * 1024,
      outputMimeType: "image/jpeg"
    });

    const storageRef = ref(storage, `activity-updates/${vehicleId}/${activityId}/carnest-update-${index + 1}.jpg`);
    await uploadBytes(storageRef, optimizedFile, {
      contentType: optimizedFile.type || "image/jpeg"
    });
    uploadedUrls.push(await getDownloadURL(storageRef));
  }

  return uploadedUrls;
}

export async function uploadWarehouseIntakeSupportingFile(file: File, intakeId: string, bucket: "licence" | "ownership") {
  if (!file) {
    throw new Error("Select a file before uploading.");
  }

  if (!intakeId) {
    throw new Error("Create the intake record before uploading files.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("File upload is temporarily unavailable. Please try again later.");
  }

  const sanitizedName = sanitizeStorageName(file.name);
  const storageRef = ref(storage, `warehouse-intakes/${intakeId}/${bucket}/${Date.now()}-${sanitizedName}`);
  await uploadBytes(storageRef, file, {
    contentType: file.type || undefined
  });

  return {
    storagePath: storageRef.fullPath,
    name: file.name,
    uploadedAt: new Date().toISOString(),
    contentType: file.type || undefined
  };
}

export async function uploadWarehouseIntakePhotos(
  files: File[],
  intakeId: string,
  category: string,
  label: string,
  options?: {
    maxFiles?: number;
  }
) {
  if (!files.length) return [];
  if (!intakeId) {
    throw new Error("Create the intake record before uploading photos.");
  }
  if (!isFirebaseStorageConfigured) {
    throw new Error("Photo upload is temporarily unavailable. Please try again later.");
  }

  const uploaded = [];

  const uploadLimit = Math.max(1, Math.min(options?.maxFiles ?? 5, 20));

  for (const [index, file] of files.slice(0, uploadLimit).entries()) {
    const optimizedFile = await compressVehicleImage(file, {
      maxWidth: 1200,
      quality: 0.72,
      minQuality: 0.65,
      maxBytes: 300 * 1024,
      outputMimeType: "image/jpeg"
    });

    const storageRef = ref(
      storage,
      `warehouse-intakes/${intakeId}/photos/${category}/${Date.now()}-${index + 1}-${sanitizeStorageName(file.name.replace(/\.[^.]+$/, ""))}.jpg`
    );

    await uploadBytes(storageRef, optimizedFile, {
      contentType: optimizedFile.type || "image/jpeg"
    });

    uploaded.push({
      id: `${category}-${Date.now()}-${index + 1}`,
      category,
      label,
      storagePath: storageRef.fullPath,
      name: file.name,
      uploadedAt: new Date().toISOString(),
      contentType: optimizedFile.type || "image/jpeg"
    });
  }

  return uploaded;
}

export async function uploadWarehouseIntakeSignature(dataUrl: string, intakeId: string) {
  if (!dataUrl) {
    throw new Error("Capture a signature before uploading.");
  }

  if (!intakeId) {
    throw new Error("Create the intake record before uploading the signature.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("Signature upload is temporarily unavailable. Please try again later.");
  }

  const signatureFile = await dataUrlToFile(dataUrl, `signature-${Date.now()}.png`);
  const storageRef = ref(storage, `warehouse-intakes/${intakeId}/signature/${signatureFile.name}`);
  try {
    await uploadBytes(storageRef, signatureFile, {
      contentType: signatureFile.type || "image/png"
    });
  } catch (error) {
    const errorCode = getFirebaseStorageErrorCode(error);
    console.error("[warehouse-intake-signature] Signature upload failed.", {
      intakeId,
      errorCode: errorCode || "unknown"
    });

    if (errorCode === "storage/unauthorized") {
      throw new Error("Unable to upload the signature. Please refresh your admin session and try again.");
    }

    throw error;
  }

  return storageRef.fullPath;
}

export async function uploadWarehouseIntakePdf(pdfBytes: Uint8Array, intakeId: string, fileName: string) {
  if (!pdfBytes.length) {
    throw new Error("Generate the PDF before uploading.");
  }

  if (!intakeId) {
    throw new Error("Create the intake record before uploading the PDF.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("PDF upload is temporarily unavailable. Please try again later.");
  }

  const sanitizedName = sanitizeStorageName(fileName || `carnest-warehouse-intake-${intakeId}.pdf`);
  const normalizedPdfBytes = new Uint8Array(pdfBytes);
  const pdfBlob = new Blob([normalizedPdfBytes], {
    type: "application/pdf"
  });
  const pdfFile = new File([pdfBlob], sanitizedName, { type: "application/pdf" });
  const storageRef = ref(storage, `warehouse-intakes/${intakeId}/pdf/${pdfFile.name}`);
  await uploadBytes(storageRef, pdfFile, {
    contentType: "application/pdf"
  });

  return storageRef.fullPath;
}

export async function uploadVehicleReportPdf(pdfBytes: Uint8Array, vehicleId: string, fileName: string) {
  if (!pdfBytes.length) {
    throw new Error("Generate the report PDF before uploading.");
  }

  if (!vehicleId) {
    throw new Error("A linked public listing is required before uploading the vehicle report PDF.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("PDF upload is temporarily unavailable. Please try again later.");
  }

  const sanitizedName = sanitizeStorageName(fileName || `carnest-vehicle-report-${vehicleId}.pdf`);
  const normalizedPdfBytes = new Uint8Array(pdfBytes);
  const pdfBlob = new Blob([normalizedPdfBytes], {
    type: "application/pdf"
  });
  const pdfFile = new File([pdfBlob], sanitizedName, { type: "application/pdf" });
  const storageRef = ref(storage, `vehicle-reports/${vehicleId}/${pdfFile.name}`);
  await uploadBytes(storageRef, pdfFile, {
    contentType: "application/pdf"
  });

  return storageRef.fullPath;
}

export async function readWarehouseIntakeStorageBlob(storagePath: string) {
  if (!storagePath) {
    throw new Error("Storage path is required.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("File access is temporarily unavailable. Please try again later.");
  }

  const storageRef = ref(storage, storagePath);
  return await getBlob(storageRef);
}

export async function fetchAdminWarehouseIntakeFileBlob(storagePath: string, idToken: string) {
  if (!storagePath) {
    throw new Error("Storage path is required.");
  }

  if (!idToken) {
    throw new Error("Admin authentication token is required.");
  }

  const response = await fetch(`/api/admin/warehouse-intake/file?path=${encodeURIComponent(storagePath)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(errorPayload?.error || "Unable to load the requested intake file.");
  }

  return await response.blob();
}

export async function fetchAdminWarehouseIntakeFileBytes(storagePath: string, idToken: string) {
  const blob = await fetchAdminWarehouseIntakeFileBlob(storagePath, idToken);
  return new Uint8Array(await blob.arrayBuffer());
}

async function readAdminWarehouseIntakeMutationResponse(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error || fallbackMessage);
  }

  return payload;
}

export async function deleteAdminWarehouseIntakePhoto(intakeId: string, photoId: string, idToken: string, deletionReason = "") {
  if (!intakeId || !photoId) {
    throw new Error("Photo deletion requires a storage contract and photo reference.");
  }

  if (!idToken) {
    throw new Error("Admin authentication token is required.");
  }

  const response = await fetch(
    `/api/admin/warehouse-intake/${encodeURIComponent(intakeId)}/photos/${encodeURIComponent(photoId)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ deletionReason }),
      cache: "no-store"
    }
  );

  return await readAdminWarehouseIntakeMutationResponse(response, "Unable to delete this photo right now. Please try again.");
}

export async function deleteAdminWarehouseIntakeDraft(intakeId: string, idToken: string) {
  if (!intakeId) {
    throw new Error("Draft deletion requires a storage contract reference.");
  }

  if (!idToken) {
    throw new Error("Admin authentication token is required.");
  }

  const response = await fetch(
    `/api/admin/warehouse-intake/${encodeURIComponent(intakeId)}/draft`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${idToken}`
      },
      cache: "no-store"
    }
  );

  return await readAdminWarehouseIntakeMutationResponse(
    response,
    "Unable to delete this draft completely. No vehicle or customer record was removed. Please try again or check the admin logs."
  );
}

export async function fetchVehicleReportBlob(storagePath: string) {
  if (!storagePath) {
    throw new Error("Vehicle report is not available yet.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("Vehicle report download is temporarily unavailable. Please try again later.");
  }

  return await getBlob(ref(storage, storagePath));
}

export async function getVehicleReportDownloadUrl(storagePath: string) {
  if (!storagePath) {
    throw new Error("Vehicle report is not available yet.");
  }

  if (!isFirebaseStorageConfigured) {
    throw new Error("Vehicle report download is temporarily unavailable. Please try again later.");
  }

  try {
    return await getDownloadURL(ref(storage, storagePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("storage/retry-limit-exceeded")) {
      throw new Error("Report is taking too long to load. Please try again or regenerate the report.");
    }
    throw error;
  }
}
