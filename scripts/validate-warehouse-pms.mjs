#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { Firestore } from "firebase-admin/firestore";

const projectRoot = process.cwd();

function readProjectFile(pathname) {
  return readFileSync(join(projectRoot, pathname), "utf8");
}

function loadWarehousePmsModule() {
  const source = readProjectFile("lib/warehouse-pms.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(transpiled, {
    module,
    exports: module.exports,
    console,
    Date,
    Math,
    Array,
    Set,
    Number,
    String,
    require(moduleName) {
      if (moduleName === "@/lib/warehouse-pms-types") return {};
      throw new Error(`Unexpected test import: ${moduleName}`);
    }
  }, { filename: "lib/warehouse-pms.ts" });
  return module.exports;
}

function loadWarehouseBookingDataModule() {
  const source = readProjectFile("lib/warehouse-pms-booking-data.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(transpiled, { module, exports: module.exports, Object }, { filename: "lib/warehouse-pms-booking-data.ts" });
  return module.exports;
}

const pms = loadWarehousePmsModule();
const bookingData = loadWarehouseBookingDataModule();

class MockTimestamp {
  constructor(date) {
    this.date = date;
  }

  static fromDate(date) {
    return new MockTimestamp(date);
  }

  toDate() {
    return this.date;
  }
}

function createWarehousePmsFirestoreMock() {
  const collections = new Map();
  const documentsFor = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const snapshotFor = (id, data) => ({
    id,
    exists: data !== undefined,
    data: () => data
  });

  class DocumentReference {
    constructor(collectionName, id) {
      this.collectionName = collectionName;
      this.id = id;
    }

    async get() {
      return snapshotFor(this.id, documentsFor(this.collectionName).get(this.id));
    }
  }

  class CollectionReference {
    constructor(name) {
      this.name = name;
    }

    doc(id) {
      return new DocumentReference(this.name, id || `mock-${documentsFor(this.name).size + 1}`);
    }

    async get() {
      return {
        docs: [...documentsFor(this.name).entries()].map(([id, data]) => snapshotFor(id, data))
      };
    }
  }

  const db = {
    collection(name) {
      return new CollectionReference(name);
    },
    async runTransaction(callback) {
      return callback({
        get(reference) {
          return reference.get();
        },
        create(reference, data) {
          const documents = documentsFor(reference.collectionName);
          if (documents.has(reference.id)) throw new Error("Document already exists.");
          if (Object.values(data).some((value) => value === undefined)) throw new Error("Undefined Firestore field.");
          documents.set(reference.id, { ...data });
        }
      });
    }
  };

  return { db, collections };
}

function loadWarehousePmsServerModule(db) {
  const source = readProjectFile("lib/warehouse-pms-server.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(transpiled, {
    module,
    exports: module.exports,
    Date,
    Promise,
    Math,
    Array,
    Object,
    Set,
    String,
    Number,
    require(moduleName) {
      if (moduleName === "server-only" || moduleName === "@/lib/warehouse-pms-types") return {};
      if (moduleName === "firebase-admin/firestore") return {
        FieldValue: { serverTimestamp: () => ({ kind: "serverTimestamp" }) },
        Timestamp: MockTimestamp
      };
      if (moduleName === "@/lib/firebase-admin-server") return { getAdminDb: () => db };
      if (moduleName === "@/lib/warehouse-pms") return pms;
      if (moduleName === "@/lib/warehouse-pms-booking-data") return bookingData;
      throw new Error(`Unexpected test import: ${moduleName}`);
    }
  }, { filename: "lib/warehouse-pms-server.ts" });
  return module.exports;
}

const serverSource = readProjectFile("lib/warehouse-pms-server.ts");
const routeSource = readProjectFile("app/api/admin/warehouse/route.ts");
const workspaceSource = readProjectFile("components/admin/warehouse-pms-workspace.tsx");
const pageSource = readProjectFile("app/admin/warehouse/page.tsx");
const constantsSource = readProjectFile("lib/constants.ts");
const firestoreRules = readProjectFile("firestore.rules");
const storageRules = readProjectFile("storage.rules");

const localFirestore = new Firestore({ projectId: "warehouse-pms-local-test" });
const localBookingRef = localFirestore.collection("warehousePmsBookings").doc("local-booking");
assert.throws(
  () => localFirestore.batch().create(localBookingRef, { customerId: "customer-test", notes: undefined }),
  /Cannot use "undefined" as a Firestore value/,
  "Firebase Admin must reject undefined booking document values before commit."
);
const serializableBooking = bookingData.omitUndefinedWarehousePmsFields({
  customerId: "customer-test",
  vehicleId: "vehicle-test",
  notes: undefined,
  vehicleVin: undefined,
  monthlyRate: 380,
  dailyRate: 12.67
});
assert.deepEqual(serializableBooking, {
  customerId: "customer-test",
  vehicleId: "vehicle-test",
  monthlyRate: 380,
  dailyRate: 12.67
}, "Warehouse booking data must omit optional undefined fields.");
assert.doesNotThrow(
  () => localFirestore.batch().create(localBookingRef, serializableBooking),
  "A sanitized Warehouse booking document must pass Firebase Admin validation without a network commit."
);

const { db: mockWarehouseDb, collections: mockWarehouseCollections } = createWarehousePmsFirestoreMock();
const warehouseServer = loadWarehousePmsServerModule(mockWarehouseDb);
const futureCheckIn = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const futureCollection = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();
const validBookingInput = {
  creationRequestId: "11111111-1111-4111-8111-111111111111",
  customerId: "customer-test",
  customerName: "Test Customer",
  customerEmail: "",
  customerPhone: "",
  vehicleId: "vehicle-test",
  vehicleSource: "vehicle",
  vehicleTitle: "2025 Test Coupe",
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleVariant: "",
  vehicleRego: "",
  vehicleVin: "",
  vehicleReference: "",
  linkedStorageContractId: "",
  plannedCheckInAt: futureCheckIn,
  plannedCollectionAt: futureCollection,
  monthlyRate: "380",
  dailyRate: "12.67",
  additionalStorageCharges: "0",
  status: "confirmed",
  notes: ""
};
const firstCreatedBooking = await warehouseServer.createWarehousePmsBooking(validBookingInput, "admin-test");
const mockBookings = mockWarehouseCollections.get("warehousePmsBookings");
assert.equal(mockBookings.size, 1, "A valid Warehouse booking should create one booking document.");
assert.equal(mockBookings.get(firstCreatedBooking.id).monthlyRate, 380, "The stored booking must retain the submitted $380 monthly rate.");
assert.equal("notes" in mockBookings.get(firstCreatedBooking.id), false, "Optional blank booking fields must not be written as undefined.");
const retriedBooking = await warehouseServer.createWarehousePmsBooking(validBookingInput, "admin-test");
assert.deepEqual(retriedBooking, firstCreatedBooking, "Retrying the same booking request must return the original booking.");
assert.equal(mockBookings.size, 1, "An idempotent retry must not create a duplicate booking document.");
await assert.rejects(
  () => warehouseServer.createWarehousePmsBooking({
    ...validBookingInput,
    creationRequestId: "22222222-2222-4222-8222-222222222222",
    plannedCheckInAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }, "admin-test"),
  (error) => error?.message === "Planned check-in cannot be in the past." && error.status === 400,
  "A past planned check-in must return a clear validation error."
);
assert.equal(mockBookings.size, 1, "A rejected booking must not create a partial booking document.");

const settings = { id: "default", defaultMonthlyRate: 380, defaultDailyRate: 12.67, bayCapacity: 20 };
const bays = Array.from({ length: 20 }, (_, index) => ({
  id: `bay-${String(index + 1).padStart(2, "0")}`,
  label: `Bay ${String(index + 1).padStart(2, "0")}`,
  sequence: index + 1,
  baseState: "available"
}));

function booking(overrides = {}) {
  return {
    id: "booking-1",
    reference: "WHS-TEST-1",
    customerName: "Test Customer",
    vehicleTitle: "2024 Test Coupe",
    plannedCheckInAt: "2026-10-20T09:00:00.000Z",
    plannedCollectionAt: "2026-11-19T09:00:00.000Z",
    monthlyRate: 380,
    dailyRate: 12.67,
    rateOverride: false,
    additionalStorageCharges: 0,
    status: "confirmed",
    createdBy: "admin-test",
    ...overrides
  };
}

function forecast(overrides = {}) {
  return pms.buildWarehousePmsForecast({
    settings,
    bays,
    bookings: [],
    occupancies: [],
    managedVehicles: [],
    startAt: "2026-10-20T09:00:00.000Z",
    days: 3,
    ...overrides
  });
}

assert.equal(pms.WAREHOUSE_PMS_DEFAULT_SETTINGS.bayCapacity, 20, "Default warehouse capacity should be 20 bays.");
assert.equal(bays.length, 20, "The initializer target should contain Bay 01 through Bay 20.");
assert.ok(serverSource.includes("if (!settingsSnapshot.exists)"), "Warehouse setup must not overwrite existing settings.");
assert.ok(serverSource.includes("if (!baySnapshots[index].exists)"), "Warehouse setup must only create missing bays.");

const managed = Array.from({ length: 100 }, (_, index) => ({ id: `managed-${index + 1}`, source: "vehicle", title: `Managed vehicle ${index + 1}`, occupiedFrom: "2026-10-01T09:00:00.000Z" }));
const noAssignmentForecast = forecast({ managedVehicles: managed });
assert.equal(noAssignmentForecast[0].managedOccupied, 0, "100 Warehouse Managed vehicles without PMS bays must consume zero capacity.");
assert.equal(noAssignmentForecast[0].physicalOccupied, 0, "Unassigned Warehouse Managed vehicles must not be physically occupied.");
assert.equal(noAssignmentForecast[0].availableCapacity, 20, "20 empty bays must remain available regardless of managed listing count.");
assert.deepEqual(
  pms.findWarehouseCapacityConflicts({ settings, bays, bookings: [], occupancies: [], managedVehicles: managed, startAt: "2026-10-20T09:00:00.000Z", endAt: "2026-10-20T09:00:00.000Z" }),
  [],
  "No storage bookings and no PMS assignments must not create a capacity warning."
);
const managedAssignment = {
  id: "managed-assignment-1",
  sourceType: "managed_vehicle",
  sourceId: "managed-1",
  bayId: "bay-01",
  label: "Managed vehicle 1",
  occupiedFrom: "2026-10-20T09:00:00.000Z",
  createdBy: "admin-test"
};
assert.equal(forecast({ managedVehicles: managed, occupancies: [managedAssignment] })[0].managedOccupied, 1, "An active Managed PMS bay assignment must consume one bay.");
assert.equal(forecast({ managedVehicles: managed, occupancies: [{ ...managedAssignment, releasedAt: "2026-10-20T12:00:00.000Z" }] })[0].managedOccupied, 0, "A released Managed PMS bay assignment must free capacity.");

const reservation = booking({ assignedBayId: undefined });
const reservationForecast = forecast({ bookings: [reservation] });
assert.equal(reservationForecast[0].reserved, 1, "A reservation should consume forecast capacity.");
assert.equal(reservationForecast[0].physicalOccupied, 0, "A reservation must not require a physical bay.");
assert.equal(forecast({ bookings: [booking({ status: "draft" })] })[0].reserved, 0, "Storage booking drafts must not reserve capacity.");

const checkedIn = booking({ actualCheckInAt: "2026-10-20T09:00:00.000Z", assignedBayId: "bay-01", status: "checked_in" });
assert.equal(forecast({ bookings: [checkedIn] })[0].physicalOccupied, 1, "Check-in should consume physical capacity.");
const board = pms.buildWarehouseBayBoard({ bays, bookings: [checkedIn], occupancies: [], startAt: "2026-10-20T09:00:00.000Z", days: 1 });
assert.equal(board[0].cells[0].state, "occupied", "Check-in must assign the chosen physical bay.");
assert.equal(forecast({ bookings: [checkedIn] })[2].physicalOccupied, 1, "Planned collection alone must not release occupied capacity.");
assert.equal(pms.getEffectiveWarehouseBookingStatus({ ...checkedIn, plannedCollectionAt: "2026-10-19T09:00:00.000Z" }, new Date("2026-10-20T12:00:00.000Z")), "overdue", "Overdue vehicles must remain distinguishable from checked-out vehicles.");
assert.equal(forecast({ bookings: [{ ...checkedIn, actualCollectionAt: "2026-10-20T12:00:00.000Z", status: "checked_out" }] })[1].physicalOccupied, 0, "Actual check-out must release physical capacity.");
assert.equal(forecast({ bookings: [{ ...checkedIn, vehicleId: "managed-1" }], managedVehicles: managed, occupancies: [managedAssignment] })[0].physicalOccupied, 1, "A checked-in booking must replace, not double-count, a matching Managed bay assignment.");

const conflictSettings = { ...settings, bayCapacity: 1 };
const conflicts = pms.findWarehouseCapacityConflicts({ settings: conflictSettings, bays: [bays[0]], bookings: [reservation], occupancies: [managedAssignment], managedVehicles: managed, startAt: reservation.plannedCheckInAt, endAt: reservation.plannedCollectionAt });
assert.ok(conflicts.length > 0, "Actual reservation or assignment overbooking must be rejected.");
const maintenanceForecast = forecast({ bays: [{ ...bays[0], baseState: "maintenance" }, ...bays.slice(1)], bookings: Array.from({ length: 19 }, (_, index) => booking({ id: `reserve-${index}`, reference: `WHS-${index}` })) });
assert.equal(maintenanceForecast[0].unavailable, 1, "Maintenance bays must reduce usable capacity.");
assert.equal(maintenanceForecast[0].isFull, true, "A maintenance bay plus 19 reservations should fully consume a 20-bay warehouse.");

const baseBooking = booking({ actualCheckInAt: "2026-10-20T09:00:00.000Z", plannedCollectionAt: "2026-10-30T09:00:00.000Z", status: "checked_in" });
assert.equal(pms.getWarehouseBookingExtensionEstimate(baseBooking, "2026-11-05T09:00:00.000Z"), 76.02, "Extension estimates should retain the booking's stored daily rate.");
assert.ok(serverSource.includes('collection(EXTENSIONS_COLLECTION).doc()'), "Each extension must create a dedicated Warehouse extension history record.");
assert.ok(serverSource.includes("previousPlannedCollectionAt"), "Extension history must preserve the prior collection date.");

const billing = pms.calculateWarehouseBilling({ startAt: "2026-10-01T09:00:00.000Z", endAt: "2026-11-06T09:00:00.000Z", monthlyRate: 380, dailyRate: 12.67 });
assert.equal(billing.completeThirtyDayCycles, 1, "Thirty complete days should use the monthly rate.");
assert.equal(billing.extraDays, 6, "36 storage days should have 6 extra daily-rate days.");
assert.equal(billing.finalTotal, 456.02, "Monthly plus six daily rates should calculate correctly.");
assert.equal(pms.calculateWarehouseBilling({ startAt: "2026-10-01", endAt: "2026-11-06", monthlyRate: 400, dailyRate: 10 }).finalTotal, 460, "Per-booking monthly and daily rate overrides must be honoured.");

const frozenManaged = Object.freeze([{ ...managed[0] }]);
const frozenBookings = Object.freeze([{ ...checkedIn }]);
const frozenBays = Object.freeze(bays.map((bay) => Object.freeze({ ...bay })));
forecast({ managedVehicles: frozenManaged, bookings: frozenBookings, bays: frozenBays });
assert.deepEqual(frozenManaged[0], managed[0], "Managed vehicle data must be read-only.");
assert.deepEqual(frozenBookings[0], checkedIn, "Existing vehicle-like records must not be mutated by calculation.");
assert.ok(serverSource.includes('db.collection("warehouseIntakes").get()'), "Storage Contracts may only be read for linked display.");
assert.equal(serverSource.includes('collection("warehouseIntakes").doc('), false, "Storage Contract documents must never be written by Warehouse PMS.");
assert.equal(serverSource.includes('collection("vehicles").doc('), false, "Existing vehicle documents must never be written by Warehouse PMS.");
assert.equal(serverSource.includes('collection("customerProfiles").doc('), false, "Customer documents must never be written by Warehouse PMS.");
assert.equal(serverSource.includes("accounting"), false, "Warehouse PMS must not create Accounting writes.");
assert.ok(serverSource.includes("releaseWarehousePmsManagedOccupancy"), "Managed bay release must preserve Warehouse PMS occupancy history.");
assert.ok(serverSource.includes("managed_vehicle_already_assigned"), "One Managed vehicle cannot receive a second active bay before release.");
assert.ok(serverSource.includes("That bay is already occupied."), "Two vehicles cannot occupy the same bay.");
assert.equal(readProjectFile("lib/warehouse-pms.ts").includes("effectiveManagedVehicles"), false, "Managed source records must never automatically become occupied capacity.");

assert.ok(routeSource.includes('requireVerifiedAdminApiAccess(request, "manageVehicles")'), "Warehouse API must require verified Admin authorization.");
assert.ok(routeSource.includes("AdminApiAuthError"), "Unauthorized API calls must return an authorization failure.");
assert.equal(workspaceSource.includes('action: "bootstrap"'), false, "Warehouse loading and refresh must not run a write-capable bootstrap request.");
assert.ok(workspaceSource.includes('const DEFAULT_NEW_BOOKING_MONTHLY_RATE = "380"'), "The approved new-booking monthly default must be $380.");
assert.ok(workspaceSource.includes('monthlyRate: DEFAULT_NEW_BOOKING_MONTHLY_RATE'), "New storage bookings must always start at the approved $380 monthly default.");
assert.ok(workspaceSource.includes('customerId: ""'), "New storage bookings must start without a selected customer.");
assert.ok(workspaceSource.includes('vehicleId: ""'), "New storage bookings must start without a selected vehicle.");
assert.ok(workspaceSource.includes("bookingSubmitInFlight.current"), "New storage booking submission must prevent an accidental double submit.");
assert.ok(workspaceSource.includes("bookingCreationRequestId"), "New storage booking requests must carry an idempotency key.");
assert.ok(workspaceSource.includes("Booking data could not be verified"), "A failed refresh must not incorrectly claim that bookings are empty.");
assert.ok(workspaceSource.includes("Warehouse API ${method} /api/admin/warehouse"), "Warehouse errors must identify the failed request method and endpoint.");
assert.ok(serverSource.includes("A customer selection is required for a storage booking."), "Server booking creation must require an explicit customer selection.");
assert.ok(serverSource.includes("A vehicle selection is required for a storage booking."), "Server booking creation must require an explicit vehicle selection.");
assert.ok(serverSource.includes("Planned check-in cannot be in the past."), "Past planned check-ins must return a clear validation error.");
assert.ok(serverSource.includes("omitUndefinedWarehousePmsFields({ ...payload, reference })"), "Booking writes must omit optional undefined fields before Firebase Admin validation.");
assert.ok(serverSource.includes("transaction.get(referenceDoc)"), "Warehouse booking creation must return an existing idempotent request rather than duplicate it.");
assert.ok(routeSource.includes('get("diagnostics") === "1"'), "Warehouse read diagnostics must be an explicit GET-only path.");
assert.ok(serverSource.includes('mode: "read_only" as const'), "Warehouse diagnostics must remain read-only.");
assert.ok(workspaceSource.includes("Storage bookings"), "Warehouse UI must expose Storage Bookings.");
assert.ok(workspaceSource.includes("Bay board"), "Warehouse UI must expose the Bay Board.");
assert.ok(workspaceSource.includes("Assign Managed Vehicle"), "Warehouse UI must allow an Admin to assign a Managed vehicle to a bay.");
assert.ok(workspaceSource.includes("Release Bay"), "Warehouse UI must allow an Admin to release a Managed vehicle bay.");
assert.ok(workspaceSource.includes("Extensions and overdue vehicles"), "Warehouse UI must expose Extensions / Overdue.");
assert.ok(workspaceSource.includes("Storage billing"), "Warehouse UI must expose Billing.");
assert.ok(workspaceSource.includes("Occupancy rate"), "Warehouse UI must expose Analytics.");
assert.ok(pageSource.includes('requiredPermission="manageVehicles"'), "Warehouse page must use the existing Admin permission boundary.");
assert.ok(constantsSource.includes('{ href: "/admin/warehouse", label: "Warehouse"'), "Warehouse must be an additive Admin navigation item.");
assert.equal(firestoreRules.includes("warehousePms"), false, "Firestore rules must not be broadened for server-only Warehouse PMS collections.");
assert.equal(storageRules.includes("warehousePms"), false, "Firebase Storage rules must not be changed for Warehouse PMS.");

console.log("Warehouse PMS validation passed.");
