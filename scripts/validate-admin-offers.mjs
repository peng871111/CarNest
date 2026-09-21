import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const repoRoot = process.cwd();
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadTypescriptModule(filePath, customRequire) {
  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const module = { exports: {} };
  vm.runInNewContext(output, {
    console,
    module,
    exports: module.exports,
    require(specifier) {
      if (customRequire) return customRequire(specifier);
      throw new Error(`Unexpected runtime import while testing ${filePath}: ${specifier}`);
    }
  }, { filename: filePath });
  return module.exports;
}

const helperPath = path.join(repoRoot, "lib/admin-offers.ts");
const routePath = path.join(repoRoot, "app/api/admin/offers/[id]/route.ts");
const actionsPath = path.join(repoRoot, "components/offers/offer-status-actions.tsx");
const adminPagePath = path.join(repoRoot, "app/admin/offers/page.tsx");
const buyerPagePath = path.join(repoRoot, "components/offers/buyer-offers-page.tsx");
const offerEmailPath = path.join(repoRoot, "lib/offer-email.ts");

const {
  ADMIN_OFFER_STATUSES,
  buildAdminOfferEmailStatusFromSendResult,
  buildAdminOfferUpdatePlan,
  getAdminOfferEmailFailureReason,
  getAdminOfferEmailQueryValue,
  getAdminOfferSaveMessage,
  getAdminOfferSaveMessageFromQuery,
  resolveAdminOfferBuyerEmailRecipient,
  sanitizeAdminOfferUpdateInput,
  serializeAdminOfferDoc
} = loadTypescriptModule(helperPath);

function loadOfferEmailModule(publicEmailMock) {
  return loadTypescriptModule(offerEmailPath, (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "@/lib/seo") {
      return {
        buildAbsoluteUrl(pathname) {
          return `https://www.carnest.au${pathname}`;
        }
      };
    }
    if (specifier === "@/lib/public-vehicle-action-email") {
      return publicEmailMock;
    }
    throw new Error(`Unexpected offer-email test import: ${specifier}`);
  });
}

assert.equal(JSON.stringify(ADMIN_OFFER_STATUSES), JSON.stringify([
  "pending",
  "countered",
  "accepted",
  "declined",
  "accepted_pending_buyer_confirmation",
  "buyer_confirmed",
  "buyer_declined",
  "rejected"
]));

assert.equal(
  JSON.stringify(sanitizeAdminOfferUpdateInput({ status: "pending", counterAmount: "45000.40" })),
  JSON.stringify({ status: "pending", counterAmount: 45000 })
);
assert.throws(() => sanitizeAdminOfferUpdateInput({ status: "broken" }), /valid offer status/);
assert.throws(() => sanitizeAdminOfferUpdateInput({ status: "pending", counterAmount: 0 }), /greater than zero/);

const toDate = (value) => ({ toDate: () => new Date(value) });
const guestOffer = serializeAdminOfferDoc("offer-guest-123", {
  userId: "guest-shadow-user",
  submittedByUid: "guest-shadow-user",
  sellerOwnerUid: "seller-1",
  vehicleId: "vehicle-1",
  vehicleTitle: "1998 Nissan Skyline",
  vehiclePrice: 90000,
  buyerName: "Guest Buyer",
  buyerEmail: "guest@example.com",
  buyerPhone: "0400000000",
  amount: 42000,
  offerAmount: 42000,
  message: "Keen.",
  status: "pending",
  source: "guest",
  createdAt: toDate("2026-09-18T02:00:00.000Z")
});

assert.equal(guestOffer.buyerUid, "guest-shadow-user");
assert.equal(guestOffer.listingOwnerUid, "seller-1");
assert.equal(guestOffer.source, "guest");
assert.equal(guestOffer.messages[0].type, "offer_update");
assert.equal(guestOffer.messages[0].amount, 42000);

const registeredOffer = serializeAdminOfferDoc("offer-auth-123", {
  buyerUid: "buyer-1",
  listingOwnerUid: "seller-1",
  vehicleId: "vehicle-1",
  vehicleTitle: "1998 Nissan Skyline",
  vehiclePrice: 90000,
  buyerName: "Registered Buyer",
  buyerEmail: "buyer@example.com",
  buyerPhone: "0411111111",
  amount: 50000,
  offerAmount: 50000,
  message: "Ready now.",
  status: "pending",
  source: "authenticated"
});

let guestLookupCount = 0;
assert.deepEqual(
  plain(await resolveAdminOfferBuyerEmailRecipient(guestOffer, async () => {
    guestLookupCount += 1;
    return "profile@example.com";
  })),
  { email: "guest@example.com", buyerAccess: "guest" }
);
assert.equal(guestLookupCount, 0);

assert.deepEqual(
  plain(await resolveAdminOfferBuyerEmailRecipient(
    { ...registeredOffer, buyerEmail: "fallback@example.com" },
    async () => "Preferred.Profile@Example.com "
  )),
  { email: "preferred.profile@example.com", buyerAccess: "registered" }
);

assert.deepEqual(
  plain(await resolveAdminOfferBuyerEmailRecipient(
    { ...registeredOffer, buyerEmail: "Fallback@Example.com " },
    async () => ""
  )),
  { email: "fallback@example.com", buyerAccess: "registered" }
);

assert.deepEqual(
  plain(await resolveAdminOfferBuyerEmailRecipient(
    { ...registeredOffer, buyerEmail: "" },
    async () => ""
  )),
  { email: "", buyerAccess: "registered" }
);

const counterPlan = buildAdminOfferUpdatePlan(
  { status: "pending", counterAmount: 65000 },
  registeredOffer,
  "2026-09-19T01:02:03.000Z"
);
assert.equal(counterPlan.status, "countered");
assert.equal(counterPlan.amount, 65000);
assert.equal(counterPlan.offerAmount, 65000);
assert.equal(counterPlan.appendMessage?.type, "offer_update");
assert.equal(counterPlan.appendMessage?.sender, "seller");
assert.equal(counterPlan.appendMessage?.amount, 65000);
assert.equal(counterPlan.buyerViewed, false);
assert.equal(counterPlan.sellerViewed, true);
assert.equal(counterPlan.lastUpdatedBy, "seller");
assert.equal(counterPlan.emailEvent, "seller_countered_offer");
assert.equal(counterPlan.shouldTouchRespondedAt, true);

const changedAlreadyCounteredPlan = buildAdminOfferUpdatePlan(
  { status: "countered", counterAmount: 67000 },
  { ...registeredOffer, status: "countered", amount: 65000, offerAmount: 65000 },
  "2026-09-19T01:02:03.000Z"
);
assert.equal(changedAlreadyCounteredPlan.status, "countered");
assert.equal(changedAlreadyCounteredPlan.amount, 67000);
assert.equal(changedAlreadyCounteredPlan.offerAmount, 67000);
assert.equal(changedAlreadyCounteredPlan.appendMessage?.amount, 67000);
assert.equal(changedAlreadyCounteredPlan.emailEvent, "seller_countered_offer");
assert.equal(changedAlreadyCounteredPlan.counterOfferUnchanged, false);

const identicalAlreadyCounteredPlan = buildAdminOfferUpdatePlan(
  { status: "countered", counterAmount: 65000 },
  { ...registeredOffer, status: "countered", amount: 65000, offerAmount: 65000 },
  "2026-09-19T01:02:03.000Z"
);
assert.equal(identicalAlreadyCounteredPlan.status, "countered");
assert.equal(identicalAlreadyCounteredPlan.amount, undefined);
assert.equal(identicalAlreadyCounteredPlan.offerAmount, undefined);
assert.equal(identicalAlreadyCounteredPlan.appendMessage, undefined);
assert.equal(identicalAlreadyCounteredPlan.emailEvent, undefined);
assert.equal(identicalAlreadyCounteredPlan.counterOfferUnchanged, true);
assert.equal(identicalAlreadyCounteredPlan.shouldTouchRespondedAt, false);

const declinedToCounteredPlan = buildAdminOfferUpdatePlan(
  { status: "countered", counterAmount: 65000 },
  { ...registeredOffer, status: "declined", amount: 65000, offerAmount: 65000 },
  "2026-09-19T01:02:03.000Z"
);
assert.equal(declinedToCounteredPlan.status, "countered");
assert.equal(declinedToCounteredPlan.emailEvent, "seller_countered_offer");
assert.equal(declinedToCounteredPlan.appendMessage?.amount, 65000);

const statusOnlyCounterPlan = buildAdminOfferUpdatePlan(
  { status: "countered" },
  registeredOffer,
  "2026-09-19T01:02:03.000Z"
);
assert.equal(statusOnlyCounterPlan.emailEvent, "seller_countered_offer");
assert.equal(statusOnlyCounterPlan.amount, undefined);
const alreadyCounteredPlan = buildAdminOfferUpdatePlan(
  { status: "countered" },
  { ...registeredOffer, status: "countered" },
  "2026-09-19T01:02:03.000Z"
);
assert.equal(alreadyCounteredPlan.emailEvent, undefined);
assert.throws(
  () => buildAdminOfferUpdatePlan({ status: "pending", counterAmount: 20000 }, registeredOffer),
  /realistic offer amount/
);

const acceptedPlan = buildAdminOfferUpdatePlan(
  { status: "accepted" },
  registeredOffer,
  "2026-09-19T01:02:03.000Z"
);
assert.equal(acceptedPlan.status, "accepted");
assert.equal(acceptedPlan.contactUnlocked, true);
assert.equal(acceptedPlan.contactUnlockedBy, "seller_accept");
assert.equal(acceptedPlan.contactVisibilityState, "shared_after_accept");
assert.equal(acceptedPlan.emailEvent, "seller_accepted_offer");

assert.deepEqual(
  plain(buildAdminOfferEmailStatusFromSendResult("buyer@example.com", { sent: true })),
  { attempted: true, sent: true, recipientEmail: "buyer@example.com" }
);
assert.deepEqual(
  plain(buildAdminOfferEmailStatusFromSendResult("buyer@example.com", { sent: false, reason: "missing_env" })),
  {
    attempted: true,
    sent: false,
    recipientEmail: "buyer@example.com",
    reason: "missing_env"
  }
);
assert.deepEqual(
  plain(buildAdminOfferEmailStatusFromSendResult("buyer@example.com", { sent: false, reason: "resend_error" })),
  {
    attempted: true,
    sent: false,
    recipientEmail: "buyer@example.com",
    reason: "resend_error"
  }
);
assert.equal(getAdminOfferEmailFailureReason("unexpected"), "email_not_sent");
assert.equal(getAdminOfferEmailFailureReason("provider_error"), "resend_error");
assert.equal(
  getAdminOfferSaveMessage(true, { attempted: true, sent: true, recipientEmail: "buyer@example.com" }),
  "Counteroffer saved and emailed to buyer."
);
assert.equal(
  getAdminOfferSaveMessage(
    true,
    { attempted: true, sent: false, recipientEmail: "buyer@example.com", reason: "resend_error" }
  ),
  "Counteroffer saved, but buyer email could not be sent."
);
assert.equal(
  getAdminOfferSaveMessage(true, { attempted: false, sent: false }),
  "Counteroffer unchanged."
);
assert.equal(
  getAdminOfferSaveMessage(false, { attempted: true, sent: true, recipientEmail: "buyer@example.com" }),
  "Offer saved."
);
assert.equal(
  getAdminOfferEmailQueryValue(true, { attempted: true, sent: true, recipientEmail: "buyer@example.com" }),
  "sent"
);
assert.equal(
  getAdminOfferEmailQueryValue(
    true,
    { attempted: true, sent: false, recipientEmail: "buyer@example.com", reason: "resend_error" }
  ),
  "failed"
);
assert.equal(getAdminOfferEmailQueryValue(true, { attempted: false, sent: false }), "unchanged");
assert.equal(
  getAdminOfferSaveMessageFromQuery("countered", "sent"),
  "Counteroffer saved and emailed to buyer."
);
assert.equal(
  getAdminOfferSaveMessageFromQuery("countered", "failed"),
  "Counteroffer saved, but buyer email could not be sent."
);
assert.equal(getAdminOfferSaveMessageFromQuery("countered", "unchanged"), "Counteroffer unchanged.");

const successfulSends = [];
const successOfferEmail = loadOfferEmailModule({
  getVerificationEmailFrom: () => "CarNest <verification@mail.carnest.au>",
  getVehicleActionEmailMissingEnvVars: () => [],
  createResendClient: () => ({
    emails: {
      async send(payload) {
        successfulSends.push(payload);
        return { data: { id: "resend-message-1" }, error: null };
      }
    }
  })
});
const successfulEmailResult = await successOfferEmail.sendOfferEmail({
  event: "seller_countered_offer",
  to: "buyer@example.com",
  vehicleTitle: "1998 Nissan Skyline",
  amount: 65000,
  buyerOriginalAmount: 50000,
  counterAmount: 65000,
  offerId: "offer-auth-123",
  vehicleId: "vehicle-1",
  buyerAccess: "registered"
});
assert.equal(successfulEmailResult.sent, true);
assert.equal(successfulEmailResult.providerMessageId, "resend-message-1");
assert.equal(successfulSends[0].from, "CarNest <verification@mail.carnest.au>");
assert.equal(successfulSends[0].to, "buyer@example.com");

const failedOfferEmail = loadOfferEmailModule({
  getVerificationEmailFrom: () => "CarNest <verification@mail.carnest.au>",
  getVehicleActionEmailMissingEnvVars: () => [],
  createResendClient: () => ({
    emails: {
      async send() {
        return {
          data: null,
          error: { name: "validation_error", message: "Provider rejected request", statusCode: 400 }
        };
      }
    }
  })
});
assert.deepEqual(
  plain(await failedOfferEmail.sendOfferEmail({
    event: "seller_countered_offer",
    to: "buyer@example.com",
    vehicleTitle: "1998 Nissan Skyline",
    amount: 65000,
    offerId: "offer-auth-123"
  })),
  {
    sent: false,
    skipped: false,
    reason: "resend_error",
    providerErrorName: "validation_error",
    providerStatusCode: 400
  }
);

let createClientCalledForMissingConfig = false;
const missingConfigOfferEmail = loadOfferEmailModule({
  getVerificationEmailFrom: () => "CarNest <verification@mail.carnest.au>",
  getVehicleActionEmailMissingEnvVars: () => ["RESEND_API_KEY"],
  createResendClient: () => {
    createClientCalledForMissingConfig = true;
    throw new Error("Should not create Resend client when config is missing.");
  }
});
assert.deepEqual(
  plain(await missingConfigOfferEmail.sendOfferEmail({
    event: "seller_countered_offer",
    to: "buyer@example.com",
    vehicleTitle: "1998 Nissan Skyline",
    amount: 65000,
    offerId: "offer-auth-123"
  })),
  {
    sent: false,
    skipped: true,
    reason: "missing_env",
    missingEnvVars: ["RESEND_API_KEY"]
  }
);
assert.equal(createClientCalledForMissingConfig, false);

const routeSource = fs.readFileSync(routePath, "utf8");
assert.match(routeSource, /requireVerifiedAdminApiAccess\(request,\s*"manageOffers"\)/);
assert.match(routeSource, /const db = getAdminDb\(\)/);
assert.match(routeSource, /db\.collection\("offers"\)\.doc\(id\)/);
assert.match(routeSource, /db\.runTransaction/);
assert.match(routeSource, /transaction\.get\(ref\)/);
assert.match(routeSource, /transaction\.update\(ref,\s*patch\)/);
assert.match(routeSource, /sendOfferEmail/);
assert.match(routeSource, /resolveAdminOfferBuyerEmailRecipient/);
assert.match(routeSource, /buildAdminOfferEmailStatusFromSendResult/);
assert.match(routeSource, /reason:\s*"missing_buyer_email"/);
assert.match(routeSource, /reason:\s*"resend_error"/);
assert.match(routeSource, /result:\s*emailResultCategory/);
assert.match(routeSource, /buyerOriginalAmount:\s*transactionResult\.previousOffer\.amount/);
assert.match(routeSource, /counterAmount:\s*updatedOffer\.amount/);
assert.match(routeSource, /buyerAccess:\s*recipient\.buyerAccess/);
assert.match(routeSource, /emailStatus/);
assert.match(routeSource, /writeSucceeded:\s*true/);
assert.ok(
  routeSource.indexOf("requireVerifiedAdminApiAccess") < routeSource.indexOf("db.runTransaction"),
  "Admin Offers route must verify access before using Admin SDK"
);
assert.ok(
  routeSource.indexOf("transaction.update(ref, patch)") < routeSource.indexOf("const result = await sendOfferEmail"),
  "Counter offer email must be sent after the offer update transaction"
);

const actionsSource = fs.readFileSync(actionsPath, "utf8");
assert.match(actionsSource, /firebaseUser\.getIdToken\(true\)/);
assert.match(actionsSource, /fetch\(`\/api\/admin\/offers\/\$\{encodeURIComponent\(offer\.id\)\}`/);
assert.match(actionsSource, /authorization:\s*`Bearer \$\{idToken\}`/);
assert.match(actionsSource, /counterAmount/);
assert.match(actionsSource, /Counter price/);
assert.match(actionsSource, /getAdminOfferSaveMessage/);
assert.match(actionsSource, /getAdminOfferEmailQueryValue/);
assert.match(actionsSource, /&email=\$\{emailQueryValue\}/);
assert.match(actionsSource, /role=\{message\.type === "error" \? "alert" : "status"\}/);
assert.match(actionsSource, /disabled=\{busy \|\| \(status === offer\.status && !counterAmountChanged\)\}/);

const adminPageSource = fs.readFileSync(adminPagePath, "utf8");
assert.match(adminPageSource, /handleOfferUpdated/);
assert.match(adminPageSource, /onUpdated=\{handleOfferUpdated\}/);
assert.match(adminPageSource, /getAdminOfferSaveMessageFromQuery/);
assert.match(adminPageSource, /searchParams\.get\("email"\)/);
assert.doesNotMatch(adminPageSource, /Counteroffer sent/);

const buyerPageSource = fs.readFileSync(buyerPagePath, "utf8");
assert.match(buyerPageSource, /offer\.status === "countered"/);
assert.match(buyerPageSource, /Accept counteroffer/);
assert.match(buyerPageSource, /currentAmount=\{offer\.amount\}/);
assert.match(buyerPageSource, /updateOfferAmount\(offer\.id,\s*amount,\s*"buyer"/);

const offerEmailSource = fs.readFileSync(offerEmailPath, "utf8");
assert.match(offerEmailSource, /getVerificationEmailFrom/);
assert.match(offerEmailSource, /getVehicleActionEmailMissingEnvVars/);
assert.doesNotMatch(offerEmailSource, /RESEND_FROM_EMAIL/);
assert.match(offerEmailSource, /buyerOriginalAmount/);
assert.match(offerEmailSource, /counterAmount/);
assert.match(offerEmailSource, /buyerAccess\?: "guest" \| "registered"/);
assert.match(offerEmailSource, /buildAbsoluteUrl\(`\/inventory\/\$\{payload\.vehicleId\}`\)/);
assert.match(offerEmailSource, /Your original offer:/);
assert.match(offerEmailSource, /Vehicle owner’s counteroffer:/);
assert.match(offerEmailSource, /View vehicle listing/);
assert.match(offerEmailSource, /Review counteroffer/);

console.log("Admin Offers status and counter-offer validation passed.");
