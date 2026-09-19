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

const helperPath = path.join(repoRoot, "lib/admin-pricing.ts");
const serverLoaderPath = path.join(repoRoot, "lib/admin-pricing-server.ts");
const pagePath = path.join(repoRoot, "app/admin/pricing/page.tsx");
const editorPath = path.join(repoRoot, "components/pricing/pricing-request-admin-editor.tsx");
const actionRoutePath = path.join(repoRoot, "app/api/admin/pricing/[id]/route.ts");

const {
  buildAdminPricingCollectionResult,
  hasAdminPricingSessionAccess,
  parseAdminPricingPermissionsCookie,
  sanitizeAdminPricingUpdateInput,
  serializeAdminPricingRequestDoc
} = loadTypescriptModule(helperPath);

assert.equal(hasAdminPricingSessionAccess({}), false);
assert.equal(hasAdminPricingSessionAccess({ session: "active", role: "seller", permissions: { managePricing: true } }), false);
assert.equal(hasAdminPricingSessionAccess({ session: "active", role: "admin", permissions: { managePricing: false } }), false);
assert.equal(hasAdminPricingSessionAccess({ session: "active", role: "admin", permissions: { managePricing: true } }), true);
assert.equal(hasAdminPricingSessionAccess({ session: "active", role: "super_admin" }), true);

const encodedPermissions = encodeURIComponent(JSON.stringify({ managePricing: true, manageVehicles: false }));
assert.equal(JSON.stringify(parseAdminPricingPermissionsCookie(encodedPermissions)), JSON.stringify({
  managePricing: true,
  manageVehicles: false
}));
assert.equal(JSON.stringify(parseAdminPricingPermissionsCookie("%7Bbroken")), "{}");

const toDate = (value) => ({ toDate: () => new Date(value) });
const newer = serializeAdminPricingRequestDoc("newer", {
  userId: "user-1",
  timeline: "Just exploring",
  message: "Current listing feels high.",
  status: "NEW",
  currentPrice: 32000,
  createdAt: toDate("2026-09-17T06:59:00.601Z")
});
assert.equal(newer.createdAt, "2026-09-17T06:59:00.601Z");
assert.equal(newer.currentPrice, 32000);

const result = buildAdminPricingCollectionResult([
  {
    id: "older",
    data: () => ({
      userId: "user-2",
      timeline: "1–2 months",
      message: "Can wait.",
      status: "CLOSED",
      createdAt: toDate("2026-04-16T09:15:21.585Z")
    })
  },
  {
    id: "bad",
    data: () => ({
      timeline: "Just exploring",
      message: "Missing user id.",
      status: "NEW",
      createdAt: toDate("2026-09-18T00:00:00.000Z")
    })
  },
  {
    id: "newer",
    data: () => ({
      userId: "user-1",
      timeline: "Just exploring",
      message: "Current listing feels high.",
      status: "NEW",
      createdAt: toDate("2026-09-17T06:59:00.601Z")
    })
  }
]);

assert.equal(result.source, "firestore");
assert.equal(JSON.stringify(result.items.map((item) => item.id)), JSON.stringify(["newer", "older"]));
assert.match(result.error ?? "", /Skipped 1 malformed pricing request record/);

assert.deepEqual(
  JSON.parse(JSON.stringify(sanitizeAdminPricingUpdateInput({
    status: "REPLIED",
    response: "  Sent a response.  ",
    leadRating: "HOT",
    nextAction: "Follow up later"
  }))),
  {
    status: "REPLIED",
    response: "Sent a response.",
    leadRating: "HOT",
    nextAction: "Follow up later"
  }
);
assert.throws(() => sanitizeAdminPricingUpdateInput({ status: "BROKEN", response: "" }), /valid pricing status/);
assert.throws(() => sanitizeAdminPricingUpdateInput({ status: "NEW", leadRating: "BOILING" }), /valid lead rating/);

const serverSource = fs.readFileSync(serverLoaderPath, "utf8");
assert.match(serverSource, /import "server-only";/);
assert.match(serverSource, /getAdminDb\(\)\.collection\("pricingRequests"\)\.get\(\)/);
assert.ok(
  serverSource.indexOf("hasAdminPricingSessionAccess") < serverSource.indexOf("getAdminDb().collection(\"pricingRequests\").get()"),
  "Admin Pricing loader must verify access before using Admin SDK"
);

const pageSource = fs.readFileSync(pagePath, "utf8");
assert.match(pageSource, /getAdminPricingRequestsData/);
assert.doesNotMatch(pageSource, /getPricingRequestsData/);
assert.match(pageSource, /requiredPermission="managePricing"/);

const routeSource = fs.readFileSync(actionRoutePath, "utf8");
assert.match(routeSource, /requireVerifiedAdminApiAccess\(request,\s*"managePricing"\)/);
assert.match(routeSource, /getAdminDb\(\)\.collection\("pricingRequests"\)\.doc\(id\)/);
assert.match(routeSource, /FieldValue\.serverTimestamp\(\)/);
assert.match(routeSource, /FieldValue\.delete\(\)/);
assert.ok(
  routeSource.indexOf("requireVerifiedAdminApiAccess") < routeSource.indexOf("getAdminDb().collection(\"pricingRequests\").doc(id)"),
  "Admin Pricing action route must verify access before using Admin SDK"
);

const editorSource = fs.readFileSync(editorPath, "utf8");
assert.doesNotMatch(editorSource, /updatePricingRequest/);
assert.match(editorSource, /firebaseUser\.getIdToken\(true\)/);
assert.match(editorSource, /fetch\(`\/api\/admin\/pricing\/\$\{encodeURIComponent\(pricingRequest\.id\)\}`/);
assert.match(editorSource, /authorization:\s*`Bearer \$\{idToken\}`/);
assert.match(editorSource, /disabled=\{busy \|\| unchanged\}/);
assert.match(editorSource, /Pricing request saved\./);
assert.match(editorSource, /role=\{message\.type === "error" \? "alert" : "status"\}/);

console.log("Admin Pricing loader/action validation passed.");
