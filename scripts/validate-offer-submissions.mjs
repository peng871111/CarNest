#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const projectRoot = process.cwd();
const nodeRequire = createRequire(import.meta.url);
const read = (pathname) => readFileSync(join(projectRoot, pathname), "utf8");

function loadModule(pathname, resolve, env = {}) {
  const output = ts.transpileModule(read(pathname), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    Array,
    Buffer,
    Date,
    Error,
    Math,
    Number,
    Object,
    Promise,
    String,
    URLSearchParams,
    console,
    process: { env },
    require: resolve
  }, { filename: pathname });
  return module.exports;
}

class MockTimestamp {
  constructor(milliseconds) {
    this.milliseconds = milliseconds;
  }

  static now() { return new MockTimestamp(Date.now()); }
  static fromDate(value) { return new MockTimestamp(value.getTime()); }
  static fromMillis(value) { return new MockTimestamp(value); }
  toDate() { return new Date(this.milliseconds); }
  toMillis() { return this.milliseconds; }
}

function createFirestoreMock() {
  const collections = new Map();
  let autoId = 0;
  let failNextCreate = false;
  const docs = (collection) => {
    if (!collections.has(collection)) collections.set(collection, new Map());
    return collections.get(collection);
  };
  const apply = (current, input, merge) => {
    const next = merge ? { ...current } : {};
    for (const [key, value] of Object.entries(input)) {
      next[key] = value?.kind === "increment" ? Number(current[key] ?? 0) + value.amount : value;
    }
    return next;
  };

  class Ref {
    constructor(collection, id) {
      this.collection = collection;
      this.id = id;
    }

    async get() {
      const data = docs(this.collection).get(this.id);
      return { id: this.id, exists: data !== undefined, data: () => data };
    }

    async set(input, options) {
      const current = docs(this.collection).get(this.id) ?? {};
      docs(this.collection).set(this.id, apply(current, input, options?.merge));
    }

    async create(input) {
      if (failNextCreate) {
        failNextCreate = false;
        throw new Error("simulated Firestore write failure");
      }
      if (docs(this.collection).has(this.id)) {
        const error = new Error("already exists");
        error.code = 6;
        throw error;
      }
      docs(this.collection).set(this.id, { ...input });
    }
  }

  class Collection {
    constructor(name) {
      this.name = name;
    }

    doc(id) { return new Ref(this.name, id || `auto-${++autoId}`); }
    where() { return this; }
    orderBy() { return this; }
    limit() { return this; }
    async get() {
      const entries = [...docs(this.name).entries()];
      const snapshots = entries.map(([id, data]) => ({ id, exists: true, data: () => data }));
      return {
        docs: snapshots,
        forEach: (callback) => snapshots.forEach(callback)
      };
    }
    async add(input) {
      const ref = this.doc();
      await ref.create(input);
      return ref;
    }
  }

  const db = {
    collection(name) { return new Collection(name); },
    async runTransaction(callback) {
      return callback({
        get: (ref) => ref.get(),
        set: (ref, input, options) => {
          const current = docs(ref.collection).get(ref.id) ?? {};
          docs(ref.collection).set(ref.id, apply(current, input, options?.merge));
        },
        update: (ref, input) => {
          const current = docs(ref.collection).get(ref.id);
          if (!current) throw new Error("missing document");
          docs(ref.collection).set(ref.id, apply(current, input, true));
        }
      });
    }
  };

  return {
    db,
    collections,
    failNextCreate: () => { failNextCreate = true; }
  };
}

const validation = loadModule("lib/public-vehicle-action-validation.ts", (moduleName) => {
  if (moduleName === "@/types") return {};
  throw new Error(`Unexpected validation import: ${moduleName}`);
});

const privateStore = createFirestoreMock();
const privateNotifications = [];
const listedVehicle = {
  id: "vehicle-offer-1",
  ownerUid: "",
  year: 2024,
  make: "Lexus",
  model: "RX",
  variant: "Luxury",
  price: 100000,
  status: "approved",
  sellerStatus: "ACTIVE",
  deleted: false,
  listingType: "warehouse",
  displayReference: "CN-OFFER-001"
};
const privateActions = loadModule("lib/public-vehicle-actions.ts", (moduleName) => {
  if (moduleName === "server-only") return {};
  if (moduleName === "node:crypto") return nodeRequire("node:crypto");
  if (moduleName === "firebase-admin/firestore") return { Timestamp: MockTimestamp };
  if (moduleName === "@/lib/firebase-admin-server") {
    return {
      getAdminDb: () => privateStore.db,
      getAdminAuth: () => ({
        verifyIdToken: async (token) => token === "registered-token"
          ? { uid: "registered-buyer", email: "registered@example.test", email_verified: true }
          : Promise.reject(new Error("invalid token"))
      })
    };
  }
  if (moduleName === "@/lib/offer-admin-notifications") {
    return {
      deliverAdminOfferNotification: async (input) => {
        privateNotifications.push({ kind: input.kind, offerId: input.offerId });
        return { attempted: true, sent: true, providerMessageId: "mock-private-message" };
      }
    };
  }
  if (moduleName === "@/lib/vehicle-admin-server") return { getAdminVehicleById: async () => listedVehicle };
  if (moduleName === "@/lib/public-vehicle-action-email") {
    return {
      sendAdminInspectionNotificationEmail: async () => ({ providerMessageId: "inspection" }),
      sendSellerOfferNotificationEmail: async () => ({ providerMessageId: "seller" }),
      sendVehicleActionVerificationCodeEmail: async () => ({ providerMessageId: "verification" }),
      VehicleActionEmailProviderError: class VehicleActionEmailProviderError extends Error {}
    };
  }
  if (moduleName === "@/lib/public-vehicle-action-validation") return validation;
  if (moduleName === "@/lib/utils") {
    return {
      formatCurrency: (value) => `$${value}`,
      getVehicleDisplayReference: (vehicle) => vehicle.displayReference || vehicle.id
    };
  }
  if (moduleName === "@/types") return {};
  throw new Error(`Unexpected private action import: ${moduleName}`);
}, { PUBLIC_ACTION_SECRET: "offer-test-secret" });

const request = { headers: { get: (name) => name === "x-forwarded-for" ? "203.0.113.10" : "" } };
const registeredOfferInput = {
  vehicleId: listedVehicle.id,
  buyerName: "Registered Buyer",
  buyerEmail: "registered@example.test",
  buyerPhone: "+61 412 345 678",
  offerAmount: 85000,
  message: "Ready to proceed.",
  turnstileToken: "",
  idempotencyKey: "private-offer-idempotency-0001",
  request,
  authToken: "registered-token"
};

const firstPrivateResult = await privateActions.submitPublicOffer(registeredOfferInput);
assert.equal(firstPrivateResult.duplicate, false, "A verified registered Private Offer must save successfully.");
const privateOfferDocs = privateStore.collections.get("offers");
assert.equal(privateOfferDocs.size, 1, "One Private Offer submission must create one document.");
const firstPrivateDoc = privateOfferDocs.get(firstPrivateResult.offerId);
assert.equal(firstPrivateDoc.source, "authenticated", "Registered buyer source must be retained.");
assert.equal(firstPrivateDoc.adminNotificationStatus, "pending", "Persistence must complete before notification delivery is attempted.");
assert.equal(privateNotifications.length, 1, "A saved Private Offer must dispatch one notification attempt.");

const retryPrivateResult = await privateActions.submitPublicOffer(registeredOfferInput);
assert.equal(retryPrivateResult.offerId, firstPrivateResult.offerId, "A repeat Private Offer request must return the stable offer id.");
assert.equal(retryPrivateResult.duplicate, true, "A repeat Private Offer request must be marked as a duplicate.");
assert.equal(privateOfferDocs.size, 1, "A repeat Private Offer request must not create another document.");

await assert.rejects(
  () => privateActions.submitPublicOffer({
    ...registeredOfferInput,
    buyerEmail: "low@example.test",
    offerAmount: 79999,
    idempotencyKey: "private-offer-idempotency-low"
  }),
  (error) => error?.code === "OFFER_BELOW_MINIMUM",
  "The existing 80% Private Offer minimum must remain enforced."
);

privateStore.failNextCreate();
await assert.rejects(
  () => privateActions.submitPublicOffer({
    ...registeredOfferInput,
    message: "A distinct offer that exercises the write failure path.",
    idempotencyKey: "private-offer-idempotency-failure"
  }),
  /simulated Firestore write failure/,
  "A Firestore failure must reject rather than return a false success."
);
assert.equal(privateOfferDocs.size, 1, "A failed Firestore write must not create a Private Offer document.");

const guestSessionId = "guest-offer-session";
const guestVerificationToken = "guest-verification-token";
const guestEmail = "guest@example.test";
await privateStore.db.collection("publicEmailVerificationSessions").doc(guestSessionId).set({
  actionType: "offer",
  vehicleId: listedVehicle.id,
  email: guestEmail,
  codeHash: "unused",
  verificationTokenHash: createHmac("sha256", "offer-test-secret")
    .update(`public-email-verification-token:${guestSessionId}:${guestVerificationToken}`)
    .digest("hex"),
  attemptCount: 1,
  ipHash: "",
  deliveryStatus: "sent",
  verifiedAt: MockTimestamp.now(),
  codeUsedAt: MockTimestamp.now(),
  expiresAt: MockTimestamp.fromMillis(Date.now() + 10 * 60 * 1000)
});
const guestPrivateResult = await privateActions.submitPublicOffer({
  ...registeredOfferInput,
  buyerName: "Guest Buyer",
  buyerEmail: guestEmail,
  idempotencyKey: "private-offer-idempotency-guest",
  authToken: undefined,
  verificationSessionId: guestSessionId,
  verificationToken: guestVerificationToken
});
assert.equal(guestPrivateResult.duplicate, false, "An OTP-verified Guest Private Offer must save successfully.");
assert.equal(privateOfferDocs.size, 2, "A distinct verified Guest Private Offer must create one document.");
assert.equal(privateOfferDocs.get(guestPrivateResult.offerId).source, "guest", "Guest source must be retained for Admin Offers.");

const notificationStore = createFirestoreMock();
const sentEmailRequests = [];
let failNextPrivateEmail = false;
const notifications = loadModule("lib/offer-admin-notifications.ts", (moduleName) => {
  if (moduleName === "server-only") return {};
  if (moduleName === "firebase-admin/firestore") {
    return {
      Timestamp: MockTimestamp,
      FieldValue: { increment: (amount) => ({ kind: "increment", amount }) }
    };
  }
  if (moduleName === "@/lib/firebase-admin-server") return { getAdminDb: () => notificationStore.db };
  if (moduleName === "@/lib/public-vehicle-action-email") {
    return {
      sendAdminPrivateOfferNotificationEmail: async (input) => {
        sentEmailRequests.push({ kind: "private", input });
        if (failNextPrivateEmail) {
          failNextPrivateEmail = false;
          throw new Error("mock Resend failure");
        }
        return { providerMessageId: `mock-private-${sentEmailRequests.length}` };
      },
      sendAdminDealerOfferNotificationEmail: async (input) => {
        sentEmailRequests.push({ kind: "dealer", input });
        return { providerMessageId: `mock-dealer-${sentEmailRequests.length}` };
      }
    };
  }
  throw new Error(`Unexpected notification import: ${moduleName}`);
});

await notificationStore.db.collection("offers").doc("private-notification").set({
  vehicleTitle: "2024 Lexus RX",
  vehicleReference: "CN-OFFER-001",
  askingPriceAtSubmission: 100000,
  buyerName: "Guest Buyer",
  buyerEmail: guestEmail,
  buyerPhone: "+61 412 345 678",
  offerAmount: 85000,
  offerPercentage: 85,
  source: "guest",
  verificationMethod: "email_otp",
  status: "pending",
  createdAt: MockTimestamp.now(),
  adminNotificationStatus: "pending",
  adminNotificationAttemptCount: 0
});
await notificationStore.db.collection("dealerOffers").doc("dealer-notification").set({
  vehicleTitle: "2024 Lexus RX",
  vehicleReference: "CN-OFFER-001",
  askingPriceAtSubmission: 100000,
  dealershipName: "Example Motors",
  contactName: "Alex Dealer",
  contactEmail: "alex@examplemotors.test",
  contactPhone: "+61 412 345 678",
  offerAmount: 87000,
  preferredInspectionDate: "2026-12-01",
  comments: "Subject to inspection.",
  status: "new",
  createdAt: MockTimestamp.now(),
  adminNotificationStatus: "pending",
  adminNotificationAttemptCount: 0
});

const privateDelivery = await notifications.deliverAdminOfferNotification({ kind: "private", offerId: "private-notification" });
assert.equal(privateDelivery.sent, true, "A saved Private Offer notification must be delivered after persistence.");
assert.equal(sentEmailRequests.length, 1, "A new Private Offer must send one email request.");
assert.equal(sentEmailRequests[0].input.buyerAccess, "guest", "The Private email must retain Guest classification.");
const deliveredPrivate = notificationStore.collections.get("offers").get("private-notification");
assert.equal(deliveredPrivate.adminNotificationStatus, "sent", "A successful Private notification must record sent state.");
assert.equal(deliveredPrivate.adminNotificationAttemptCount, 1, "A successful Private notification must record one attempt.");

const duplicateDelivery = await notifications.deliverAdminOfferNotification({ kind: "private", offerId: "private-notification" });
assert.equal(duplicateDelivery.skipped, "already_sent", "Notification retries must not send a duplicate email after success.");
assert.equal(sentEmailRequests.length, 1, "An already sent Private notification must not issue another email request.");

const dealerDelivery = await notifications.deliverAdminOfferNotification({ kind: "dealer", offerId: "dealer-notification" });
assert.equal(dealerDelivery.sent, true, "A saved Dealer Offer notification must be delivered after persistence.");
assert.equal(sentEmailRequests.length, 2, "A new Dealer Offer must send one email request.");
assert.equal(sentEmailRequests[1].input.dealershipName, "Example Motors", "The Dealer email must include dealership details.");
assert.equal(notificationStore.collections.get("dealerOffers").get("dealer-notification").adminNotificationStatus, "sent", "A successful Dealer notification must record sent state.");

await notificationStore.db.collection("offers").doc("retry-notification").set({
  vehicleTitle: "2024 Lexus RX",
  vehicleReference: "CN-OFFER-001",
  askingPriceAtSubmission: 100000,
  buyerName: "Retry Buyer",
  buyerEmail: "retry@example.test",
  buyerPhone: "+61 412 345 678",
  offerAmount: 85000,
  source: "authenticated",
  verificationMethod: "account_email",
  status: "pending",
  createdAt: MockTimestamp.now(),
  adminNotificationStatus: "pending",
  adminNotificationAttemptCount: 0
});
failNextPrivateEmail = true;
const failedDelivery = await notifications.deliverAdminOfferNotification({ kind: "private", offerId: "retry-notification" });
assert.equal(failedDelivery.sent, false, "A Resend failure must not be reported as notification success.");
const retryDoc = notificationStore.collections.get("offers").get("retry-notification");
assert.equal(retryDoc.adminNotificationStatus, "failed", "A Resend failure must preserve the saved offer and mark only notification delivery as failed.");
const retriedDelivery = await notifications.deliverAdminOfferNotification({ kind: "private", offerId: "retry-notification" });
assert.equal(retriedDelivery.sent, true, "A failed notification must retry without creating another offer.");
assert.equal(notificationStore.collections.get("offers").size, 2, "Notification retry must not create another Private Offer record.");
assert.equal(notificationStore.collections.get("offers").get("retry-notification").adminNotificationAttemptCount, 2, "A retry must increment notification attempts without duplicating the offer.");

const adminStore = createFirestoreMock();
await adminStore.db.collection("offers").doc("older-private").set({ createdAt: "2026-11-01T00:00:00.000Z", vehicleTitle: "Older" });
await adminStore.db.collection("offers").doc("newer-private").set({ createdAt: "2026-11-02T00:00:00.000Z", vehicleTitle: "Newer" });
let allowAdminRead = true;
class AdminApiAuthError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
const adminOffersRoute = loadModule("app/api/admin/offers/route.ts", (moduleName) => {
  if (moduleName === "next/server") return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } };
  if (moduleName === "@/lib/admin-api-auth") {
    return {
      AdminApiAuthError,
      requireVerifiedAdminApiAccess: async () => {
        if (!allowAdminRead) throw new AdminApiAuthError("Forbidden", 403);
      }
    };
  }
  if (moduleName === "@/lib/admin-offers") return { serializeAdminOfferDoc: (id, data) => ({ id, ...data }) };
  if (moduleName === "@/lib/dealer-offers") return { getDealerOffersForAdmin: async () => [{ id: "dealer-admin", createdAt: "2026-11-03T00:00:00.000Z" }] };
  if (moduleName === "@/lib/firebase-admin-server") return { getAdminDb: () => adminStore.db };
  throw new Error(`Unexpected Admin Offers route import: ${moduleName}`);
});

const adminResponse = await adminOffersRoute.GET({});
assert.equal(adminResponse.status, 200, "An authorised Admin Offers request must load successfully.");
assert.equal(adminResponse.body.offers[0].id, "newer-private", "Private Offers must sort newest first before the Admin UI renders them.");
assert.equal(adminResponse.body.dealerOffers[0].id, "dealer-admin", "Unified Admin Offers reads must include Dealer Offers.");
allowAdminRead = false;
const forbiddenResponse = await adminOffersRoute.GET({});
assert.equal(forbiddenResponse.status, 403, "Unauthorised callers must not read Private or Dealer Offers.");

const adminPage = read("app/admin/offers/page.tsx");
const emailSource = read("lib/public-vehicle-action-email.ts");
assert.match(adminPage, /fetch\("\/api\/admin\/offers"/, "Admin Offers must use the protected unified server read path.");
assert.match(adminPage, /!isLoading && !error && !offerRows\.length/, "A failed Admin request must not be rendered as an empty offers list.");
assert.match(emailSource, /to: ADMIN_NOTIFICATION_RECIPIENT/, "Offer notification mail must use the fixed CarNest recipient.");
assert.match(emailSource, /New Private Offer —/, "Private Offer notification subjects must identify the offer type.");
assert.match(emailSource, /New Dealer Offer —/, "Dealer Offer notification subjects must identify the offer type.");

const renderedEmailRequests = [];
class MockResend {
  constructor() {
    this.emails = {
      send: async (input) => {
        renderedEmailRequests.push(input);
        return { data: { id: `mock-resend-${renderedEmailRequests.length}` }, error: null };
      }
    };
  }
}
const offerEmail = loadModule("lib/public-vehicle-action-email.ts", (moduleName) => {
  if (moduleName === "server-only") return {};
  if (moduleName === "resend") return { Resend: MockResend };
  if (moduleName === "@/lib/utils") return { formatCurrency: (value) => `AUD ${value}`, getVehicleDisplayReference: (vehicle) => vehicle.id };
  if (moduleName === "@/lib/public-vehicle-action-validation") return { EMAIL_OTP_EXPIRY_MINUTES: 10 };
  if (moduleName === "@/lib/seo") return { buildAbsoluteUrl: (pathname) => `https://www.carnest.au${pathname}` };
  if (moduleName === "@/types") return {};
  throw new Error(`Unexpected offer email import: ${moduleName}`);
}, { RESEND_API_KEY: "mock-key", EMAIL_FROM: "CarNest <offers@example.test>" });
await offerEmail.sendAdminPrivateOfferNotificationEmail({
  vehicleTitle: "2024 Lexus RX",
  vehicleReference: "CN-OFFER-001",
  askingPrice: 100000,
  buyerName: "Guest Buyer",
  buyerEmail: guestEmail,
  buyerPhone: "+61 412 345 678",
  offerAmount: 85000,
  offerPercentage: 85,
  buyerAccess: "guest",
  verificationMethodLabel: "Verified by email OTP",
  submittedAt: new Date("2026-11-12T00:00:00.000Z"),
  status: "pending"
});
await offerEmail.sendAdminDealerOfferNotificationEmail({
  vehicleTitle: "2024 Lexus RX",
  vehicleReference: "CN-OFFER-001",
  askingPrice: 100000,
  dealershipName: "Example Motors",
  contactName: "Alex Dealer",
  contactEmail: "alex@examplemotors.test",
  contactPhone: "+61 412 345 678",
  offerAmount: 87000,
  preferredInspectionDate: "2026-12-01",
  comments: "Subject to inspection.",
  submittedAt: new Date("2026-11-12T00:00:00.000Z"),
  status: "new"
});
assert.equal(renderedEmailRequests.length, 2, "Private and Dealer notification templates must each submit one Resend request.");
assert.equal(renderedEmailRequests[0].to, "info@carnest.au", "Private Offer notifications must target info@carnest.au.");
assert.match(renderedEmailRequests[0].subject, /New Private Offer/, "Private Offer email must identify its type in the subject.");
assert.equal(renderedEmailRequests[1].to, "info@carnest.au", "Dealer Offer notifications must target info@carnest.au.");
assert.match(renderedEmailRequests[1].subject, /New Dealer Offer/, "Dealer Offer email must identify its type in the subject.");
assert.match(renderedEmailRequests[1].html, /Example Motors/, "Dealer Offer email must include dealership details.");

console.log("Offer submission persistence, notification retry, and Admin visibility checks passed.");
