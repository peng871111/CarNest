import "server-only";

import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin-server";
import { extractFirebaseStoragePath } from "@/lib/firebase-storage-paths";
import { WAREHOUSE_PHOTO_SECTIONS } from "@/lib/warehouse-intake-config";
import {
  canDeleteWarehouseIntakeDraftRecord,
  canDeleteWarehouseIntakePhotos,
  isWarehouseIntakeLinkedToListing,
} from "@/lib/warehouse-intake-evidence";

type WarehouseIntakeRawData = Record<string, unknown>;
const CONDITION_PHOTO_CATEGORIES = new Set<string>(WAREHOUSE_PHOTO_SECTIONS.map((section) => section.key));

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

function getRawPhotos(data: WarehouseIntakeRawData): Array<Record<string, unknown> & { id: string }> {
  return Array.isArray(data.photos)
    ? (data.photos as Array<Record<string, unknown>>).filter((photo): photo is Record<string, unknown> & { id: string } => typeof photo.id === "string")
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

function removePhotoIdFromWheelDamageRecords(data: WarehouseIntakeRawData, photoId: string) {
  const vehicleReport = data.vehicleReport && typeof data.vehicleReport === "object"
    ? data.vehicleReport as Record<string, unknown>
    : {};
  const wheelDamageRecords = Array.isArray(vehicleReport.wheelDamageRecords)
    ? vehicleReport.wheelDamageRecords as Array<Record<string, unknown>>
    : [];

  return wheelDamageRecords.map((record) => ({
    ...record,
    photoIds: Array.isArray(record.photoIds)
      ? record.photoIds.filter((entry) => entry !== photoId)
      : [],
  }));
}

function getVehicleReport(data: WarehouseIntakeRawData) {
  return data.vehicleReport && typeof data.vehicleReport === "object"
    ? data.vehicleReport as Record<string, unknown>
    : {};
}

function getLinkedDamageRecordIds(data: WarehouseIntakeRawData, photoId: string) {
  const vehicleReport = getVehicleReport(data);
  const damageRecords = Array.isArray(vehicleReport.damageRecords)
    ? vehicleReport.damageRecords as Array<Record<string, unknown>>
    : [];
  const wheelDamageRecords = Array.isArray(vehicleReport.wheelDamageRecords)
    ? vehicleReport.wheelDamageRecords as Array<Record<string, unknown>>
    : [];

  return {
    damageRecordIds: damageRecords
      .filter((record) => Array.isArray(record.photoIds) && record.photoIds.includes(photoId))
      .map((record) => typeof record.id === "string" ? record.id : "")
      .filter(Boolean),
    wheelDamageRecordIds: wheelDamageRecords
      .filter((record) => Array.isArray(record.photoIds) && record.photoIds.includes(photoId))
      .map((record) => typeof record.id === "string" ? record.id : "")
      .filter(Boolean),
    damageNotes: [...damageRecords, ...wheelDamageRecords]
      .filter((record) => Array.isArray(record.photoIds) && record.photoIds.includes(photoId))
      .map((record) => typeof record.notes === "string" ? record.notes.trim().slice(0, 1200) : "")
      .filter(Boolean),
  };
}

function replacePhotoIdInDamageRecords(data: WarehouseIntakeRawData, photoId: string, replacementPhotoId: string) {
  const vehicleReport = getVehicleReport(data);
  const damageRecords = Array.isArray(vehicleReport.damageRecords)
    ? vehicleReport.damageRecords as Array<Record<string, unknown>>
    : [];

  return damageRecords.map((record) => ({
    ...record,
    photoIds: Array.isArray(record.photoIds)
      ? Array.from(new Set(record.photoIds.map((entry) => entry === photoId ? replacementPhotoId : entry)))
      : [],
  }));
}

function replacePhotoIdInWheelDamageRecords(data: WarehouseIntakeRawData, photoId: string, replacementPhotoId: string) {
  const vehicleReport = getVehicleReport(data);
  const wheelDamageRecords = Array.isArray(vehicleReport.wheelDamageRecords)
    ? vehicleReport.wheelDamageRecords as Array<Record<string, unknown>>
    : [];

  return wheelDamageRecords.map((record) => ({
    ...record,
    photoIds: Array.isArray(record.photoIds)
      ? Array.from(new Set(record.photoIds.map((entry) => entry === photoId ? replacementPhotoId : entry)))
      : [],
  }));
}

function getRawDamagePhoto(input: unknown, intakeId: string) {
  const photo = input && typeof input === "object" ? input as Record<string, unknown> : null;
  if (!photo || typeof photo.id !== "string" || !photo.id.trim() || photo.category !== "damagePhotos") return null;
  const storagePath = normalizeIntakeStoragePath(photo.storagePath, intakeId);
  if (!storagePath.startsWith(`warehouse-intakes/${intakeId}/photos/damagePhotos/`)) return null;
  const contentType = typeof photo.contentType === "string" ? photo.contentType : "";
  if (contentType && !contentType.toLowerCase().startsWith("image/")) return null;

  return {
    id: photo.id.trim(),
    category: "damagePhotos",
    label: typeof photo.label === "string" && photo.label.trim() ? photo.label.trim().slice(0, 160) : "Damage photo",
    storagePath,
    name: typeof photo.name === "string" ? photo.name.slice(0, 240) : "",
    note: typeof photo.note === "string" ? photo.note.slice(0, 1200) : "",
    uploadedAt: typeof photo.uploadedAt === "string" ? photo.uploadedAt : "",
    contentType,
  };
}

function sanitizeRepairDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function sanitizeRepairDescription(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function createDamagePhotoHistoryEntry(input: {
  intakeId: string;
  vehicleId: string;
  photo: Record<string, unknown>;
  action: "deleted" | "replaced" | "repaired" | "note_updated";
  actorUid: string;
  actorName: string;
  linkedDamageRecordIds: string[];
  linkedWheelDamageRecordIds: string[];
  originalDamageNotes?: string[];
  reason?: string;
  replacementPhoto?: Record<string, unknown> | null;
  afterRepairPhoto?: Record<string, unknown> | null;
  repairDate?: string;
  repairDescription?: string;
  repairVerified?: boolean;
  previousNote?: string;
}) {
  return {
    id: `damage-photo-history-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    action: input.action,
    photo: input.photo,
    archivedAt: Timestamp.now(),
    actorUid: input.actorUid,
    actorName: input.actorName,
    reason: input.reason || "",
    vehicleId: input.vehicleId,
    contractId: input.intakeId,
    linkedDamageRecordIds: input.linkedDamageRecordIds,
    linkedWheelDamageRecordIds: input.linkedWheelDamageRecordIds,
    originalDamageNotes: input.originalDamageNotes ?? [],
    replacementPhoto: input.replacementPhoto ?? null,
    afterRepairPhoto: input.afterRepairPhoto ?? null,
    repairDate: input.repairDate || "",
    repairDescription: input.repairDescription || "",
    repairVerified: input.repairVerified === true,
    previousNote: input.previousNote || "",
  };
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

function sanitizeDeletionReason(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 240) : "";
}

function isPdfAvailable(data: WarehouseIntakeRawData) {
  return Boolean(
    getStringField(data, "signedPdfStoragePath").trim()
    || getStringField(data, "signedPdfFileName").trim()
    || getStringField(data, "pdfGeneratedAt").trim()
  );
}

async function writePhotoDeletionAuditEvent(input: {
  intakeId: string;
  photoId: string;
  storagePath: string;
  actorUid: string;
  actorEmail?: string;
  pdfExisted: boolean;
  deletionReason: string;
  linkedListingState: "unlinked" | "linked";
  vehicleId: string;
  customerProfileId: string;
  vehicleRecordId: string;
}) {
  await getAdminDb().collection("adminOperationalEvents").add({
    recordType: "warehouse_intake",
    actionType: "photo_deleted",
    affectedRecordId: input.intakeId,
    customerProfileId: input.customerProfileId,
    vehicleRecordId: input.vehicleRecordId,
    intakeEventId: input.intakeId,
    publicListingId: input.vehicleId,
    staffUid: input.actorUid,
    staffName: input.actorEmail || "CarNest Admin",
    staffEmail: input.actorEmail || "",
    summary: `Condition photo ${input.photoId} deleted from warehouse intake ${input.intakeId}.`,
    photoId: input.photoId,
    storagePath: input.storagePath,
    deletedByUid: input.actorUid,
    deletedAt: Timestamp.now(),
    pdfExisted: input.pdfExisted,
    deletionReason: input.deletionReason,
    linkedListingState: input.linkedListingState,
    createdAt: Timestamp.now(),
  });
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
  deletionReason?: string;
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

  if (!CONDITION_PHOTO_CATEGORIES.has(String(photo.category ?? ""))) {
    throw new WarehouseIntakeDeleteError("Only vehicle-condition photos can be deleted from this workflow.", 400, "protected_photo");
  }

  const storagePath = normalizeIntakeStoragePath(photo.storagePath, intakeId);
  if (!storagePath) {
    throw new WarehouseIntakeDeleteError("Stored photo path is invalid for this contract.", 400, "invalid_storage_path");
  }
  if (!storagePath.startsWith(`warehouse-intakes/${intakeId}/photos/`)) {
    throw new WarehouseIntakeDeleteError("Only vehicle-condition photos can be deleted from this workflow.", 400, "protected_photo");
  }

  const isDamagePhoto = photo.category === "damagePhotos";
  if (!isDamagePhoto && !canDeleteWarehouseIntakePhotos(data)) {
    throw new WarehouseIntakeDeleteError("Photos cannot be deleted after this contract is linked to a listing.", 409, "listing_linked");
  }

  const pdfExisted = isPdfAvailable(data);
  const pdfRegenerationRequiredAt = pdfExisted ? Timestamp.now() : null;
  const deletionReason = sanitizeDeletionReason(input.deletionReason);
  const linkedListingState = isWarehouseIntakeLinkedToListing(data) ? "linked" : "unlinked";
  const links = getLinkedDamageRecordIds(data, photoId);
  const storageResult = isDamagePhoto
    ? { deleted: false, missing: false }
    : await deleteStorageObject(storagePath);
  const nextPhotos = photos.filter((entry) => entry.id !== photoId);
  const nextDamageRecords = removePhotoIdFromDamageRecords(data, photoId);
  const nextWheelDamageRecords = removePhotoIdFromWheelDamageRecords(data, photoId);
  const actorName = input.actorEmail || "CarNest Admin";
  const existingHistory = Array.isArray(data.damagePhotoHistory) ? data.damagePhotoHistory : [];
  const nextDamagePhotoHistory = isDamagePhoto
    ? [
        ...existingHistory,
        createDamagePhotoHistoryEntry({
          intakeId,
          vehicleId: getStringField(data, "vehicleId").trim(),
          photo,
          action: "deleted",
          actorUid: input.actorUid,
          actorName,
          linkedDamageRecordIds: links.damageRecordIds,
          linkedWheelDamageRecordIds: links.wheelDamageRecordIds,
          originalDamageNotes: links.damageNotes,
          reason: deletionReason,
        }),
      ]
    : existingHistory;

  try {
    await ref.update({
      photos: nextPhotos,
      photoCount: nextPhotos.length,
      "vehicleReport.damageRecords": nextDamageRecords,
      "vehicleReport.wheelDamageRecords": nextWheelDamageRecords,
      ...(isDamagePhoto ? { damagePhotoHistory: nextDamagePhotoHistory } : {}),
      ...(pdfRegenerationRequiredAt
        ? {
            pdfRegenerationRequiredAt,
            pdfRegenerationReason: "condition_photo_deleted",
            pdfRegenerationRequiredByUid: input.actorUid,
            pdfRegenerationRequiredByName: input.actorEmail || "CarNest Admin",
          }
        : {}),
      lastEditedByUid: input.actorUid,
      lastEditedByName: actorName,
      lastEditedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await writePhotoDeletionAuditEvent({
      intakeId,
      photoId,
      storagePath,
      actorUid: input.actorUid,
      actorEmail: input.actorEmail,
      pdfExisted,
      deletionReason,
      linkedListingState,
      vehicleId: getStringField(data, "vehicleId").trim(),
      customerProfileId: getStringField(data, "customerProfileId").trim(),
      vehicleRecordId: getStringField(data, "vehicleRecordId").trim(),
    }).catch((error) => {
      console.error("[warehouse-intake-delete] Photo deletion audit log failed.", {
        intakeId,
        photoId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  } catch (error) {
    console.error("[warehouse-intake-delete] Condition photo metadata update failed.", {
      intakeId,
      photoId,
      storagePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new WarehouseIntakeDeleteError("The condition photo could not be updated safely. Please try again.", 500, "metadata_update_failed");
  }

  return {
    photoId,
    alreadyRemoved: false,
    storageDeleted: storageResult.deleted,
    storageMissing: storageResult.missing,
    archived: isDamagePhoto,
    pdfRegenerationRequired: pdfExisted,
    pdfRegenerationRequiredAt: pdfRegenerationRequiredAt?.toDate().toISOString() ?? "",
  };
}

type DamagePhotoMutationAction = "replace" | "mark_repaired" | "update_note";

async function writeDamagePhotoAuditEvent(input: {
  intakeId: string;
  photoId: string;
  action: DamagePhotoMutationAction;
  actorUid: string;
  actorEmail?: string;
  vehicleId: string;
  details: string;
}) {
  await getAdminDb().collection("adminOperationalEvents").add({
    recordType: "warehouse_intake",
    actionType: "photo_updated",
    affectedRecordId: input.intakeId,
    intakeEventId: input.intakeId,
    publicListingId: input.vehicleId,
    staffUid: input.actorUid,
    staffName: input.actorEmail || "CarNest Admin",
    staffEmail: input.actorEmail || "",
    summary: input.details,
    photoId: input.photoId,
    damagePhotoAction: input.action,
    createdAt: Timestamp.now(),
  });
}

export async function manageWarehouseIntakeDamagePhoto(input: {
  intakeId: string;
  photoId: string;
  action: DamagePhotoMutationAction;
  actorUid: string;
  actorEmail?: string;
  replacementPhoto?: unknown;
  afterRepairPhoto?: unknown;
  note?: unknown;
  repairDate?: unknown;
  repairDescription?: unknown;
  repairVerified?: unknown;
  reason?: unknown;
}) {
  const intakeId = input.intakeId.trim();
  const photoId = input.photoId.trim();
  if (!isSafeWarehouseIntakeId(intakeId) || !photoId) {
    throw new WarehouseIntakeDeleteError("Invalid warehouse damage photo request.", 400, "invalid_request");
  }

  const db = getAdminDb();
  const ref = db.collection("warehouseIntakes").doc(intakeId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new WarehouseIntakeDeleteError("Storage contract draft was not found.", 404, "not_found");
  }

  const data = snapshot.data() ?? {};
  const photos = getRawPhotos(data);
  const photo = photos.find((entry) => entry.id === photoId);
  if (!photo || photo.category !== "damagePhotos") {
    throw new WarehouseIntakeDeleteError("Damage photo was not found.", 404, "photo_not_found");
  }
  const storagePath = normalizeIntakeStoragePath(photo.storagePath, intakeId);
  if (!storagePath.startsWith(`warehouse-intakes/${intakeId}/photos/damagePhotos/`)) {
    throw new WarehouseIntakeDeleteError("Stored photo path is invalid for this contract.", 400, "invalid_storage_path");
  }

  const actorName = input.actorEmail || "CarNest Admin";
  const vehicleId = getStringField(data, "vehicleId").trim();
  const links = getLinkedDamageRecordIds(data, photoId);
  const existingHistory = Array.isArray(data.damagePhotoHistory) ? data.damagePhotoHistory : [];
  const pdfExisted = isPdfAvailable(data);
  const pdfRegenerationRequiredAt = pdfExisted ? Timestamp.now() : null;
  const updates: WarehouseIntakeRawData = {
    lastEditedByUid: input.actorUid,
    lastEditedByName: actorName,
    lastEditedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...(pdfRegenerationRequiredAt
      ? {
          pdfRegenerationRequiredAt,
          pdfRegenerationReason: input.action === "mark_repaired" ? "condition_damage_repaired" : "condition_photo_updated",
          pdfRegenerationRequiredByUid: input.actorUid,
          pdfRegenerationRequiredByName: actorName,
        }
      : {}),
  };
  let auditDetails = "";

  if (input.action === "replace") {
    const replacementPhoto = getRawDamagePhoto(input.replacementPhoto, intakeId);
    if (!replacementPhoto || replacementPhoto.id === photoId || photos.some((entry) => entry.id === replacementPhoto.id && entry.id !== photoId)) {
      throw new WarehouseIntakeDeleteError("Upload a valid replacement damage photo before saving.", 400, "invalid_replacement_photo");
    }

    updates.photos = photos.map((entry) => entry.id === photoId ? replacementPhoto : entry);
    updates.photoCount = photos.length;
    updates["vehicleReport.damageRecords"] = replacePhotoIdInDamageRecords(data, photoId, replacementPhoto.id);
    updates["vehicleReport.wheelDamageRecords"] = replacePhotoIdInWheelDamageRecords(data, photoId, replacementPhoto.id);
    updates.damagePhotoHistory = [
      ...existingHistory,
      createDamagePhotoHistoryEntry({
        intakeId,
        vehicleId,
        photo,
        action: "replaced",
        actorUid: input.actorUid,
        actorName,
        linkedDamageRecordIds: links.damageRecordIds,
        linkedWheelDamageRecordIds: links.wheelDamageRecordIds,
        originalDamageNotes: links.damageNotes,
        reason: sanitizeDeletionReason(input.reason),
        replacementPhoto,
      }),
    ];
    auditDetails = `Damage photo ${photoId} replaced on warehouse intake ${intakeId}.`;
  } else if (input.action === "update_note") {
    const note = sanitizeRepairDescription(input.note);
    updates.photos = photos.map((entry) => entry.id === photoId ? { ...entry, note } : entry);
    updates.photoCount = photos.length;
    updates.damagePhotoHistory = [
      ...existingHistory,
      createDamagePhotoHistoryEntry({
        intakeId,
        vehicleId,
        photo,
        action: "note_updated",
        actorUid: input.actorUid,
        actorName,
        linkedDamageRecordIds: links.damageRecordIds,
        linkedWheelDamageRecordIds: links.wheelDamageRecordIds,
        originalDamageNotes: links.damageNotes,
        previousNote: typeof photo.note === "string" ? photo.note : "",
      }),
    ];
    auditDetails = `Damage note updated for photo ${photoId} on warehouse intake ${intakeId}.`;
  } else {
    const repairDate = sanitizeRepairDate(input.repairDate);
    const repairDescription = sanitizeRepairDescription(input.repairDescription);
    const repairVerified = input.repairVerified === true;
    const afterRepairPhoto = input.afterRepairPhoto ? getRawDamagePhoto(input.afterRepairPhoto, intakeId) : null;
    if (!repairDate) {
      throw new WarehouseIntakeDeleteError("A repair date is required.", 400, "invalid_repair_date");
    }
    if (input.afterRepairPhoto && !afterRepairPhoto) {
      throw new WarehouseIntakeDeleteError("The after-repair photo is invalid for this contract.", 400, "invalid_after_repair_photo");
    }

    const linkedBodyIds = new Set(links.damageRecordIds);
    const linkedWheelIds = new Set(links.wheelDamageRecordIds);
    const vehicleReport = getVehicleReport(data);
    const bodyRecords = Array.isArray(vehicleReport.damageRecords)
      ? vehicleReport.damageRecords as Array<Record<string, unknown>>
      : [];
    const wheelRecords = Array.isArray(vehicleReport.wheelDamageRecords)
      ? vehicleReport.wheelDamageRecords as Array<Record<string, unknown>>
      : [];
    const matchingPhotoIds = new Set<string>([photoId]);
    if (repairVerified) {
      for (const record of [...bodyRecords, ...wheelRecords]) {
        const recordId = typeof record.id === "string" ? record.id : "";
        if (!linkedBodyIds.has(recordId) && !linkedWheelIds.has(recordId)) continue;
        if (Array.isArray(record.photoIds)) {
          record.photoIds.forEach((linkedPhotoId) => {
            if (typeof linkedPhotoId === "string") matchingPhotoIds.add(linkedPhotoId);
          });
        }
      }
    }
    const repairMetadata = {
      repairStatus: repairVerified ? "verified" : "reported",
      repairDate,
      repairDescription,
      repairConfirmedAt: repairVerified ? Timestamp.now() : null,
      repairConfirmedByUid: repairVerified ? input.actorUid : "",
      repairConfirmedByName: repairVerified ? actorName : "",
      afterRepairPhotoId: afterRepairPhoto?.id || "",
    };
    updates["vehicleReport.damageRecords"] = bodyRecords.map((record) => (
      linkedBodyIds.has(typeof record.id === "string" ? record.id : "") ? { ...record, ...repairMetadata } : record
    ));
    updates["vehicleReport.wheelDamageRecords"] = wheelRecords.map((record) => (
      linkedWheelIds.has(typeof record.id === "string" ? record.id : "") ? { ...record, ...repairMetadata } : record
    ));
    const archivedPhotos = repairVerified
      ? photos.filter((entry) => entry.category === "damagePhotos" && matchingPhotoIds.has(entry.id))
      : [];
    updates.photos = repairVerified
      ? photos.filter((entry) => !matchingPhotoIds.has(entry.id))
      : photos;
    updates.photoCount = (updates.photos as Array<Record<string, unknown>>).length;
    updates.damagePhotoHistory = [
      ...existingHistory,
      ...(repairVerified ? archivedPhotos : [photo]).map((archivedPhoto) => (
        createDamagePhotoHistoryEntry({
          intakeId,
          vehicleId,
          photo: archivedPhoto,
          action: "repaired",
          actorUid: input.actorUid,
          actorName,
          linkedDamageRecordIds: getLinkedDamageRecordIds(data, String(archivedPhoto.id)).damageRecordIds,
          linkedWheelDamageRecordIds: getLinkedDamageRecordIds(data, String(archivedPhoto.id)).wheelDamageRecordIds,
          originalDamageNotes: getLinkedDamageRecordIds(data, String(archivedPhoto.id)).damageNotes,
          reason: sanitizeDeletionReason(input.reason),
          afterRepairPhoto: archivedPhoto.id === photoId ? afterRepairPhoto : null,
          repairDate,
          repairDescription,
          repairVerified,
        })
      )),
    ];
    auditDetails = repairVerified
      ? `Repair verified and active damage evidence archived for photo ${photoId} on warehouse intake ${intakeId}.`
      : `Repair recorded for photo ${photoId} on warehouse intake ${intakeId}; admin verification is pending.`;
  }

  try {
    await ref.update(updates);
    await writeDamagePhotoAuditEvent({
      intakeId,
      photoId,
      action: input.action,
      actorUid: input.actorUid,
      actorEmail: input.actorEmail,
      vehicleId,
      details: auditDetails,
    }).catch((error) => {
      console.error("[warehouse-intake-damage] Photo audit log failed.", {
        intakeId,
        photoId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  } catch (error) {
    console.error("[warehouse-intake-damage] Damage photo update failed.", {
      intakeId,
      photoId,
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new WarehouseIntakeDeleteError("The damage photo could not be updated safely. Please try again.", 500, "damage_photo_update_failed");
  }

  return {
    photoId,
    action: input.action,
    archived: input.action === "mark_repaired" && input.repairVerified === true,
    pdfRegenerationRequired: pdfExisted,
    pdfRegenerationRequiredAt: pdfRegenerationRequiredAt?.toDate().toISOString() ?? "",
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
