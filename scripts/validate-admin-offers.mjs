import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const repoRoot = process.cwd();

function loadTypescriptModule(filePath) {
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
    module,
    exports: module.exports,
    require(specifier) {
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
  buildAdminOfferUpdatePlan,
  sanitizeAdminOfferUpdateInput,
  serializeAdminOfferDoc
} = loadTypescriptModule(helperPath);

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
  () => buildAdminOfferUpdatePlan({ status: "accepted", counterAmount: 65000 }, { ...registeredOffer, status: "accepted" }),
  /only available while a buyer offer is still pending/
);
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

const routeSource = fs.readFileSync(routePath, "utf8");
assert.match(routeSource, /requireVerifiedAdminApiAccess\(request,\s*"manageOffers"\)/);
assert.match(routeSource, /const db = getAdminDb\(\)/);
assert.match(routeSource, /db\.collection\("offers"\)\.doc\(id\)/);
assert.match(routeSource, /db\.runTransaction/);
assert.match(routeSource, /transaction\.get\(ref\)/);
assert.match(routeSource, /transaction\.update\(ref,\s*patch\)/);
assert.match(routeSource, /sendOfferEmail/);
assert.match(routeSource, /resolveBuyerEmailRecipient/);
assert.match(routeSource, /offer\.source === "guest"/);
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
assert.match(actionsSource, /Counteroffer saved and emailed to buyer\./);
assert.match(actionsSource, /Counteroffer saved, but buyer email could not be sent\./);
assert.match(actionsSource, /role=\{message\.type === "error" \? "alert" : "status"\}/);
assert.match(actionsSource, /disabled=\{busy \|\| \(status === offer\.status && !counterAmountChanged\)\}/);

const adminPageSource = fs.readFileSync(adminPagePath, "utf8");
assert.match(adminPageSource, /handleOfferUpdated/);
assert.match(adminPageSource, /onUpdated=\{handleOfferUpdated\}/);
assert.match(adminPageSource, /Counteroffer saved/);
assert.doesNotMatch(adminPageSource, /Counteroffer sent/);

const buyerPageSource = fs.readFileSync(buyerPagePath, "utf8");
assert.match(buyerPageSource, /offer\.status === "countered"/);
assert.match(buyerPageSource, /Accept counteroffer/);
assert.match(buyerPageSource, /currentAmount=\{offer\.amount\}/);
assert.match(buyerPageSource, /updateOfferAmount\(offer\.id,\s*amount,\s*"buyer"/);

const offerEmailSource = fs.readFileSync(offerEmailPath, "utf8");
assert.match(offerEmailSource, /buyerOriginalAmount/);
assert.match(offerEmailSource, /counterAmount/);
assert.match(offerEmailSource, /buyerAccess\?: "guest" \| "registered"/);
assert.match(offerEmailSource, /buildAbsoluteUrl\(`\/inventory\/\$\{payload\.vehicleId\}`\)/);
assert.match(offerEmailSource, /Your original offer:/);
assert.match(offerEmailSource, /CarNest counter offer:/);
assert.match(offerEmailSource, /View vehicle listing/);
assert.match(offerEmailSource, /Review counteroffer/);

console.log("Admin Offers status and counter-offer validation passed.");
