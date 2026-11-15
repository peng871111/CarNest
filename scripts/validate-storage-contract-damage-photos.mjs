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

class MockTimestamp {
  constructor(value = new Date()) {
    this.value = value;
  }

  static now() {
    return new MockTimestamp(new Date("2026-11-15T01:02:03.000Z"));
  }

  toDate() {
    return this.value;
  }
}

function setNestedValue(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function createMockAdminDb(initialDocuments) {
  const collections = new Map([["warehouseIntakes", new Map(Object.entries(initialDocuments))]]);
  const auditEvents = [];

  return {
    collections,
    auditEvents,
    collection(name) {
      if (!collections.has(name)) collections.set(name, new Map());
      const documents = collections.get(name);
      return {
        doc(id) {
          return {
            async get() {
              const data = documents.get(id);
              return { exists: data !== undefined, data: () => data };
            },
            async update(updates) {
              const existing = documents.get(id);
              if (!existing) throw new Error("Missing document");
              for (const [key, value] of Object.entries(updates)) {
                if (key.includes(".")) setNestedValue(existing, key, value);
                else existing[key] = value;
              }
            },
          };
        },
        async add(data) {
          auditEvents.push(data);
          return { id: `audit-${auditEvents.length}` };
        },
        async get() {
          return { docs: [...documents.entries()].map(([id, data]) => ({ id, data: () => data })) };
        },
      };
    },
  };
}

function loadDeleteServer(db, bucket) {
  const source = readProjectFile("lib/warehouse-intake-delete-server.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
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
    Object,
    String,
    Promise,
    require(moduleName) {
      if (moduleName === "server-only") return {};
      if (moduleName === "firebase-admin/firestore") return { FieldValue: {}, Timestamp: MockTimestamp };
      if (moduleName === "@/lib/firebase-admin-server") return { getAdminDb: () => db, getAdminStorageBucket: () => bucket };
      if (moduleName === "@/lib/firebase-storage-paths") return { extractFirebaseStoragePath: (value) => value || "" };
      if (moduleName === "@/lib/warehouse-intake-config") {
        return { WAREHOUSE_PHOTO_SECTIONS: [{ key: "damagePhotos" }, { key: "frontExterior" }] };
      }
      if (moduleName === "@/lib/warehouse-intake-evidence") {
        return {
          canDeleteWarehouseIntakeDraftRecord: () => false,
          canDeleteWarehouseIntakePhotos: (intake) => !intake.vehicleId,
          isWarehouseIntakeLinkedToListing: (intake) => Boolean(intake.vehicleId),
        };
      }
      throw new Error(`Unexpected test import: ${moduleName}`);
    },
  }, { filename: "lib/warehouse-intake-delete-server.ts" });
  return module.exports;
}

function loadPhotoRouteForUnauthorizedTest() {
  const source = readProjectFile("app/api/admin/warehouse-intake/[id]/photos/[photoId]/route.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  class MockAdminApiAuthError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
  vm.runInNewContext(transpiled, {
    module,
    exports: module.exports,
    console,
    Promise,
    require(moduleName) {
      if (moduleName === "next/server") {
        return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } };
      }
      if (moduleName === "@/lib/admin-api-auth") {
        return {
          AdminApiAuthError: MockAdminApiAuthError,
          requireVerifiedAdminApiAccess: async () => { throw new MockAdminApiAuthError("Admin access is required.", 401); },
        };
      }
      if (moduleName === "@/lib/warehouse-intake-delete-server") {
        return {
          deleteWarehouseIntakePhoto: async () => { throw new Error("must not reach mutation"); },
          manageWarehouseIntakeDamagePhoto: async () => { throw new Error("must not reach mutation"); },
          WarehouseIntakeDeleteError: class extends Error {},
        };
      }
      throw new Error(`Unexpected route test import: ${moduleName}`);
    },
  }, { filename: "app/api/admin/warehouse-intake/[id]/photos/[photoId]/route.ts" });
  return module.exports;
}

const intakeId = "warehouse-intake-damage-test";
const basePath = `warehouse-intakes/${intakeId}/photos/damagePhotos`;
const initialIntake = {
  vehicleId: "vehicle-linked-test",
  customerProfileId: "customer-test",
  vehicleRecordId: "vehicle-record-test",
  signedPdfStoragePath: `warehouse-intakes/${intakeId}/pdf/signed.pdf`,
  photos: [
    { id: "damage-1", category: "damagePhotos", label: "Bonnet scratch", storagePath: `${basePath}/damage-1.jpg`, name: "damage-1.jpg", contentType: "image/jpeg" },
    { id: "damage-2", category: "damagePhotos", label: "Bonnet scratch", storagePath: `${basePath}/damage-2.jpg`, name: "damage-2.jpg", contentType: "image/jpeg" },
    { id: "damage-wheel-1", category: "damagePhotos", label: "Wheel rash", storagePath: `${basePath}/damage-wheel-1.jpg`, name: "damage-wheel-1.jpg", contentType: "image/jpeg" },
    { id: "front-1", category: "frontExterior", label: "Front exterior", storagePath: `warehouse-intakes/${intakeId}/photos/frontExterior/front-1.jpg`, name: "front-1.jpg", contentType: "image/jpeg" },
  ],
  vehicleReport: {
    damageRecords: [{ id: "body-1", gridCellId: "bonnet-centre", notes: "Original bonnet scratch note", photoIds: ["damage-1", "damage-2"] }],
    wheelDamageRecords: [{ id: "wheel-1", wheelPosition: "front_left", wheelZone: "outer_rim_top", notes: "Original wheel rash note", photoIds: ["damage-wheel-1"] }],
  },
};

const db = createMockAdminDb({ [intakeId]: structuredClone(initialIntake) });
const deletedStoragePaths = [];
const bucket = { file: (storagePath) => ({ delete: async () => { deletedStoragePaths.push(storagePath); } }) };
const server = loadDeleteServer(db, bucket);
const getIntake = () => db.collections.get("warehouseIntakes").get(intakeId);
const actor = { intakeId, actorUid: "admin-test", actorEmail: "admin@carnest.au" };

const deleted = await server.deleteWarehouseIntakePhoto({ ...actor, photoId: "damage-1", deletionReason: "Vehicle repaired" });
assert.equal(deleted.archived, true, "Damage photos must be archived, not hard-deleted, when removed from the current record.");
assert.equal(deletedStoragePaths.length, 0, "Archiving a linked damage photo must not remove the historical Storage object.");
assert.deepEqual(getIntake().vehicleReport.damageRecords[0].photoIds, ["damage-2"], "Deleting one photo must preserve the linked damage record and remove only that active reference.");
assert.equal(getIntake().damagePhotoHistory[0].photo.storagePath, `${basePath}/damage-1.jpg`, "Archive history must retain the original evidence path.");
assert.equal(getIntake().damagePhotoHistory[0].contractId, intakeId, "Archive history must retain the storage contract reference.");
assert.equal(getIntake().damagePhotoHistory[0].originalDamageNotes.join(" | "), "Original bonnet scratch note", "Archive history must retain the linked original damage note.");
assert.equal(getIntake().signedPdfStoragePath, initialIntake.signedPdfStoragePath, "Historical signed PDF metadata must remain unchanged.");

await assert.rejects(
  () => server.deleteWarehouseIntakePhoto({ ...actor, photoId: "front-1" }),
  (error) => error?.code === "listing_linked",
  "Linked non-damage photos must retain their existing deletion protection."
);

const replacementPhoto = {
  id: "damage-replacement-1",
  category: "damagePhotos",
  label: "Bonnet scratch - updated",
  storagePath: `${basePath}/damage-replacement-1.jpg`,
  name: "damage-replacement-1.jpg",
  contentType: "image/jpeg",
};
await server.manageWarehouseIntakeDamagePhoto({ ...actor, photoId: "damage-2", action: "replace", replacementPhoto });
assert.deepEqual(getIntake().vehicleReport.damageRecords[0].photoIds, [replacementPhoto.id], "Replacement must update the linked body-map reference without adding a duplicate damage record.");
assert.equal(getIntake().photos.filter((photo) => photo.id === replacementPhoto.id).length, 1, "Replacement must leave exactly one active replacement record without duplicates.");
assert.equal(getIntake().damagePhotoHistory.at(-1).action, "replaced", "Replacement must preserve the prior image in history.");

await server.manageWarehouseIntakeDamagePhoto({ ...actor, photoId: replacementPhoto.id, action: "update_note", note: "Reinspected before return to warehouse." });
assert.equal(getIntake().photos.find((photo) => photo.id === replacementPhoto.id).note, "Reinspected before return to warehouse.", "Damage-note edits must persist on the current active photo.");
assert.equal(getIntake().damagePhotoHistory.at(-1).previousNote, "", "Damage-note history must preserve the previous note.");

const afterRepairPhoto = {
  id: "after-repair-1",
  category: "damagePhotos",
  label: "Bonnet after repair",
  storagePath: `${basePath}/after-repair-1.jpg`,
  name: "after-repair-1.jpg",
  contentType: "image/jpeg",
};
await server.manageWarehouseIntakeDamagePhoto({
  ...actor,
  photoId: replacementPhoto.id,
  action: "mark_repaired",
  repairDate: "2026-11-14",
  repairDescription: "Bonnet scratch repaired and inspected on return.",
  repairVerified: true,
  afterRepairPhoto,
});
assert.equal(getIntake().vehicleReport.damageRecords[0].repairStatus, "verified", "Admin-verified repairs must be marked on their existing damage record.");
assert.equal(getIntake().photos.some((photo) => photo.id === replacementPhoto.id), false, "Verified repair evidence must no longer remain in the active current damage gallery.");
assert.equal(getIntake().damagePhotoHistory.at(-1).afterRepairPhoto.storagePath, afterRepairPhoto.storagePath, "After-repair evidence must stay in Admin-only history.");
assert.equal(deletedStoragePaths.length, 0, "Repair verification must preserve all historical Storage objects.");
assert.equal(getIntake().photos.some((photo) => photo.id === "damage-wheel-1"), true, "Repairing one body damage record must not alter unrelated wheel evidence.");

const replacementWheelPhoto = {
  id: "damage-wheel-replacement-1",
  category: "damagePhotos",
  label: "Wheel rash - updated",
  storagePath: `${basePath}/damage-wheel-replacement-1.jpg`,
  name: "damage-wheel-replacement-1.jpg",
  contentType: "image/jpeg",
};
await server.manageWarehouseIntakeDamagePhoto({ ...actor, photoId: "damage-wheel-1", action: "replace", replacementPhoto: replacementWheelPhoto });
assert.deepEqual(getIntake().vehicleReport.wheelDamageRecords[0].photoIds, [replacementWheelPhoto.id], "Replacement must retain wheel-zone links without creating another wheel damage record.");
assert.equal(getIntake().photos.some((photo) => photo.id === "front-1"), true, "Damage updates must not alter unrelated condition photos.");

const unlinkedIntakeId = "warehouse-intake-unlinked-test";
const unlinkedDamagePath = `warehouse-intakes/${unlinkedIntakeId}/photos/damagePhotos/unlinked-damage.jpg`;
db.collections.get("warehouseIntakes").set(unlinkedIntakeId, {
  vehicleId: "",
  photos: [{ id: "unlinked-damage", category: "damagePhotos", label: "Unlinked damage", storagePath: unlinkedDamagePath, contentType: "image/jpeg" }],
  vehicleReport: { damageRecords: [], wheelDamageRecords: [] },
});
const unlinkedDelete = await server.deleteWarehouseIntakePhoto({ ...actor, intakeId: unlinkedIntakeId, photoId: "unlinked-damage" });
assert.equal(unlinkedDelete.archived, true, "Unlinked damage photos must also leave the current record safely without hard-deleting inspection history.");
assert.equal(db.collections.get("warehouseIntakes").get(unlinkedIntakeId).photos.length, 0, "An unlinked damage photo must be removed from the active current record.");
assert.equal(deletedStoragePaths.length, 0, "Unlinked damage archival must preserve the original Storage object for history.");

const protectedRoute = loadPhotoRouteForUnauthorizedTest();
const unauthorizedResponse = await protectedRoute.PATCH(
  { json: async () => ({ action: "update_note", note: "attempt" }) },
  { params: Promise.resolve({ id: intakeId, photoId: "damage-wheel-replacement-1" }) }
);
assert.equal(unauthorizedResponse.status, 401, "Unauthorised callers must be rejected before a damage-photo mutation runs.");

const deleteSource = readProjectFile("lib/warehouse-intake-delete-server.ts");
const routeSource = readProjectFile("app/api/admin/warehouse-intake/[id]/photos/[photoId]/route.ts");
const intakePdfSource = readProjectFile("lib/warehouse-intake-pdf.ts");
const reportPdfSource = readProjectFile("lib/vehicle-report-pdf.ts");
assert.match(deleteSource, /isDamagePhoto\s*=\s*photo\.category\s*===\s*"damagePhotos"/, "Damage archival must be limited to the dedicated damage-photo category.");
assert.match(routeSource, /requireVerifiedAdminApiAccess\(request, "manageVehicles"\)/, "Damage photo mutations must remain Admin-authorized server-side.");
assert.match(intakePdfSource, /repairStatus !== "verified"/, "New Storage Contract PDFs must omit verified repaired damage.");
assert.match(reportPdfSource, /repairStatus === "verified"\) continue/, "New Condition Summary PDFs must omit verified repaired damage.");

console.log("Storage Contract damage photo management validation passed.");
