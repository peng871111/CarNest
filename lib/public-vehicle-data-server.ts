import { getAdminDb } from "@/lib/firebase-admin-server";
import {
  applyPublicVehicleIdentitySnapshot,
  buildPublicVehicleIdentitySnapshot,
} from "@/lib/public-vehicle-details";
import { serializeVehicleDoc } from "@/lib/data";
import type { Vehicle } from "@/types";

type AdminDocumentData = Record<string, unknown>;

function serializeAdminDate(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

function getDocumentData(snapshot: FirebaseFirestore.DocumentSnapshot) {
  return snapshot.exists ? snapshot.data() as AdminDocumentData : null;
}

function getCandidateId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function chooseLatestDocumentData(items: Array<{ id: string; data: AdminDocumentData }>) {
  return items
    .sort((left, right) => {
      const leftDate = serializeAdminDate(left.data.updatedAt) || serializeAdminDate(left.data.createdAt);
      const rightDate = serializeAdminDate(right.data.updatedAt) || serializeAdminDate(right.data.createdAt);
      return rightDate.localeCompare(leftDate);
    })[0] ?? null;
}

async function loadLinkedVehicleRecord(listingId: string, listingData: AdminDocumentData) {
  const db = getAdminDb();
  const directId =
    getCandidateId(listingData.vehicleRecordId)
    || getCandidateId(listingData.linkedVehicleRecordId);

  if (directId) {
    const snapshot = await db.collection("vehicleRecords").doc(directId).get();
    const data = getDocumentData(snapshot);
    if (data) return { id: snapshot.id, data };
  }

  const byListing = await db.collection("vehicleRecords").where("publicListingId", "==", listingId).limit(1).get();
  if (!byListing.empty) {
    const item = byListing.docs[0];
    return { id: item.id, data: item.data() as AdminDocumentData };
  }

  return null;
}

async function loadLinkedWarehouseIntake(
  listingId: string,
  listingData: AdminDocumentData,
  vehicleRecordId?: string
) {
  const db = getAdminDb();
  const directId =
    getCandidateId(listingData.storageContractId)
    || getCandidateId(listingData.warehouseIntakeId)
    || getCandidateId(listingData.intakeId);

  if (directId) {
    const snapshot = await db.collection("warehouseIntakes").doc(directId).get();
    const data = getDocumentData(snapshot);
    if (data) return { id: snapshot.id, data };
  }

  const candidates: Array<{ id: string; data: AdminDocumentData }> = [];
  const byListing = await db.collection("warehouseIntakes").where("vehicleId", "==", listingId).get();
  byListing.docs.forEach((item) => candidates.push({ id: item.id, data: item.data() as AdminDocumentData }));

  if (vehicleRecordId) {
    const byVehicleRecord = await db.collection("warehouseIntakes").where("vehicleRecordId", "==", vehicleRecordId).get();
    byVehicleRecord.docs.forEach((item) => {
      if (!candidates.some((candidate) => candidate.id === item.id)) {
        candidates.push({ id: item.id, data: item.data() as AdminDocumentData });
      }
    });
  }

  return chooseLatestDocumentData(candidates);
}

export async function getPublicVehicleById(id: string): Promise<Vehicle | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const db = getAdminDb();
  const listingSnapshot = await db.collection("vehicles").doc(normalizedId).get();
  const listingData = getDocumentData(listingSnapshot);
  if (!listingData) return null;

  const listing = serializeVehicleDoc(listingSnapshot.id, listingData);

  try {
    const vehicleRecord = await loadLinkedVehicleRecord(listing.id, listingData);
    const storageContract = await loadLinkedWarehouseIntake(listing.id, listingData, vehicleRecord?.id);
    const identitySnapshot = buildPublicVehicleIdentitySnapshot({
      listing: listingData,
      vehicleRecord: vehicleRecord?.data,
      storageContract: storageContract?.data,
    });

    return applyPublicVehicleIdentitySnapshot(listing, identitySnapshot);
  } catch (error) {
    console.warn("[public-vehicle-data] Linked vehicle details unavailable.", {
      vehicleId: listing.id,
      error: error instanceof Error ? error.message : "Unknown linked vehicle detail error",
    });
    return listing;
  }
}
