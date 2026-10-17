#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

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

const pms = loadWarehousePmsModule();
const serverSource = readProjectFile("lib/warehouse-pms-server.ts");
const routeSource = readProjectFile("app/api/admin/warehouse/route.ts");
const workspaceSource = readProjectFile("components/admin/warehouse-pms-workspace.tsx");
const pageSource = readProjectFile("app/admin/warehouse/page.tsx");
const constantsSource = readProjectFile("lib/constants.ts");
const firestoreRules = readProjectFile("firestore.rules");
const storageRules = readProjectFile("storage.rules");

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
