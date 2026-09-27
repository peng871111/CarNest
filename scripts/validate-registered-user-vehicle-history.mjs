#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();

function readProjectFile(pathname) {
  return readFileSync(join(projectRoot, pathname), "utf8");
}

const existingVehicleViewsRoute = readProjectFile("app/api/vehicle-views/route.ts");
const trackerSource = readProjectFile("components/analytics/vehicle-view-tracker.tsx");
const userHistoryRoute = readProjectFile("app/api/user/vehicle-view-history/route.ts");
const adminHistoryRoute = readProjectFile("app/api/admin/users/[id]/vehicle-view-history/route.ts");
const adminUsersPageSource = readProjectFile("app/admin/users/page.tsx");
const registeredUserActivityPanelSource = readProjectFile("components/admin/registered-user-activity-panel.tsx");
const typesSource = readProjectFile("types/index.ts");
const firestoreRules = readProjectFile("firestore.rules");
const storageRules = readProjectFile("storage.rules");

assert.ok(existingVehicleViewsRoute.includes("vehicleViewEvents"), "Existing vehicle page-view analytics route should remain present.");
assert.ok(existingVehicleViewsRoute.includes("vehicleAnalytics"), "Existing listing analytics route should remain present.");
assert.equal(
  existingVehicleViewsRoute.includes("verifyIdToken"),
  false,
  "Existing vehicle view analytics route is not a verified registered-user history source."
);

assert.ok(trackerSource.includes('fetch("/api/user/vehicle-view-history"'), "Vehicle detail tracker should call the dedicated registered-user history endpoint.");
assert.ok(trackerSource.includes("shouldTrackRegisteredUserActivity"), "Vehicle detail tracker should gate registered-user activity by role.");
assert.ok(trackerSource.includes('role === "buyer" || role === "seller" || role === "dealer"'), "Vehicle detail tracker should not count admin/internal browsing as customer viewing activity.");
assert.ok(trackerSource.includes("firebaseUser.getIdToken()"), "Vehicle detail tracker should send a Firebase ID token for verified user history.");
assert.ok(trackerSource.includes(".catch(() => undefined)"), "Vehicle detail page should continue loading if history tracking fails.");

assert.ok(
  userHistoryRoute.indexOf("getBearerToken(request)") < userHistoryRoute.indexOf("await request.json()"),
  "Registered-user history write should verify authentication before reading the payload."
);
assert.ok(userHistoryRoute.includes("getAdminAuth().verifyIdToken(idToken)"), "Registered-user history write should verify the Firebase ID token server-side.");
assert.ok(userHistoryRoute.includes("!isCustomerRole(userSnapshot.data()?.role)"), "Registered-user history write should skip admin/internal roles.");
assert.ok(userHistoryRoute.includes('collection("vehicleViewHistory").doc(vehicleId)'), "Registered-user history should use one activity document per user and vehicle.");
assert.ok(userHistoryRoute.includes("firstViewedAt: FieldValue.serverTimestamp()"), "Registered-user history should set firstViewedAt with a server timestamp.");
assert.ok(userHistoryRoute.includes("lastViewedAt: FieldValue.serverTimestamp()"), "Registered-user history should set lastViewedAt with a server timestamp.");
assert.ok(userHistoryRoute.includes("viewCount: currentViewCount + 1"), "Registered-user history should increment viewCount on repeat views.");
assert.equal(userHistoryRoute.includes("transaction.set(vehicleRef"), false, "Registered-user history must not modify the vehicle/listing document.");
assert.equal(userHistoryRoute.toLowerCase().includes("ip address"), false, "Registered-user history must not store IP addresses.");
assert.equal(userHistoryRoute.toLowerCase().includes("fingerprint"), false, "Registered-user history must not store browser or device fingerprints.");

assert.ok(adminHistoryRoute.includes('requireVerifiedAdminApiAccess(request, "manageAdmins")'), "Admin Access history read must require server-side admin manageAdmins access.");
assert.ok(adminHistoryRoute.includes('collection("vehicleViewHistory")'), "Admin history read should read the selected user's activity subcollection.");
assert.ok(adminHistoryRoute.includes('orderBy("lastViewedAt", "desc")'), "Admin history should be sorted by most recently viewed first.");
assert.ok(adminHistoryRoute.includes("vehicle: vehicleAvailable"), "Admin history should include safe vehicle details when available.");
assert.ok(adminHistoryRoute.includes(": null"), "Admin history should safely represent missing/deleted vehicles.");

assert.ok(typesSource.includes("RegisteredUserVehicleViewActivity"), "Registered-user activity response type should be defined.");
assert.ok(adminUsersPageSource.includes("RegisteredUserActivityPanel"), "Admin Access page should render the registered-user activity display.");
assert.ok(adminUsersPageSource.includes('user.role !== "admin" && user.role !== "super_admin"'), "Admin Access registered-user activity should exclude internal admin accounts.");
assert.ok(registeredUserActivityPanelSource.includes("View activity"), "Registered users list should expose a View activity action.");
assert.ok(registeredUserActivityPanelSource.includes("Vehicle viewing activity"), "Registered users activity modal should be labelled clearly.");
assert.ok(registeredUserActivityPanelSource.includes("No vehicle viewing history yet."), "Registered users activity modal should show an empty state.");
assert.ok(registeredUserActivityPanelSource.includes("Vehicle no longer available"), "Registered users activity modal should fail safely for missing listings.");
assert.ok(registeredUserActivityPanelSource.includes("item.vehicle.adminHref"), "Registered users activity rows should link to admin vehicle details when available.");
const adminAccessManagerSource = readProjectFile("components/admin/admin-access-manager.tsx");
assert.ok(adminAccessManagerSource.includes('<option value="admin">Admin</option>'), "Existing Admin Access admin role controls should remain present.");
assert.ok(adminAccessManagerSource.includes('<option value="super_admin">Super admin</option>'), "Existing Admin Access super-admin role controls should remain present.");
assert.ok(adminAccessManagerSource.includes("Save access"), "Existing Admin Access save controls should remain present.");

assert.equal(firestoreRules.includes("vehicleViewHistory"), false, "Firestore rules should not be broadened for vehicle viewing history.");
assert.equal(storageRules.includes("vehicleViewHistory"), false, "Storage rules should not be changed for vehicle viewing history.");

console.log("Registered-user vehicle view history validation passed.");
