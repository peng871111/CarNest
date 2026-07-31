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

function loadSaleHandoverModule() {
  const source = readProjectFile("lib/sale-handover.ts");
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
    TextEncoder,
    crypto: globalThis.crypto,
    require(moduleName) {
      if (moduleName === "@/types") return {};
      if (moduleName === "@/lib/utils") {
        return {
          getVehicleDisplayReference(vehicle) {
            return vehicle.referenceNumber || vehicle.id || "CN-test";
          },
        };
      }
      throw new Error(`Unexpected test import: ${moduleName}`);
    },
  };

  vm.runInNewContext(transpiled, sandbox, { filename: "lib/sale-handover.ts" });
  return module.exports;
}

const saleHandover = loadSaleHandoverModule();

const warehouseListing = {
  id: "listing-warehouse-1",
  listingType: "warehouse",
  storedInWarehouse: true,
  year: 2021,
  make: "Mazda",
  model: "3",
  variant: "Pure",
  colour: "White",
  rego: "2CE5IY",
  regoExpiry: "2026-09-30",
  vin: "JM0TESTVIN1234567",
  mileage: 61000,
  keyCount: "2",
  price: 24000,
  referenceNumber: "CN-TEST-1",
};

assert.equal(saleHandover.isWarehouseManagedListing(warehouseListing), true, "Warehouse listings should be eligible.");
assert.equal(
  saleHandover.isWarehouseManagedListing({ ...warehouseListing, listingType: "private", storedInWarehouse: false }),
  false,
  "Ordinary listings should not be eligible."
);

const actor = {
  id: "admin-test",
  role: "admin",
  email: "admin@carnest.au",
  displayName: "Admin Test",
  adminPermissions: { manageVehicles: true },
};

const storageContract = {
  id: "warehouse-intake-test",
  customerProfileId: "customer-test",
  vehicleRecordId: "vehicle-record-test",
  ownerDetails: {
    fullName: "Fan Niu",
    phone: "0400000000",
    email: "fan@example.com",
    address: "1 Test Street",
    isLegalOwnerConfirmed: true,
  },
  vehicleDetails: {
    year: "2021",
    make: "Mazda",
    model: "3",
    variant: "Pure",
    colour: "White",
    registrationPlate: "2CE5IY",
    registrationExpiry: "2026-09-30",
    vin: "JM0TESTVIN1234567",
    odometer: "61000",
    numberOfKeys: "2",
  },
};

const imported = saleHandover.importSaleHandoverSnapshots({
  recordId: "sale-handover-test-1",
  listing: warehouseListing,
  storageContract,
  vehicleRecord: null,
  actor,
  now: "2026-07-31T10:00:00.000Z",
});

assert.equal(imported.status, "draft", "Imported records start as Draft.");
assert.equal(imported.seller.legalName, "Fan Niu", "Seller details should import from Storage Contract.");
assert.equal(imported.vehicle.registrationNumber, "2CE5IY", "Vehicle details should import from Storage Contract.");
assert.equal(imported.vehicle.listingReference, "CN-TEST-1", "Human-readable listing reference should be stored for source display.");
assert.equal(imported.sourceSnapshot.importedFromStorageContract, true, "Import source should be recorded.");
assert.equal(imported.sourceSnapshot.warnings.length, 0, "Linked Storage Contract should not create missing-contract warnings.");

const blankDraft = saleHandover.importSaleHandoverSnapshots({
  recordId: "sale-handover-test-2",
  listing: warehouseListing,
  storageContract: null,
  vehicleRecord: null,
  actor,
  now: "2026-07-31T10:00:00.000Z",
});
assert.equal(blankDraft.status, "draft", "Missing Storage Contract should still create a usable Draft.");
assert.ok(blankDraft.sourceSnapshot.warnings.some((warning) => warning.includes("No linked Storage Contract")), "Missing Storage Contract warning should be retained.");

const incompleteRecord = { id: "sale-handover-test-1", ...imported };
assert.equal(saleHandover.canSaleHandoverBeSigned(incompleteRecord), false, "Missing buyer/transaction confirmations should block signing.");
assert.ok(saleHandover.getSaleHandoverMissingRequiredFields(incompleteRecord).includes("Buyer legal or company name"));

const completeRecord = {
  ...incompleteRecord,
  buyer: {
    ...incompleteRecord.buyer,
    legalFirstName: "Amy",
    legalFamilyName: "Lee",
    phone: "0411111111",
    address: "2 Buyer Road",
  },
  vehicle: {
    ...incompleteRecord.vehicle,
    registrationStatus: "registered",
  },
  transaction: {
    ...incompleteRecord.transaction,
    purchasePrice: 24000,
    deposit: 2000,
    balance: 22000,
    saleDate: "2026-08-01",
    handoverDate: "2026-08-02",
    handoverLocation: "CarNest Warehouse",
    paymentMethod: "Direct bank transfer",
    paymentArrangement: "Buyer pays Seller directly before keys are released.",
  },
  confirmations: {
    sellerInformationReviewed: true,
    buyerInformationReviewed: true,
    vehicleInformationReviewed: true,
    noVicRoadsTransferAcknowledged: true,
    termsProvided: true,
  },
};
assert.equal(saleHandover.canSaleHandoverBeSigned(completeRecord), true, "Complete records should be signable.");
assert.equal(saleHandover.getSaleHandoverBuyerDisplayName(completeRecord.buyer), "Amy Lee");

const helperSource = readProjectFile("lib/sale-handover.ts");
const pdfSource = readProjectFile("lib/sale-handover-pdf.ts");
const workspaceSource = readProjectFile("components/admin/sale-handover-workspace.tsx");
const verificationSource = readProjectFile("app/sale-handover/verify/[id]/page.tsx");
const dataSource = readProjectFile("lib/data.ts");
const firestoreRules = readProjectFile("firestore.rules");
const storageRules = readProjectFile("storage.rules");
const vehicleHub = readProjectFile("components/admin/vehicle-management-hub.tsx");

assert.equal(pdfSource.includes("Condition Overview"), false, "Sale-handover PDF must not contain Condition Overview.");
assert.equal(pdfSource.includes("Documentation score"), false, "Sale-handover PDF must not contain condition score labels.");
assert.ok(pdfSource.includes("Seller signature"), "PDF should include seller signature section.");
assert.ok(pdfSource.includes("Buyer signature"), "PDF should include buyer signature section.");
assert.equal(pdfSource.includes("CarNest signature"), false, "PDF must not add CarNest as a sale signatory.");
assert.equal(pdfSource.includes("Listing ID"), false, "PDF must not display internal listing ID labels.");
assert.equal(pdfSource.includes("Vehicle record ID"), false, "PDF must not display internal vehicle record ID labels.");
assert.equal(pdfSource.includes("Prepared / recorded"), false, "PDF must not use the old prepared-by wording.");
assert.equal(pdfSource.includes("preparedByUid"), false, "PDF must not render Firebase/admin UIDs.");
assert.equal(pdfSource.includes("Document hash:"), false, "PDF must not display the raw document hash.");
assert.equal(pdfSource.includes("Verification QR"), false, "PDF must not use the vague QR label.");
assert.ok(pdfSource.includes("Prepared by CarNest"), "PDF should show clean prepared-by text.");
assert.ok(pdfSource.includes("Prepared on"), "PDF should show clean prepared-on text.");
assert.ok(pdfSource.includes("Verify this document"), "PDF should label the QR as document verification.");
assert.ok(pdfSource.includes("options?.documentHash"), "PDF should hide the QR unless hash-backed verification is available.");
assert.equal((pdfSource.match(/pdfDoc\.addPage/g) ?? []).length, 2, "Sale-handover PDF should intentionally create two pages.");
assert.ok(helperSource.includes("CarNest is not the buyer, seller or owner"), "Terms must preserve CarNest administrative positioning.");
assert.equal(helperSource.includes("CarNest accepts no liability whatsoever"), false, "Terms must not include broad unsupported liability waiver wording.");
assert.ok(workspaceSource.includes("Buyer details"), "Buyer Details should be the first visible workflow section.");
assert.equal(workspaceSource.includes('Field label="Listing ID"'), false, "Raw listingId should be hidden from the normal Vehicle Details form.");
assert.equal(workspaceSource.includes('Field label="Vehicle record ID"'), false, "Raw vehicleId should be hidden from the normal Vehicle Details form.");
assert.ok(workspaceSource.includes("Source record"), "Vehicle Details should show the read-only source summary.");
assert.ok(workspaceSource.includes("Listing reference"), "Vehicle Details should show the human-readable listing reference.");
assert.ok(workspaceSource.includes("Vehicle linked"), "Vehicle Details should show whether the vehicle record is linked.");
assert.ok(workspaceSource.includes("Storage Contract linked"), "Vehicle Details should show whether the Storage Contract is linked.");
assert.ok(workspaceSource.includes("Technical details"), "Raw IDs should only be available in collapsed technical details.");
assert.ok(workspaceSource.includes("Clear seller signature"), "Seller signature canvas should have an independent clear button.");
assert.ok(workspaceSource.includes("Clear buyer signature"), "Buyer signature canvas should have an independent clear button.");
assert.ok(workspaceSource.includes("Replace signature"), "Saved signatures should require an explicit replacement action.");
assert.ok(workspaceSource.includes("This will remove the saved"), "Saved signature replacement should require confirmation.");
assert.ok(dataSource.includes("clearSaleHandoverSignature"), "Data layer should support audited selected-signature clearing.");
assert.ok(dataSource.includes('signerRole === "seller" ? null : record.sellerSignature'), "Replacing one signature must not clear the other party's signature.");
assert.ok(dataSource.includes("previousRecord.sellerSignature"), "Ordinary save should preserve existing signatures.");
assert.ok(dataSource.includes("hadFinalSignedPdf"), "Finalised signature replacement should branch through version preservation.");
assert.ok(dataSource.includes("documentVersion: hadFinalSignedPdf ? record.documentVersion + 1"), "Finalised signature replacement should create a new document version.");
assert.ok(dataSource.includes("pdfHistory"), "Historical signed PDFs should remain preserved.");
assert.ok(vehicleHub.includes("isWarehouseManagedListing(vehicle)"), "Admin Vehicles action should be warehouse-gated.");
assert.ok(firestoreRules.includes("match /saleHandoverRecords/{id}"), "Firestore rules should include the isolated collection.");
assert.ok(firestoreRules.includes('hasAdminPermission("manageVehicles")'), "Firestore rule should use the existing manageVehicles admin permission.");
assert.ok(storageRules.includes("match /sale-handover-records/{recordId}/{allPaths=**}"), "Storage rules should include the isolated namespace.");
assert.equal(storageRules.includes("allow read, write: if true"), false, "Storage rules must not be globally opened.");
assert.equal(verificationSource.includes("purchasePrice"), false, "Public verification page must not reveal transaction price.");
assert.equal(verificationSource.includes("phone"), false, "Public verification page must not reveal phone numbers.");
assert.equal(verificationSource.includes("email"), false, "Public verification page must not reveal email addresses.");
assert.ok(verificationSource.includes("Document integrity"), "Verification page should expose a simple integrity status.");
assert.ok(verificationSource.includes("Valid"), "Verification page should show a valid integrity state without exposing the raw hash.");
assert.ok(verificationSource.includes("Unable to verify"), "Verification page should show a safe failed integrity state.");
assert.ok(verificationSource.includes("Document status"), "Verification page should show Draft, Signed or Superseded status.");
assert.ok(verificationSource.includes("Vehicle"), "Verification page should show the safe vehicle year, make and model summary.");
assert.equal(verificationSource.includes("signatureStoragePath}</p>"), false, "Public verification page must not render signature paths.");

console.log("Sale & Handover validation passed.");
