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

function loadPublicVehicleDetailsModule() {
  const source = readProjectFile("lib/public-vehicle-details.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const sandbox = {
    console,
    module,
    exports: module.exports,
    require(moduleName) {
      if (moduleName === "@/types") return {};
      throw new Error(`Unexpected test import: ${moduleName}`);
    },
  };

  vm.runInNewContext(transpiled, sandbox, { filename: "lib/public-vehicle-details.ts" });
  return module.exports;
}

const {
  applyPublicVehicleIdentitySnapshot,
  buildPublicVehicleIdentitySnapshot,
  buildPublicVehicleIdentityUpdatePayload,
} = loadPublicVehicleDetailsModule();

const cn0404Listing = {
  id: "listing-cn-0404",
  displayReference: "CN-0404",
  make: "",
  model: "RAV4 GXL AWD",
  variant: "",
  year: 2018,
  colour: "",
  rego: "",
  vin: "",
  mileage: 0,
  keyCount: "",
  regoExpiry: "",
};

const linkedVehicleRecord = {
  make: "TOYOTA",
  model: "RAV4",
  variant: "GXL AWD",
  year: "2018",
  registrationNumber: "1QD2IG",
  vinOrChassisNumber: "JTMRFREV00J262268",
  colour: "GREY",
  odometer: "111095",
  numberOfKeys: "2",
};

const cn0404Snapshot = buildPublicVehicleIdentitySnapshot({
  listing: cn0404Listing,
  vehicleRecord: linkedVehicleRecord,
});

assert.deepEqual(
  {
    make: cn0404Snapshot.make,
    model: cn0404Snapshot.model,
    variant: cn0404Snapshot.variant,
    rego: cn0404Snapshot.rego,
    vin: cn0404Snapshot.vin,
    year: cn0404Snapshot.year,
    colour: cn0404Snapshot.colour,
    mileage: cn0404Snapshot.mileage,
    keyCount: cn0404Snapshot.keyCount,
  },
  {
    make: "TOYOTA",
    model: "RAV4",
    variant: "GXL AWD",
    rego: "1QD2IG",
    vin: "JTMRFREV00J262268",
    year: 2018,
    colour: "GREY",
    mileage: 111095,
    keyCount: "2",
  },
  "CN-0404 linked vehicle-record values should map to separate public vehicle detail fields."
);

assert.equal(
  buildPublicVehicleIdentitySnapshot({ vehicleRecord: { registrationNo: "abc123" } }).rego,
  "ABC123",
  "registrationNo legacy alias should map to public Registration."
);
assert.equal(
  buildPublicVehicleIdentitySnapshot({ vehicleRecord: { registration: "xyz987" } }).rego,
  "XYZ987",
  "registration legacy alias should map to public Registration."
);
assert.equal(
  buildPublicVehicleIdentitySnapshot({ vehicleRecord: { rego: "def456" } }).rego,
  "DEF456",
  "rego legacy alias should map to public Registration."
);
assert.equal(
  buildPublicVehicleIdentitySnapshot({ vehicleRecord: { chassisNumber: "chassis-test-1" } }).vin,
  "CHASSIS-TEST-1",
  "chassisNumber legacy alias should map to public VIN."
);
assert.equal(
  buildPublicVehicleIdentitySnapshot({ vehicleRecord: { vinNumber: "vin-test-2" } }).vin,
  "VIN-TEST-2",
  "vinNumber legacy alias should map to public VIN."
);

const storageFallbackSnapshot = buildPublicVehicleIdentitySnapshot({
  listing: cn0404Listing,
  storageContract: {
    vehicleDetails: {
      make: "TOYOTA",
      model: "RAV4 GXL AWD",
      trim: "GXL AWD",
      registrationPlate: "1QD2IG",
      chassisNumber: "JTMRFREV00J262268",
    },
  },
});
assert.equal(storageFallbackSnapshot.model, "RAV4", "Variant suffix should be stripped from Model when Variant is available separately.");
assert.equal(storageFallbackSnapshot.variant, "GXL AWD", "trim alias should map to Variant.");
assert.equal(storageFallbackSnapshot.rego, "1QD2IG", "Storage Contract registrationPlate should map to Registration.");
assert.equal(storageFallbackSnapshot.vin, "JTMRFREV00J262268", "Storage Contract chassis alias should map to VIN.");

const prioritySnapshot = buildPublicVehicleIdentitySnapshot({
  listing: { ...cn0404Listing, make: "EMPTY LISTING", model: "WRONG MODEL", badge: "WRONG BADGE" },
  storageContract: { vehicleDetails: { make: "STORAGE MAKE", model: "STORAGE MODEL", variant: "STORAGE VARIANT" } },
  vehicleRecord: { make: "TOYOTA", model: "RAV4", variant: "GXL AWD" },
});
assert.equal(prioritySnapshot.make, "TOYOTA", "Canonical Vehicle Record should take priority over Storage Contract and Listing values.");
assert.equal(prioritySnapshot.model, "RAV4", "Canonical model should take priority over empty or stale listing values.");
assert.equal(prioritySnapshot.variant, "GXL AWD", "Canonical variant should remain separate from model.");

const updatePayload = buildPublicVehicleIdentityUpdatePayload(cn0404Listing, cn0404Snapshot);
assert.equal(updatePayload.model, "RAV4", "Public listing update should correct a concatenated model.");
assert.equal(updatePayload.variant, "GXL AWD", "Public listing update should fill Variant from the canonical source.");
assert.equal(updatePayload.rego, "1QD2IG", "Public listing update should fill Registration from the canonical source.");
assert.equal(updatePayload.vin, "JTMRFREV00J262268", "Public listing update should fill VIN from the canonical source.");

const enrichedVehicle = applyPublicVehicleIdentitySnapshot(
  {
    ...cn0404Listing,
    sellerId: "seller",
    ownerUid: "seller",
    ownerRole: "admin",
    listingType: "warehouse",
    status: "approved",
    sellerStatus: "ACTIVE",
    ownershipVerified: true,
    publishAuthorized: true,
    storedInWarehouse: true,
    price: 25000,
    transmission: "",
    fuelType: "",
    drivetrain: "",
    bodyType: "",
    description: "",
    features: [],
    conditionNotes: "",
    serviceHistory: "",
    imageUrls: [],
    images: [],
  },
  cn0404Snapshot
);
assert.equal(enrichedVehicle.model, "RAV4", "Enriched public vehicle should display Model without concatenated Variant.");
assert.equal(enrichedVehicle.variant, "GXL AWD", "Enriched public vehicle should display Variant separately.");
assert.equal(enrichedVehicle.rego, "1QD2IG", "Enriched public vehicle should display Registration.");
assert.equal(enrichedVehicle.vin, "JTMRFREV00J262268", "Enriched public vehicle should display VIN.");

console.log("Public vehicle detail mapping validation passed.");
