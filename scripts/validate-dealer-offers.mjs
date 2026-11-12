#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const projectRoot = process.cwd();
const nodeRequire = createRequire(import.meta.url);
const read = (pathname) => readFileSync(join(projectRoot, pathname), "utf8");

function loadModule(pathname, resolve) {
  const output = ts.transpileModule(read(pathname), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    Promise,
    URLSearchParams,
    process: { env: {} },
    console,
    require: resolve
  }, { filename: pathname });
  return module.exports;
}

const publicValidation = loadModule("lib/public-vehicle-action-validation.ts", (moduleName) => {
  if (moduleName === "@/types") return {};
  throw new Error(`Unexpected validation import: ${moduleName}`);
});
const validation = loadModule("lib/dealer-offer-validation.ts", (moduleName) => {
  if (moduleName === "@/lib/public-vehicle-action-validation") return publicValidation;
  if (moduleName === "@/types") return {};
  throw new Error(`Unexpected dealer validation import: ${moduleName}`);
});

const validInput = {
  vehicleId: "vehicle-12345678",
  dealershipName: "Example Motors",
  contactName: "Alex Dealer",
  phone: "+61 412 345 678",
  offerAmount: 44000,
  email: "alex@examplemotors.test",
  preferredInspectionDate: "2026-12-01",
  comments: "Subject to inspection.",
  idempotencyKey: "12345678-1234-4123-8123-123456789012"
};

assert.equal(Object.keys(validation.getDealerOfferValidationErrors(validInput)).length, 0, "A valid dealer offer must pass local validation.");
assert.equal(validation.getDealerOfferValidationErrors({ ...validInput, dealershipName: "" }).dealershipName, "Please enter the dealership name.");
assert.equal(validation.getDealerOfferValidationErrors({ ...validInput, contactName: "" }).contactName, "Please enter the buyer or contact name.");
assert.equal(validation.getDealerOfferValidationErrors({ ...validInput, phone: "123" }).phone, "Please enter a valid phone number.");
assert.equal(validation.getDealerOfferValidationErrors({ ...validInput, offerAmount: 0 }).offerAmount, "Please enter a valid offer amount.");
assert.equal(validation.getDealerOfferValidationErrors({ ...validInput, email: "not-an-email" }).email, "Please enter a valid email address.");
assert.equal(validation.getDealerOfferValidationErrors({ ...validInput, preferredInspectionDate: "2026-02-30" }).preferredInspectionDate, "Please choose a valid inspection date.");
assert.equal(
  Object.keys(validation.getDealerOfferValidationErrors({ ...validInput, email: "", preferredInspectionDate: "", comments: "" })).length,
  0,
  "Dealer email, preferred inspection date, and comments must remain optional."
);
assert.equal(validation.getDealerOfferValidationErrors({ ...validInput, offerAmount: 1 }).offerAmount, undefined, "Dealer offers must not use Private Offer minimum-price restrictions.");

class MockTimestamp {
  constructor(milliseconds) {
    this.milliseconds = milliseconds;
  }
  static now() { return new MockTimestamp(Date.now()); }
  static fromMillis(milliseconds) { return new MockTimestamp(milliseconds); }
  toDate() { return new Date(this.milliseconds); }
  toMillis() { return this.milliseconds; }
}

function createFirestoreMock() {
  const collections = new Map();
  const docs = (collection) => {
    if (!collections.has(collection)) collections.set(collection, new Map());
    return collections.get(collection);
  };
  class Ref {
    constructor(collection, id) { this.collection = collection; this.id = id; }
    async get() {
      const data = docs(this.collection).get(this.id);
      return { id: this.id, exists: data !== undefined, data: () => data };
    }
  }
  class Collection {
    constructor(name) { this.name = name; }
    doc(id) { return new Ref(this.name, id); }
    orderBy() { return this; }
    limit() { return this; }
    async get() {
      return { docs: [...docs(this.name).entries()].map(([id, data]) => ({ id, data: () => data })) };
    }
  }
  const db = {
    collection(name) { return new Collection(name); },
    async runTransaction(callback) {
      return callback({
        get(reference) { return reference.get(); },
        set(reference, data, options) {
          const current = docs(reference.collection).get(reference.id) ?? {};
          const next = options?.merge ? { ...current } : {};
          for (const [key, value] of Object.entries(data)) {
            next[key] = value?.kind === "increment" ? Number(current[key] ?? 0) + value.amount : value;
          }
          docs(reference.collection).set(reference.id, next);
        },
        update(reference, data) {
          const current = docs(reference.collection).get(reference.id);
          if (!current) throw new Error("Missing document");
          docs(reference.collection).set(reference.id, { ...current, ...data });
        }
      });
    }
  };
  return { db, collections };
}

const { db, collections } = createFirestoreMock();
const activeVehicle = {
  id: validInput.vehicleId,
  year: 2024,
  make: "Lexus",
  model: "RX",
  variant: "Luxury",
  price: 54000,
  status: "approved",
  sellerStatus: "ACTIVE",
  deleted: false,
  displayReference: "CN-TEST-001"
};
let resolvedVehicle = activeVehicle;
const deliveredDealerNotifications = [];
const dealerOffers = loadModule("lib/dealer-offers.ts", (moduleName) => {
  if (moduleName === "server-only") return {};
  if (moduleName === "node:crypto") return nodeRequire("node:crypto");
  if (moduleName === "firebase-admin/firestore") return {
    Timestamp: MockTimestamp,
    FieldValue: { increment: (amount) => ({ kind: "increment", amount }), serverTimestamp: () => ({ kind: "serverTimestamp" }) }
  };
  if (moduleName === "@/lib/dealer-offer-validation") return validation;
  if (moduleName === "@/lib/firebase-admin-server") return { getAdminDb: () => db };
  if (moduleName === "@/lib/offer-admin-notifications") {
    return { deliverAdminOfferNotification: async (input) => { deliveredDealerNotifications.push(input); return { attempted: true, sent: true, providerMessageId: "resend-dealer-test" }; } };
  }
  if (moduleName === "@/lib/vehicle-admin-server") return { getAdminVehicleById: async () => resolvedVehicle };
  if (moduleName === "@/lib/utils") return { getVehicleDisplayReference: (vehicle) => vehicle.displayReference || vehicle.id };
  if (moduleName === "@/types") return {};
  throw new Error(`Unexpected dealer server import: ${moduleName}`);
});

const request = { headers: { get: (name) => name === "x-forwarded-for" ? "203.0.113.99" : "" } };
const firstResult = await dealerOffers.submitDealerOffer({ input: validInput, request, turnstileToken: "" });
assert.equal(firstResult.duplicate, false, "The first valid dealer offer must create a record.");
const storedOffers = collections.get("dealerOffers");
assert.equal(storedOffers.size, 1, "A valid submission must create exactly one Dealer Offer document.");
const storedOffer = [...storedOffers.values()][0];
assert.equal(storedOffer.askingPriceAtSubmission, 54000, "The asking price must be server-derived from the vehicle.");
assert.equal(storedOffer.vehicleReference, "CN-TEST-001", "The vehicle reference must be server-derived.");
assert.equal(storedOffer.status, "new", "New Dealer Offers must begin in the new status.");
assert.equal("ownerUid" in storedOffer, false, "Dealer submissions must not write owner/customer identifiers.");
assert.equal("submissionIpHash" in storedOffer, true, "Abuse controls must store only a hashed IP identifier.");
assert.equal(storedOffer.adminNotificationStatus, "pending", "Dealer Offers must persist a notification state before delivery.");
assert.equal(deliveredDealerNotifications.length, 1, "A saved Dealer Offer must dispatch one admin notification after persistence.");
assert.equal(deliveredDealerNotifications[0]?.kind, "dealer", "A saved Dealer Offer must dispatch the Dealer notification channel.");
assert.equal(deliveredDealerNotifications[0]?.offerId, firstResult.offerId, "The Dealer notification must reference the saved offer.");

const retryResult = await dealerOffers.submitDealerOffer({ input: validInput, request, turnstileToken: "" });
assert.equal(retryResult.offerId, firstResult.offerId, "An idempotency retry must return the original Dealer Offer.");
assert.equal(retryResult.duplicate, true, "An idempotency retry must be marked as a duplicate.");
assert.equal(storedOffers.size, 1, "An idempotency retry must not create a duplicate record.");
const duplicateContentResult = await dealerOffers.submitDealerOffer({
  input: { ...validInput, idempotencyKey: "22345678-1234-4123-8123-123456789012" }, request, turnstileToken: ""
});
assert.equal(duplicateContentResult.duplicate, true, "A repeated rapid submission with another request key must be deduplicated.");
assert.equal(storedOffers.size, 1, "Content de-duplication must not create another Dealer Offer.");
await assert.rejects(
  () => dealerOffers.submitDealerOffer({ input: validInput, request, turnstileToken: "", honeypot: "filled-by-bot" }),
  (error) => error?.code === "INVALID_INPUT",
  "A filled honeypot must be rejected by the server."
);

resolvedVehicle = { ...activeVehicle, sellerStatus: "SOLD" };
await assert.rejects(
  () => dealerOffers.submitDealerOffer({ input: { ...validInput, idempotencyKey: "32345678-1234-4123-8123-123456789012" }, request, turnstileToken: "" }),
  (error) => error?.code === "LISTING_UNAVAILABLE" && error?.status === 404,
  "Unavailable listings must be rejected by the server before a write."
);
resolvedVehicle = activeVehicle;

const publicRoute = read("app/api/public/dealer-offers/route.ts");
const adminRoute = read("app/api/admin/dealer-offers/route.ts");
const unifiedAdminRoute = read("app/api/admin/offers/route.ts");
const adminUpdateRoute = read("app/api/admin/dealer-offers/[id]/route.ts");
const inventoryCard = read("components/vehicles/vehicle-card.tsx");
const inventoryBrowser = read("components/vehicles/inventory-browser.tsx");
const takeAction = read("components/vehicles/take-action-panel.tsx");
const privateSubmitRoute = read("app/api/public/vehicle-actions/submit/route.ts");
const firestoreRules = read("firestore.rules");
const storageRules = read("storage.rules");

assert.match(publicRoute, /submitDealerOffer/, "Public requests must use the dedicated Dealer Offer handler.");
assert.doesNotMatch(publicRoute, /ownerUid|customerId|listingOwnerUid/, "The public Dealer Offer route must not accept privileged owner/customer fields.");
assert.match(adminRoute, /requireVerifiedAdminApiAccess\(request, "manageOffers"\)/, "Admin Dealer Offer reads must require the existing manageOffers permission.");
assert.match(unifiedAdminRoute, /requireVerifiedAdminApiAccess\(request, "manageOffers"\)/, "Unified Admin Offers reads must require the existing manageOffers permission.");
assert.match(unifiedAdminRoute, /collection\("offers"\)\.get\(\)/, "Unified Admin Offers reads must use the Admin SDK for Private Offers.");
assert.match(unifiedAdminRoute, /getDealerOffersForAdmin/, "Unified Admin Offers reads must include Dealer Offers.");
assert.match(adminUpdateRoute, /requireVerifiedAdminApiAccess\(request, "manageOffers"\)/, "Admin Dealer Offer updates must require the existing manageOffers permission.");
assert.match(inventoryBrowser, /showOfferActions/, "Inventory is the only VehicleCard consumer enabling secondary offer actions.");
assert.match(inventoryCard, /router\.push\(vehicleHref\)/, "Card background navigation remains routed to the original Vehicle Detail page.");
assert.match(inventoryCard, /\?action=offer#take-action-panel/, "Private Offer action must reuse the existing Vehicle Detail offer flow.");
assert.match(inventoryCard, /event\.stopPropagation\(\)/, "Offer controls must not trigger vehicle-card navigation.");
assert.match(inventoryCard, /absolute inset-0/, "Vehicle actions must be an in-photo overlay rather than card content below the image.");
assert.match(inventoryCard, /flex w-44 flex-col gap-3/, "Vehicle actions must be a single vertical column with 12px spacing.");
assert.match(inventoryCard, /View listing[\s\S]*Private offer[\s\S]*Dealer offer/, "Overlay actions must retain View listing, Private offer, Dealer offer order.");
assert.match(inventoryCard, /bg-white\/\[0\.18\]/, "Overlay actions must retain frosted-glass styling.");
assert.match(inventoryCard, /min-h-11/, "Touch overlay actions must meet the 44px minimum target height.");
assert.match(inventoryCard, /pointerdown/, "Touch interaction must close the overlay when tapping outside the vehicle photo.");
assert.match(takeAction, /DealerOfferModal/, "Vehicle Detail must reuse the shared Dealer Offer modal.");
assert.match(privateSubmitRoute, /submitPublicOffer/, "The existing Private Offer submission route remains unchanged.");
assert.match(privateSubmitRoute, /submitPublicInspectionRequest/, "The existing Book Inspection route remains unchanged.");
assert.doesNotMatch(firestoreRules, /dealerOffers/, "Dealer Offers remain server-only and do not broaden Firestore rules.");
assert.doesNotMatch(storageRules, /dealerOffers/, "Dealer Offers do not change Storage rules.");

console.log("Dealer Offer validation and isolation checks passed.");
