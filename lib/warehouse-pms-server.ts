import "server-only";

import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin-server";
import { omitUndefinedWarehousePmsFields } from "@/lib/warehouse-pms-booking-data";
import {
  buildWarehousePmsForecast,
  findWarehouseCapacityConflicts,
  getWarehouseBookingExtensionEstimate,
  warehouseDateKey
} from "@/lib/warehouse-pms";
import {
  WarehousePmsBay,
  WarehousePmsBooking,
  WarehousePmsExtension,
  WarehousePmsLinkedContract,
  WarehousePmsManagedVehicle,
  WarehousePmsOccupancy,
  WarehousePmsSettings,
  WarehousePmsSnapshot,
  WarehousePmsVehicleSummary
} from "@/lib/warehouse-pms-types";

const SETTINGS_COLLECTION = "warehousePmsSettings";
const BAYS_COLLECTION = "warehousePmsBays";
const BOOKINGS_COLLECTION = "warehousePmsBookings";
const EXTENSIONS_COLLECTION = "warehousePmsExtensions";
const OCCUPANCY_COLLECTION = "warehousePmsOccupancy";

const DEFAULT_SETTINGS: WarehousePmsSettings = {
  id: "default",
  defaultMonthlyRate: 380,
  defaultDailyRate: 12.67,
  bayCapacity: 20
};

export class WarehousePmsError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = "warehouse_pms_error", details?: unknown) {
    super(message);
    this.name = "WarehousePmsError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asDisplayString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asString(value);
}

function asOptionalString(value: unknown) {
  const normalized = asString(value);
  return normalized || undefined;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asDateString(value: unknown, label: string) {
  const raw = asString(value);
  if (!raw || Number.isNaN(new Date(raw).getTime())) {
    throw new WarehousePmsError(`${label} must be a valid date and time.`);
  }
  return new Date(raw).toISOString();
}

function asOptionalDateString(value: unknown, label: string) {
  const raw = asString(value);
  return raw ? asDateString(raw, label) : undefined;
}

function serializeTimestamp(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

function serializeSettings(id: string, data: DocumentData): WarehousePmsSettings {
  return {
    id,
    defaultMonthlyRate: asNumber(data.defaultMonthlyRate, DEFAULT_SETTINGS.defaultMonthlyRate),
    defaultDailyRate: asNumber(data.defaultDailyRate, DEFAULT_SETTINGS.defaultDailyRate),
    bayCapacity: Math.max(1, Math.floor(asNumber(data.bayCapacity, DEFAULT_SETTINGS.bayCapacity))),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt)
  };
}

function serializeBay(id: string, data: DocumentData): WarehousePmsBay {
  const baseState = data.baseState === "temporarily_blocked" || data.baseState === "maintenance" ? data.baseState : "available";
  return {
    id,
    label: asString(data.label) || id,
    sequence: Math.max(1, Math.floor(asNumber(data.sequence, 999))),
    baseState,
    notes: asOptionalString(data.notes),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt)
  };
}

function serializeBooking(id: string, data: DocumentData): WarehousePmsBooking {
  const rawStatus = asString(data.status);
  const statuses = new Set([
    "draft", "reserved", "confirmed", "checked_in", "extended", "due_out", "overdue", "checked_out", "cancelled", "no_show"
  ]);
  const status = statuses.has(rawStatus) ? rawStatus as WarehousePmsBooking["status"] : "draft";
  return {
    id,
    reference: asString(data.reference) || id,
    customerId: asOptionalString(data.customerId),
    customerName: asString(data.customerName),
    customerEmail: asOptionalString(data.customerEmail),
    customerPhone: asOptionalString(data.customerPhone),
    vehicleId: asOptionalString(data.vehicleId),
    vehicleSource: data.vehicleSource === "vehicle_record" ? "vehicle_record" : "vehicle",
    vehicleTitle: asString(data.vehicleTitle),
    vehicleYear: asOptionalString(data.vehicleYear),
    vehicleMake: asOptionalString(data.vehicleMake),
    vehicleModel: asOptionalString(data.vehicleModel),
    vehicleVariant: asOptionalString(data.vehicleVariant),
    vehicleRego: asOptionalString(data.vehicleRego),
    vehicleVin: asOptionalString(data.vehicleVin),
    vehicleReference: asOptionalString(data.vehicleReference),
    linkedStorageContractId: asOptionalString(data.linkedStorageContractId),
    plannedCheckInAt: serializeTimestamp(data.plannedCheckInAt) || "",
    plannedCollectionAt: serializeTimestamp(data.plannedCollectionAt) || "",
    originalPlannedCollectionAt: serializeTimestamp(data.originalPlannedCollectionAt),
    actualCheckInAt: serializeTimestamp(data.actualCheckInAt),
    actualCollectionAt: serializeTimestamp(data.actualCollectionAt),
    assignedBayId: asOptionalString(data.assignedBayId),
    monthlyRate: asNumber(data.monthlyRate, DEFAULT_SETTINGS.defaultMonthlyRate),
    dailyRate: asNumber(data.dailyRate, DEFAULT_SETTINGS.defaultDailyRate),
    rateOverride: Boolean(data.rateOverride),
    manualBillingOverride: typeof data.manualBillingOverride === "number" ? data.manualBillingOverride : undefined,
    additionalStorageCharges: asNumber(data.additionalStorageCharges),
    status,
    notes: asOptionalString(data.notes),
    createdBy: asString(data.createdBy),
    checkedInBy: asOptionalString(data.checkedInBy),
    checkedOutBy: asOptionalString(data.checkedOutBy),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt)
  };
}

function serializeExtension(id: string, data: DocumentData): WarehousePmsExtension {
  return {
    id,
    bookingId: asString(data.bookingId),
    bookingReference: asString(data.bookingReference),
    previousPlannedCollectionAt: serializeTimestamp(data.previousPlannedCollectionAt) || "",
    newPlannedCollectionAt: serializeTimestamp(data.newPlannedCollectionAt) || "",
    extensionDays: asNumber(data.extensionDays),
    additionalEstimatedCharge: asNumber(data.additionalEstimatedCharge),
    requestedAt: serializeTimestamp(data.requestedAt) || "",
    approvedBy: asString(data.approvedBy),
    createdAt: serializeTimestamp(data.createdAt)
  };
}

function serializeOccupancy(id: string, data: DocumentData): WarehousePmsOccupancy {
  const sourceType = ["managed_vehicle", "internal", "listing"].includes(asString(data.sourceType))
    ? asString(data.sourceType) as WarehousePmsOccupancy["sourceType"]
    : "internal";
  return {
    id,
    sourceType,
    sourceId: asString(data.sourceId),
    bayId: asOptionalString(data.bayId),
    label: asString(data.label),
    rego: asOptionalString(data.rego),
    vehicleReference: asOptionalString(data.vehicleReference),
    occupiedFrom: serializeTimestamp(data.occupiedFrom) || "",
    plannedDepartureAt: serializeTimestamp(data.plannedDepartureAt) || undefined,
    releasedAt: serializeTimestamp(data.releasedAt),
    releasedBy: asOptionalString(data.releasedBy),
    notes: asOptionalString(data.notes),
    createdBy: asString(data.createdBy),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt)
  };
}

function formatVehicleTitle(data: DocumentData) {
  const providedTitle = asString(data.title);
  if (providedTitle) return providedTitle;
  return [data.year, data.make, data.model, data.variant].map((value) => asDisplayString(value)).filter(Boolean).join(" ") || "Vehicle";
}

function serializeVehicle(id: string, data: DocumentData, source: WarehousePmsVehicleSummary["source"]): WarehousePmsVehicleSummary {
  const year = asDisplayString(data.year);
  const make = asString(data.make);
  const model = asString(data.model);
  const variant = asString(data.variant);
  return {
    id,
    source,
    title: formatVehicleTitle(data),
    year: year || undefined,
    make: make || undefined,
    model: model || undefined,
    variant: variant || undefined,
    rego: asOptionalString(data.rego) || asOptionalString(data.registrationPlate),
    vin: asOptionalString(data.vin),
    vehicleReference: asOptionalString(data.displayReference) || asOptionalString(data.publicListingId),
    customerProfileId: asOptionalString(data.customerProfileId)
  };
}

function isCurrentWarehouseManagedVehicle(data: DocumentData) {
  if (data.deletedAt || data.soldAt || data.sellerStatus === "SOLD" || data.sellerStatus === "WITHDRAWN") return false;
  return data.listingType === "warehouse" || data.storedInWarehouse === true || data.isManagedByCarnest === true;
}

function storageContractReference(data: DocumentData) {
  return asString(data.reference) || asString(data.displayReference) || asString(data.contractReference) || undefined;
}

async function loadReferenceData() {
  const db = getAdminDb();
  const [customerSnapshot, vehiclesSnapshot, vehicleRecordsSnapshot, contractsSnapshot] = await Promise.all([
    db.collection("customerProfiles").get(),
    db.collection("vehicles").get(),
    db.collection("vehicleRecords").get(),
    db.collection("warehouseIntakes").get()
  ]);

  const customers = customerSnapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      fullName: asString(data.fullName) || asString(data.name) || "Customer",
      email: asOptionalString(data.email),
      phone: asOptionalString(data.phone)
    };
  }).sort((left, right) => left.fullName.localeCompare(right.fullName));
  const vehicles = vehiclesSnapshot.docs.map((document) => serializeVehicle(document.id, document.data(), "vehicle"));
  const vehicleRecords = vehicleRecordsSnapshot.docs.map((document) => serializeVehicle(document.id, document.data(), "vehicle_record"));
  const managedVehicles: WarehousePmsManagedVehicle[] = vehiclesSnapshot.docs
    .filter((document) => isCurrentWarehouseManagedVehicle(document.data()))
    .map((document) => ({
      ...serializeVehicle(document.id, document.data(), "vehicle"),
      occupiedFrom: serializeTimestamp(document.data().updatedAt) || serializeTimestamp(document.data().createdAt)
    }));
  const linkedContracts: WarehousePmsLinkedContract[] = contractsSnapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      vehicleId: asOptionalString(data.vehicleId),
      vehicleRecordId: asOptionalString(data.vehicleRecordId),
      reference: storageContractReference(data),
      status: asOptionalString(data.status)
    };
  });

  return { customers, vehicles: [...vehicles, ...vehicleRecords], managedVehicles, linkedContracts };
}

async function loadPmsDocuments() {
  const db = getAdminDb();
  const [settingsSnapshot, baysSnapshot, bookingsSnapshot, extensionsSnapshot, occupancySnapshot] = await Promise.all([
    db.collection(SETTINGS_COLLECTION).doc("default").get(),
    db.collection(BAYS_COLLECTION).get(),
    db.collection(BOOKINGS_COLLECTION).get(),
    db.collection(EXTENSIONS_COLLECTION).get(),
    db.collection(OCCUPANCY_COLLECTION).get()
  ]);

  return {
    settings: settingsSnapshot.exists ? serializeSettings(settingsSnapshot.id, settingsSnapshot.data() ?? {}) : DEFAULT_SETTINGS,
    bays: baysSnapshot.docs.map((document) => serializeBay(document.id, document.data())).sort((left, right) => left.sequence - right.sequence),
    bookings: bookingsSnapshot.docs.map((document) => serializeBooking(document.id, document.data())),
    extensions: extensionsSnapshot.docs
      .map((document) => serializeExtension(document.id, document.data()))
      .sort((left, right) => right.newPlannedCollectionAt.localeCompare(left.newPlannedCollectionAt)),
    occupancies: occupancySnapshot.docs.map((document) => serializeOccupancy(document.id, document.data()))
  };
}

function readDiagnosticErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error && typeof error.code === "string") return error.code;
  return "read_failed";
}

export async function getWarehousePmsReadDiagnostics() {
  const db = getAdminDb();
  const reads = [
    [SETTINGS_COLLECTION, db.collection(SETTINGS_COLLECTION).doc("default").get()],
    [BAYS_COLLECTION, db.collection(BAYS_COLLECTION).get()],
    [BOOKINGS_COLLECTION, db.collection(BOOKINGS_COLLECTION).get()],
    [EXTENSIONS_COLLECTION, db.collection(EXTENSIONS_COLLECTION).get()],
    [OCCUPANCY_COLLECTION, db.collection(OCCUPANCY_COLLECTION).get()]
  ] as const;
  const results = await Promise.allSettled(reads.map(([, read]) => read));

  return {
    mode: "read_only" as const,
    collections: results.map((result, index) => {
      const name = reads[index][0];
      if (result.status === "fulfilled") {
        const documentCount = "size" in result.value ? result.value.size : result.value.exists ? 1 : 0;
        return { name, ok: true, documentCount };
      }
      return { name, ok: false, errorCode: readDiagnosticErrorCode(result.reason) };
    })
  };
}

export async function loadWarehousePmsSnapshot(): Promise<WarehousePmsSnapshot> {
  const [pms, references] = await Promise.all([loadPmsDocuments(), loadReferenceData()]);
  return {
    ...pms,
    ...references,
    generatedAt: new Date().toISOString()
  };
}

export async function bootstrapWarehousePms(actorUid: string) {
  const db = getAdminDb();
  const settingsRef = db.collection(SETTINGS_COLLECTION).doc("default");
  const bayRefs = Array.from({ length: DEFAULT_SETTINGS.bayCapacity }, (_, index) => {
    const sequence = index + 1;
    return {
      ref: db.collection(BAYS_COLLECTION).doc(`bay-${String(sequence).padStart(2, "0")}`),
      sequence,
      label: `Bay ${String(sequence).padStart(2, "0")}`
    };
  });

  await db.runTransaction(async (transaction) => {
    const [settingsSnapshot, ...baySnapshots] = await Promise.all([
      transaction.get(settingsRef),
      ...bayRefs.map(({ ref }) => transaction.get(ref))
    ]);
    if (!settingsSnapshot.exists) {
      transaction.create(settingsRef, {
        ...DEFAULT_SETTINGS,
        createdBy: actorUid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    bayRefs.forEach(({ ref, sequence, label }, index) => {
      if (!baySnapshots[index].exists) {
        transaction.create(ref, {
          label,
          sequence,
          baseState: "available",
          createdBy: actorUid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    });
  });
}

function normalizeBookingInput(input: Record<string, unknown>, settings: WarehousePmsSettings, actorUid: string) {
  const plannedCheckInAt = asDateString(input.plannedCheckInAt, "Planned check-in");
  const plannedCollectionAt = asDateString(input.plannedCollectionAt, "Planned collection");
  if (new Date(plannedCollectionAt).getTime() <= new Date(plannedCheckInAt).getTime()) {
    throw new WarehousePmsError("Planned collection must be after planned check-in.");
  }
  const actualCheckInAt = asOptionalDateString(input.actualCheckInAt, "Actual check-in");
  const actualCollectionAt = asOptionalDateString(input.actualCollectionAt, "Actual checkout");
  const assignedBayId = asOptionalString(input.assignedBayId);
  const now = Date.now();
  if (actualCheckInAt && new Date(actualCheckInAt).getTime() > now) {
    throw new WarehousePmsError("Actual check-in cannot be in the future.");
  }
  if (actualCollectionAt && new Date(actualCollectionAt).getTime() > now) {
    throw new WarehousePmsError("Actual checkout cannot be in the future.");
  }
  if (actualCollectionAt && !actualCheckInAt) {
    throw new WarehousePmsError("Record the actual check-in before recording an actual checkout.");
  }
  if (actualCheckInAt && actualCollectionAt && new Date(actualCollectionAt).getTime() <= new Date(actualCheckInAt).getTime()) {
    throw new WarehousePmsError("Actual checkout must be after actual check-in.");
  }
  if (assignedBayId && (!actualCheckInAt || actualCollectionAt)) {
    throw new WarehousePmsError("An active bay assignment requires an actual check-in and no actual checkout.");
  }
  if (actualCheckInAt && !actualCollectionAt && !assignedBayId) {
    throw new WarehousePmsError("Select an available bay for a vehicle that is currently in the warehouse.");
  }
  const requestedStatus = asString(input.status);
  const requestedBookingStatus = ["draft", "reserved", "confirmed"].includes(requestedStatus) ? requestedStatus : "confirmed";
  const status = actualCollectionAt ? "checked_out" : actualCheckInAt ? "checked_in" : requestedBookingStatus;
  const monthlyRate = Math.max(0, asNumber(input.monthlyRate, settings.defaultMonthlyRate));
  const dailyRate = Math.max(0, asNumber(input.dailyRate, settings.defaultDailyRate));
  const customerId = asOptionalString(input.customerId);
  const vehicleId = asOptionalString(input.vehicleId);
  const customerName = asString(input.customerName);
  const vehicleTitle = asString(input.vehicleTitle);
  if (!customerId) throw new WarehousePmsError("A customer selection is required for a storage booking.");
  if (!vehicleId) throw new WarehousePmsError("A vehicle selection is required for a storage booking.");
  if (!customerName) throw new WarehousePmsError("A customer is required for a storage booking.");
  if (!vehicleTitle) throw new WarehousePmsError("A vehicle is required for a storage booking.");
  const manualBillingOverride = input.manualBillingOverride === "" || input.manualBillingOverride === undefined
    ? undefined
    : Math.max(0, asNumber(input.manualBillingOverride));

  return {
    customerId,
    customerName,
    customerEmail: asOptionalString(input.customerEmail),
    customerPhone: asOptionalString(input.customerPhone),
    vehicleId,
    vehicleSource: input.vehicleSource === "vehicle_record" ? "vehicle_record" : "vehicle",
    vehicleTitle,
    vehicleYear: asOptionalString(input.vehicleYear),
    vehicleMake: asOptionalString(input.vehicleMake),
    vehicleModel: asOptionalString(input.vehicleModel),
    vehicleVariant: asOptionalString(input.vehicleVariant),
    vehicleRego: asOptionalString(input.vehicleRego),
    vehicleVin: asOptionalString(input.vehicleVin),
    vehicleReference: asOptionalString(input.vehicleReference),
    linkedStorageContractId: asOptionalString(input.linkedStorageContractId),
    plannedCheckInAt: Timestamp.fromDate(new Date(plannedCheckInAt)),
    plannedCollectionAt: Timestamp.fromDate(new Date(plannedCollectionAt)),
    ...(actualCheckInAt ? { actualCheckInAt: Timestamp.fromDate(new Date(actualCheckInAt)), checkedInBy: actorUid } : {}),
    ...(actualCollectionAt ? { actualCollectionAt: Timestamp.fromDate(new Date(actualCollectionAt)), checkedOutBy: actorUid } : {}),
    ...(assignedBayId ? { assignedBayId } : {}),
    monthlyRate,
    dailyRate,
    rateOverride: monthlyRate !== settings.defaultMonthlyRate || dailyRate !== settings.defaultDailyRate,
    ...(manualBillingOverride === undefined ? {} : { manualBillingOverride }),
    additionalStorageCharges: Math.max(0, asNumber(input.additionalStorageCharges)),
    status,
    notes: asOptionalString(input.notes),
    createdBy: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function getTransactionalPmsData() {
  const db = getAdminDb();
  const [settings, bays, bookings, occupancies] = await Promise.all([
    db.collection(SETTINGS_COLLECTION).doc("default").get(),
    db.collection(BAYS_COLLECTION).get(),
    db.collection(BOOKINGS_COLLECTION).get(),
    db.collection(OCCUPANCY_COLLECTION).get()
  ]);
  return {
    settings: settings.exists ? serializeSettings(settings.id, settings.data() ?? {}) : DEFAULT_SETTINGS,
    bays: bays.docs.map((document) => serializeBay(document.id, document.data())),
    bookings: bookings.docs.map((document) => serializeBooking(document.id, document.data())),
    occupancies: occupancies.docs.map((document) => serializeOccupancy(document.id, document.data()))
  };
}

async function getManagedVehicles() {
  const db = getAdminDb();
  const vehicles = await db.collection("vehicles").get();
  return vehicles.docs
    .filter((document) => isCurrentWarehouseManagedVehicle(document.data()))
    .map((document) => ({
      ...serializeVehicle(document.id, document.data(), "vehicle"),
      occupiedFrom: serializeTimestamp(document.data().updatedAt) || serializeTimestamp(document.data().createdAt)
    }));
}

function assertNoCapacityConflict(input: {
  settings: WarehousePmsSettings;
  bays: WarehousePmsBay[];
  bookings: WarehousePmsBooking[];
  occupancies: WarehousePmsOccupancy[];
  managedVehicles: WarehousePmsManagedVehicle[];
  startAt: string;
  endAt: string;
}) {
  const conflicts = findWarehouseCapacityConflicts(input);
  if (conflicts.length) {
    throw new WarehousePmsError(
      "Warehouse capacity conflict.",
      409,
      "capacity_conflict",
      { affectedDates: conflicts }
    );
  }
}

function getBookingCapacityWindow(booking: WarehousePmsBooking, now = new Date()) {
  if (["draft", "cancelled", "no_show", "checked_out"].includes(booking.status) || booking.actualCollectionAt) return undefined;
  const today = warehouseDateKey(now);
  if (booking.actualCheckInAt) {
    if (!booking.assignedBayId) return undefined;
    const plannedEnd = warehouseDateKey(booking.plannedCollectionAt);
    return { startAt: today, endAt: plannedEnd >= today ? booking.plannedCollectionAt : today };
  }
  const plannedStart = warehouseDateKey(booking.plannedCheckInAt);
  const plannedEnd = warehouseDateKey(booking.plannedCollectionAt);
  if (!plannedStart || !plannedEnd || plannedEnd < today) return undefined;
  return {
    startAt: plannedStart > today ? booking.plannedCheckInAt : now.toISOString(),
    endAt: booking.plannedCollectionAt
  };
}

function assertNewBookingBayIsAvailable(pms: {
  bays: WarehousePmsBay[];
  bookings: WarehousePmsBooking[];
  occupancies: WarehousePmsOccupancy[];
}, candidate: WarehousePmsBooking) {
  if (!candidate.actualCheckInAt || candidate.actualCollectionAt || !candidate.assignedBayId) return;
  const bay = pms.bays.find((entry) => entry.id === candidate.assignedBayId);
  if (!bay || bay.baseState !== "available") throw new WarehousePmsError("Select an available warehouse bay.");
  const occupiedByBooking = pms.bookings.some((entry) => entry.assignedBayId === candidate.assignedBayId && entry.actualCheckInAt && !entry.actualCollectionAt);
  const occupiedByMapping = pms.occupancies.some((entry) => entry.bayId === candidate.assignedBayId && entry.occupiedFrom && !entry.releasedAt);
  if (occupiedByBooking || occupiedByMapping) throw new WarehousePmsError("That bay is already occupied.", 409, "bay_occupied");
}

function assertNewBookingCapacity(input: {
  settings: WarehousePmsSettings;
  bays: WarehousePmsBay[];
  bookings: WarehousePmsBooking[];
  occupancies: WarehousePmsOccupancy[];
  managedVehicles: WarehousePmsManagedVehicle[];
}, candidate: WarehousePmsBooking) {
  assertNewBookingBayIsAvailable(input, candidate);
  const capacityWindow = getBookingCapacityWindow(candidate);
  if (!capacityWindow) return;
  const latestExistingReservationEnd = input.bookings
    .filter((booking) => !booking.actualCheckInAt && !booking.actualCollectionAt && !["draft", "cancelled", "no_show", "checked_out"].includes(booking.status))
    .map((booking) => booking.plannedCollectionAt)
    .filter((value) => warehouseDateKey(value) >= warehouseDateKey(capacityWindow.startAt))
    .sort()
    .at(-1);
  assertNoCapacityConflict({
    ...input,
    bookings: [...input.bookings, candidate],
    startAt: capacityWindow.startAt,
    endAt: latestExistingReservationEnd && latestExistingReservationEnd > capacityWindow.endAt ? latestExistingReservationEnd : capacityWindow.endAt
  });
}

export async function createWarehousePmsBooking(input: Record<string, unknown>, actorUid: string) {
  const db = getAdminDb();
  const creationRequestId = asString(input.creationRequestId);
  if (!/^[a-z0-9-]{16,100}$/i.test(creationRequestId)) {
    throw new WarehousePmsError("A valid booking creation request is required.");
  }
  const referenceDoc = db.collection(BOOKINGS_COLLECTION).doc(`request-${creationRequestId}`);
  const existingBooking = await referenceDoc.get();
  if (existingBooking.exists) {
    return { id: existingBooking.id, reference: asString(existingBooking.data()?.reference) || existingBooking.id };
  }
  const [pms, managedVehicles] = await Promise.all([getTransactionalPmsData(), getManagedVehicles()]);
  const payload = normalizeBookingInput(input, pms.settings, actorUid);
  const candidate = serializeBooking("candidate", {
    ...payload,
    plannedCheckInAt: payload.plannedCheckInAt,
    plannedCollectionAt: payload.plannedCollectionAt,
    actualCheckInAt: payload.actualCheckInAt,
    actualCollectionAt: payload.actualCollectionAt
  });

  assertNewBookingCapacity({ ...pms, managedVehicles }, candidate);

  const reference = `WHS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${creationRequestId.slice(-6).toUpperCase()}`;
  let savedReference = reference;
  await db.runTransaction(async (transaction) => {
    const [existingBookingSnapshot, settingsSnapshot, baysSnapshot, bookingsSnapshot, occupancySnapshot] = await Promise.all([
      transaction.get(referenceDoc),
      transaction.get(db.collection(SETTINGS_COLLECTION).doc("default")),
      transaction.get(db.collection(BAYS_COLLECTION)),
      transaction.get(db.collection(BOOKINGS_COLLECTION)),
      transaction.get(db.collection(OCCUPANCY_COLLECTION))
    ]);
    if (existingBookingSnapshot.exists) {
      savedReference = asString(existingBookingSnapshot.data()?.reference) || reference;
      return;
    }
    const currentPms = {
      settings: settingsSnapshot.exists ? serializeSettings(settingsSnapshot.id, settingsSnapshot.data() ?? {}) : DEFAULT_SETTINGS,
      bays: baysSnapshot.docs.map((document) => serializeBay(document.id, document.data())),
      bookings: bookingsSnapshot.docs.map((document) => serializeBooking(document.id, document.data())),
      occupancies: occupancySnapshot.docs.map((document) => serializeOccupancy(document.id, document.data()))
    };
    assertNewBookingCapacity({ ...currentPms, managedVehicles }, candidate);
    transaction.create(referenceDoc, omitUndefinedWarehousePmsFields({ ...payload, reference }));
  });
  return { id: referenceDoc.id, reference: savedReference };
}

export async function checkInWarehousePmsBooking(bookingId: string, bayId: string, actorUid: string) {
  const db = getAdminDb();
  const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(bookingId);
  const bayRef = db.collection(BAYS_COLLECTION).doc(bayId);
  const [bookingSnapshot, baySnapshot, pms, managedVehicles] = await Promise.all([bookingRef.get(), bayRef.get(), getTransactionalPmsData(), getManagedVehicles()]);
  if (!bookingSnapshot.exists) throw new WarehousePmsError("Storage booking not found.", 404);
  if (!baySnapshot.exists) throw new WarehousePmsError("Warehouse bay not found.", 404);
  const booking = serializeBooking(bookingSnapshot.id, bookingSnapshot.data() ?? {});
  const bay = serializeBay(baySnapshot.id, baySnapshot.data() ?? {});
  if (booking.actualCollectionAt || booking.status === "checked_out") throw new WarehousePmsError("Checked-out bookings cannot be checked in.");
  if (bay.baseState !== "available") throw new WarehousePmsError("Select an available warehouse bay.");

  const today = warehouseDateKey(new Date());
  const physicalBooking = pms.bookings.find((entry) => entry.id !== booking.id && entry.assignedBayId === bayId && entry.actualCheckInAt && !entry.actualCollectionAt);
  const mappedOccupancy = pms.occupancies.find((entry) => entry.bayId === bayId && entry.occupiedFrom && !entry.releasedAt);
  if (physicalBooking || mappedOccupancy) throw new WarehousePmsError("That bay is already occupied.", 409, "bay_occupied");

  const candidate = { ...booking, assignedBayId: bayId, actualCheckInAt: new Date().toISOString(), status: "checked_in" as const };
  assertNoCapacityConflict({
    ...pms,
    bookings: pms.bookings.map((entry) => entry.id === booking.id ? candidate : entry),
    managedVehicles,
    startAt: today,
    endAt: today
  });

  await bookingRef.update({
    assignedBayId: bayId,
    actualCheckInAt: FieldValue.serverTimestamp(),
    status: "checked_in",
    checkedInBy: actorUid,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function checkOutWarehousePmsBooking(bookingId: string, input: Record<string, unknown>, actorUid: string) {
  const db = getAdminDb();
  const bookingRef = db.collection(BOOKINGS_COLLECTION).doc(bookingId);
  const bookingSnapshot = await bookingRef.get();
  if (!bookingSnapshot.exists) throw new WarehousePmsError("Storage booking not found.", 404);
  const booking = serializeBooking(bookingSnapshot.id, bookingSnapshot.data() ?? {});
  if (!booking.actualCheckInAt) throw new WarehousePmsError("A booking must be checked in before check-out.");
  if (booking.actualCollectionAt) throw new WarehousePmsError("This booking has already been checked out.");
  const manualBillingOverride = input.manualBillingOverride === "" || input.manualBillingOverride === undefined
    ? undefined
    : Math.max(0, asNumber(input.manualBillingOverride));
  await bookingRef.update({
    actualCollectionAt: FieldValue.serverTimestamp(),
    status: "checked_out",
    checkedOutBy: actorUid,
    additionalStorageCharges: Math.max(0, asNumber(input.additionalStorageCharges, booking.additionalStorageCharges)),
    ...(manualBillingOverride === undefined ? {} : { manualBillingOverride }),
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function extendWarehousePmsBooking(bookingId: string, newPlannedCollectionAtInput: unknown, actorUid: string) {
  const newPlannedCollectionAt = asDateString(newPlannedCollectionAtInput, "New planned collection");
  const db = getAdminDb();
  const [pms, managedVehicles] = await Promise.all([getTransactionalPmsData(), getManagedVehicles()]);
  const booking = pms.bookings.find((entry) => entry.id === bookingId);
  if (!booking) throw new WarehousePmsError("Storage booking not found.", 404);
  if (booking.actualCollectionAt) throw new WarehousePmsError("Checked-out bookings cannot be extended.");
  if (new Date(newPlannedCollectionAt).getTime() <= new Date(booking.plannedCollectionAt).getTime()) {
    throw new WarehousePmsError("The new planned collection must be later than the current planned collection.");
  }
  const candidate = { ...booking, plannedCollectionAt: newPlannedCollectionAt, status: "extended" as const };
  assertNoCapacityConflict({
    ...pms,
    bookings: pms.bookings.map((entry) => entry.id === booking.id ? candidate : entry),
    managedVehicles,
    startAt: booking.plannedCollectionAt,
    endAt: newPlannedCollectionAt
  });
  const extensionRef = db.collection(EXTENSIONS_COLLECTION).doc();
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(db.collection(BOOKINGS_COLLECTION).doc(bookingId));
    if (!current.exists || current.data()?.actualCollectionAt) throw new WarehousePmsError("This booking is no longer available for extension.", 409);
    transaction.create(extensionRef, {
      bookingId,
      bookingReference: booking.reference,
      previousPlannedCollectionAt: Timestamp.fromDate(new Date(booking.plannedCollectionAt)),
      newPlannedCollectionAt: Timestamp.fromDate(new Date(newPlannedCollectionAt)),
      extensionDays: Math.ceil((new Date(newPlannedCollectionAt).getTime() - new Date(booking.plannedCollectionAt).getTime()) / (24 * 60 * 60 * 1000)),
      additionalEstimatedCharge: getWarehouseBookingExtensionEstimate(booking, newPlannedCollectionAt),
      requestedAt: FieldValue.serverTimestamp(),
      approvedBy: actorUid,
      createdAt: FieldValue.serverTimestamp()
    });
    transaction.update(current.ref, {
      plannedCollectionAt: Timestamp.fromDate(new Date(newPlannedCollectionAt)),
      originalPlannedCollectionAt: current.data()?.originalPlannedCollectionAt || Timestamp.fromDate(new Date(booking.plannedCollectionAt)),
      status: "extended",
      updatedAt: FieldValue.serverTimestamp()
    });
  });
}

export async function updateWarehousePmsBay(bayId: string, input: Record<string, unknown>) {
  const nextState = asString(input.baseState);
  if (!["available", "temporarily_blocked", "maintenance"].includes(nextState)) throw new WarehousePmsError("Invalid warehouse bay state.");
  const db = getAdminDb();
  const bayRef = db.collection(BAYS_COLLECTION).doc(bayId);
  const [baySnapshot, pms, managedVehicles] = await Promise.all([bayRef.get(), getTransactionalPmsData(), getManagedVehicles()]);
  if (!baySnapshot.exists) throw new WarehousePmsError("Warehouse bay not found.", 404);
  const today = warehouseDateKey(new Date());
  const currentBooking = pms.bookings.find((booking) => booking.assignedBayId === bayId && booking.actualCheckInAt && !booking.actualCollectionAt);
  const currentOccupancy = pms.occupancies.find((occupancy) => occupancy.bayId === bayId && occupancy.occupiedFrom && !occupancy.releasedAt);
  if (nextState !== "available" && (currentBooking || currentOccupancy)) {
    throw new WarehousePmsError("An occupied bay cannot be blocked or put into maintenance.", 409, "bay_occupied");
  }
  if (nextState !== "available") {
    const candidateBays = pms.bays.map((entry) => entry.id === bayId ? { ...entry, baseState: nextState as WarehousePmsBay["baseState"] } : entry);
    const activeReservationEnd = pms.bookings
      .filter((booking) => !booking.actualCollectionAt && !["draft", "cancelled", "no_show", "checked_out"].includes(booking.status))
      .map((booking) => booking.plannedCollectionAt)
      .sort()
      .at(-1) || today;
    assertNoCapacityConflict({
      ...pms,
      bays: candidateBays,
      managedVehicles,
      startAt: today,
      endAt: activeReservationEnd
    });
  }
  await bayRef.update({
    baseState: nextState,
    notes: asOptionalString(input.notes) || "",
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function updateWarehousePmsSettings(input: Record<string, unknown>) {
  const db = getAdminDb();
  const settingsRef = db.collection(SETTINGS_COLLECTION).doc("default");
  const existing = await settingsRef.get();
  if (!existing.exists) throw new WarehousePmsError("Initialize Warehouse PMS before changing its settings.", 409);
  const monthlyRate = Math.max(0, asNumber(input.defaultMonthlyRate, DEFAULT_SETTINGS.defaultMonthlyRate));
  const dailyRate = Math.max(0, asNumber(input.defaultDailyRate, DEFAULT_SETTINGS.defaultDailyRate));
  await settingsRef.update({ defaultMonthlyRate: monthlyRate, defaultDailyRate: dailyRate, updatedAt: FieldValue.serverTimestamp() });
}

export async function upsertWarehousePmsManagedOccupancy(input: Record<string, unknown>, actorUid: string) {
  const sourceId = asString(input.sourceId);
  const bayId = asString(input.bayId);
  if (!sourceId || !bayId) throw new WarehousePmsError("A managed vehicle and bay are required.");
  const [pms, managedVehicles] = await Promise.all([getTransactionalPmsData(), getManagedVehicles()]);
  const managedVehicle = managedVehicles.find((vehicle) => vehicle.id === sourceId);
  if (!managedVehicle) throw new WarehousePmsError("Warehouse Managed vehicle not found.", 404);
  const bay = pms.bays.find((entry) => entry.id === bayId);
  if (!bay || bay.baseState !== "available") throw new WarehousePmsError("Select an available warehouse bay.");
  const today = warehouseDateKey(new Date());
  const occupied = pms.bookings.some((booking) => booking.assignedBayId === bayId && booking.actualCheckInAt && !booking.actualCollectionAt)
    || pms.occupancies.some((occupancy) => occupancy.bayId === bayId && occupancy.sourceId !== sourceId && occupancy.occupiedFrom && !occupancy.releasedAt);
  if (occupied) throw new WarehousePmsError("That bay is already occupied.", 409, "bay_occupied");
  const existing = pms.occupancies.find((occupancy) => occupancy.sourceType === "managed_vehicle" && occupancy.sourceId === sourceId && !occupancy.releasedAt);
  if (existing) throw new WarehousePmsError("Release this vehicle's current bay before assigning another bay.", 409, "managed_vehicle_already_assigned");
  const occupancyRef = getAdminDb().collection(OCCUPANCY_COLLECTION).doc();
  const candidate: WarehousePmsOccupancy = {
    id: "candidate",
    sourceType: "managed_vehicle",
    sourceId,
    bayId,
    label: managedVehicle.title,
    rego: managedVehicle.rego || "",
    vehicleReference: managedVehicle.vehicleReference || "",
    occupiedFrom: new Date().toISOString(),
    plannedDepartureAt: undefined,
    createdBy: actorUid,
  };
  assertNoCapacityConflict({
    ...pms,
    occupancies: [...pms.occupancies, candidate],
    managedVehicles,
    startAt: today,
    endAt: today
  });
  await occupancyRef.create({
    sourceType: candidate.sourceType,
    sourceId: candidate.sourceId,
    bayId: candidate.bayId,
    label: candidate.label,
    rego: candidate.rego || "",
    vehicleReference: candidate.vehicleReference || "",
    occupiedFrom: FieldValue.serverTimestamp(),
    plannedDepartureAt: null,
    createdBy: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function releaseWarehousePmsManagedOccupancy(occupancyId: string, actorUid: string) {
  const db = getAdminDb();
  const occupancyRef = db.collection(OCCUPANCY_COLLECTION).doc(occupancyId);
  const occupancySnapshot = await occupancyRef.get();
  if (!occupancySnapshot.exists) throw new WarehousePmsError("Managed vehicle bay assignment not found.", 404);
  const occupancy = serializeOccupancy(occupancySnapshot.id, occupancySnapshot.data() ?? {});
  if (occupancy.sourceType !== "managed_vehicle") throw new WarehousePmsError("Only Managed vehicle bay assignments can be released here.");
  if (occupancy.releasedAt) throw new WarehousePmsError("This Managed vehicle bay assignment has already been released.");
  await occupancyRef.update({
    releasedAt: FieldValue.serverTimestamp(),
    releasedBy: actorUid,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function getWarehousePmsOverviewForToday() {
  const snapshot = await loadWarehousePmsSnapshot();
  const today = buildWarehousePmsForecast({
    settings: snapshot.settings,
    bays: snapshot.bays,
    bookings: snapshot.bookings,
    occupancies: snapshot.occupancies,
    managedVehicles: snapshot.managedVehicles,
    startAt: new Date(),
    days: 1
  })[0];
  return { snapshot, today };
}
