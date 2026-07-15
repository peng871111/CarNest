import "server-only";

import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin-server";
import { extractFirebaseStoragePath } from "@/lib/firebase-storage-paths";
import {
  canDeleteWarehouseIntakeDraftRecord,
  canDeleteWarehouseIntakePhotos,
} from "@/lib/warehouse-intake-evidence";

type WarehouseIntakeRawData = Record<string, unknown>;

export class WarehouseIntakeDeleteError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "warehouse_intake_delete_failed") {
    super(message);
    this.name = "WarehouseIntakeDeleteError";
    this.status = status;
    this.code = code;
  }
}

function isSafeWarehouseIntakeId(value: string) {
  return /^[A-Za-z0-9_-]{6,180}$/.test(value);
}

function getStorageErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const statusCode = "statusCode" in error ? String((error as { statusCode?: unknown }).statusCode ?? "") : "";
  return code || statusCode;
}

function isStorageObjectMissing(error: unknown) {
  const code = getStorageErrorCode(error);
  return code === "404" || code.toLowerCase() === "not-found";
}

function normalizeIntakeStoragePath(value: unknown, intakeId: string) {
  const storagePath = extractFirebaseStoragePath(typeof value === "string" ? value : "");
  const expectedPrefix = `warehouse-intakes/${intakeId}/`;

  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/") || !storagePath.startsWith(expectedPrefix)) {
    return "";
  }

  return storagePath;
}

function getRawPhotos(data: WarehouseIntakeRawData) {
  return Array.isArray(data.photos)
    ? (data.photos as Array<Record<string, unknown>>).filter((photo) => typeof photo.id === "string")
    : [];
}

function removePhotoIdFromDamageRecords(data: WarehouseIntakeRawData, photoId: string) {
  const vehicleReport = data.vehicleReport && typeof data.vehicleReport === "object"
    ? data.vehicleReport as Record<string, unknown>
    : {};
  const damageRecords = Array.isArray(vehicleReport.damageRecords)
    ? vehicleReport.damageRecords as Array<Record<string, unknown>>
    : [];

  return damageRecords.map((record) => ({
    ...record,
    photoIds: Array.isArray(record.photoIds)
      ? record.photoIds.filter((entry) => entry !== photoId)
      : [],
  }));
}

function hasBuyerFacingReport(data: WarehouseIntakeRawData) {
  const vehicleReport = data.vehicleReport && typeof data.vehicleReport === "object"
    ? data.vehicleReport as Record<string, unknown>
    : {};
  const categories = vehicleReport.conditionCategories && typeof vehicleReport.conditionCategories === "object"
    ? vehicleReport.conditionCategories as Record<string, unknown>
    : {};
  const exterior = categories.exteriorBody && typeof categories.exteriorBody === "object"
    ? categories.exteriorBody as Record<string, unknown>
    : {};
  const interior = categories.interiorCondition && typeof categories.interiorCondition === "object"
    ? categories.interiorCondition as Record<string, unknown>
    : {};

  return Boolean(String(exterior.score ?? "").trim() && String(interior.score ?? "").trim());
}

function getStringField(data: WarehouseIntakeRawData, key: string) {
  return typeof data[key] === "string" ? data[key] as string : "";
}

async function deleteStorageObject(storagePath: string) {
  try {
    await getAdminStorageBucket().file(storagePath).delete();
    return { deleted: true, missing: false };
  } catch (error) {
    if (isStorageObjectMissing(error)) {
      console.warn("[warehouse-intake-delete] Storage object was already missing.", { storagePath });
      return { deleted: false, missing: true };
    }
    throw error;
  }
}

async function collectSubcollectionDocumentRefs(ref: DocumentReference) {
  const collected: DocumentReference[] = [];
  const collections = await ref.listCollections();

  for (const collectionRef of collections) {
    const snapshot = await collectionRef.get();
    for (const docSnapshot of snapshot.docs) {
      collected.push(docSnapshot.ref);
      collected.push(...await collectSubcollectionDocumentRefs(docSnapshot.ref));
    }
  }

  return collected;
}

async function deleteDocumentRefsInBatches(refs: DocumentReference[]) {
  const db = getAdminDb();

  for (let index = 0; index < refs.length; index += 450) {
    const batch = db.batch();
    refs.slice(index, index + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function hasOtherBuyerFacingIntakeForVehicle(vehicleId: string, deletedIntakeId: string) {
  if (!vehicleId) return false;

  const snapshot = await getAdminDb()
    .collection("warehouseIntakes")
    .where("vehicleId", "==", vehicleId)
    .get();

  return snapshot.docs.some((docSnapshot) => docSnapshot.id !== deletedIntakeId && hasBuyerFacingReport(docSnapshot.data()));
}

export async function deleteWarehouseIntakePhoto(input: {
  intakeId: string;
  photoId: string;
  actorUid: string;
  actorEmail?: string;
}) {
  const intakeId = input.intakeId.trim();
  const photoId = input.photoId.trim();

  if (!isSafeWarehouseIntakeId(intakeId) || !photoId) {
    throw new WarehouseIntakeDeleteError("Invalid warehouse intake photo delete request.", 400, "invalid_request");
  }

  const db = getAdminDb();
  const ref = db.collection("warehouseIntakes").doc(intakeId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new WarehouseIntakeDeleteError("Storage contract draft was not found.", 404, "not_found");
  }

  const data = snapshot.data() ?? {};
  if (!canDeleteWarehouseIntakePhotos(data)) {
    throw new WarehouseIntakeDeleteError("Finalised contract photos cannot be deleted.", 409, "evidence_locked");
  }

  const photos = getRawPhotos(data);
  const photo = photos.find((entry) => entry.id === photoId);
  if (!photo) {
    return {
      photoId,
      alreadyRemoved: true,
      storageDeleted: false,
      storageMissing: false,
    };
  }

  const storagePath = normalizeIntakeStoragePath(photo.storagePath, intakeId);
  if (!storagePath) {
    throw new WarehouseIntakeDeleteError("Stored photo path is invalid for this contract.", 400, "invalid_storage_path");
  }

  const storageResult = await deleteStorageObject(storagePath);
  const nextPhotos = photos.filter((entry) => entry.id !== photoId);
  const nextDamageRecords = removePhotoIdFromDamageRecords(data, photoId);

  try {
    await ref.update({
      photos: nextPhotos,
      photoCount: nextPhotos.length,
      "vehicleReport.damageRecords": nextDamageRecords,
      lastEditedByUid: input.actorUid,
      lastEditedByName: input.actorEmail || "CarNest Admin",
      lastEditedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[warehouse-intake-delete] Firestore metadata update failed after Storage photo delete.", {
      intakeId,
      photoId,
      storagePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new WarehouseIntakeDeleteError("Photo storage was removed, but the contract metadata could not be updated.", 500, "metadata_update_failed");
  }

  return {
    photoId,
    alreadyRemoved: false,
    storageDeleted: storageResult.deleted,
    storageMissing: storageResult.missing,
  };
}

export async function deleteWarehouseIntakeDraft(input: {
  intakeId: string;
  actorUid: string;
  actorEmail?: string;
}) {
  const intakeId = input.intakeId.trim();

  if (!isSafeWarehouseIntakeId(intakeId)) {
    throw new WarehouseIntakeDeleteError("Invalid warehouse intake draft delete request.", 400, "invalid_request");
  }

  const db = getAdminDb();
  const ref = db.collection("warehouseIntakes").doc(intakeId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new WarehouseIntakeDeleteError("Storage contract draft was not found.", 404, "not_found");
  }

  const data = snapshot.data() ?? {};
  if (!canDeleteWarehouseIntakeDraftRecord(data)) {
    throw new WarehouseIntakeDeleteError("Only unfinished draft storage contracts can be deleted.", 409, "evidence_locked");
  }

  const prefix = `warehouse-intakes/${intakeId}/`;
  const [files] = await getAdminStorageBucket().getFiles({ prefix });
  const fileDeleteResults = await Promise.all(
    files.map(async (file) => {
      if (!file.name.startsWith(prefix) || file.name.includes("..")) {
        return { name: file.name, deleted: false, failed: true, reason: "unsafe_prefix" };
      }

      try {
        await file.delete();
        return { name: file.name, deleted: true, failed: false, reason: "" };
      } catch (error) {
        if (isStorageObjectMissing(error)) {
          return { name: file.name, deleted: false, failed: false, reason: "missing" };
        }
        return {
          name: file.name,
          deleted: false,
          failed: true,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );
  const failedFiles = fileDeleteResults.filter((result) => result.failed);

  if (failedFiles.length) {
    console.error("[warehouse-intake-delete] Draft Storage cleanup failed.", {
      intakeId,
      failedFiles: failedFiles.map((result) => ({ name: result.name, reason: result.reason })),
    });
    throw new WarehouseIntakeDeleteError(
      "Unable to delete this draft completely. No vehicle or customer record was removed. Please try again or check the admin logs.",
      502,
      "storage_cleanup_failed"
    );
  }

  const subcollectionRefs = await collectSubcollectionDocumentRefs(ref);
  if (subcollectionRefs.length) {
    await deleteDocumentRefsInBatches(subcollectionRefs);
  }

  const customerProfileId = getStringField(data, "customerProfileId").trim();
  const vehicleRecordId = getStringField(data, "vehicleRecordId").trim();
  const vehicleId = getStringField(data, "vehicleId").trim();
  const batch = db.batch();

  if (customerProfileId) {
    const customerRef = db.collection("customerProfiles").doc(customerProfileId);
    const customerSnapshot = await customerRef.get();
    if (customerSnapshot.exists && customerSnapshot.data()?.latestIntakeId === intakeId) {
      batch.set(customerRef, {
        latestIntakeId: "",
        lastEditedByUid: input.actorUid,
        lastEditedByName: input.actorEmail || "CarNest Admin",
        lastEditedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
  }

  if (vehicleRecordId) {
    const vehicleRecordRef = db.collection("vehicleRecords").doc(vehicleRecordId);
    const vehicleRecordSnapshot = await vehicleRecordRef.get();
    const vehicleRecordData = vehicleRecordSnapshot.data() ?? {};
    batch.set(vehicleRecordRef, {
      linkedIntakeIds: FieldValue.arrayRemove(intakeId),
      ...(vehicleRecordData.latestIntakeId === intakeId ? { latestIntakeId: "" } : {}),
      activeIntakeEditorUid: "",
      activeIntakeEditorName: "",
      activeIntakeEditedAt: "",
      lastEditedByUid: input.actorUid,
      lastEditedByName: input.actorEmail || "CarNest Admin",
      lastEditedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  if (vehicleId && !(await hasOtherBuyerFacingIntakeForVehicle(vehicleId, intakeId))) {
    batch.set(db.collection("vehicles").doc(vehicleId), {
      vehicleReportAvailable: false,
      vehicleReportGeneratedAt: FieldValue.delete(),
      vehicleConditionRating: FieldValue.delete(),
      vehicleReportSummary: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  batch.delete(ref);
  await batch.commit();

  return {
    intakeId,
    deletedFiles: fileDeleteResults.filter((result) => result.deleted).length,
    missingFiles: fileDeleteResults.filter((result) => result.reason === "missing").length,
    deletedChildDocuments: subcollectionRefs.length,
  };
}
