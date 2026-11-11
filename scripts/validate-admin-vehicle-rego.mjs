#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const projectRoot = process.cwd();

function readProjectFile(pathname) {
  return readFileSync(join(projectRoot, pathname), "utf8");
}

function loadTypeScriptModule(pathname) {
  const source = readProjectFile(pathname);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: true
    }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { Date, Intl, module, exports: module.exports });
  return module.exports;
}

const rego = loadTypeScriptModule("lib/admin-vehicle-rego.ts");
const vehicleHubSource = readProjectFile("components/admin/vehicle-management-hub.tsx");
const typesSource = readProjectFile("types/index.ts");
const referenceDate = "2026-03-15";

assert.equal(rego.getMelbourneCalendarDateKey(new Date("2026-03-15T12:00:00+11:00")), referenceDate, "Reminder calendar should use the Melbourne date.");
assert.equal(rego.getRegoExpiryReminder("2026-03-14", referenceDate)?.label, "EXPIRED · 1 day ago", "Yesterday should be expired.");
assert.equal(rego.getRegoExpiryReminder("2026-02-13", referenceDate)?.label, "EXPIRED · 30 days ago", "Older dates should remain expired.");
assert.equal(rego.getRegoExpiryReminder("2026-03-15", referenceDate)?.label, "URGENT · Today", "Today should be urgent.");
assert.equal(rego.getRegoExpiryReminder("2026-03-16", referenceDate)?.label, "URGENT · 1 day left", "Tomorrow should be urgent.");
assert.equal(rego.getRegoExpiryReminder("2026-03-22", referenceDate)?.label, "URGENT · 7 days left", "Seven days should be urgent.");
assert.equal(rego.getRegoExpiryReminder("2026-03-23", referenceDate)?.label, "EXPIRING · 8 days left", "Eight days should be expiring soon.");
assert.equal(rego.getRegoExpiryReminder("2026-04-14", referenceDate)?.label, "EXPIRING · 30 days left", "Thirty days should be expiring soon.");
assert.equal(rego.getRegoExpiryReminder("2026-04-15", referenceDate), null, "Thirty-one days should not display a reminder.");
assert.equal(rego.getRegoExpiryReminder("", referenceDate), null, "Missing dates should not display a reminder.");
assert.equal(rego.getRegoExpiryReminder("2026-02-30", referenceDate), null, "Invalid dates should not display a reminder.");

const orderedExpiryDates = ["2026-03-22", "2026-02-13", "2026-03-15", "2026-03-14"].sort(rego.compareRegoExpiryDateKeys);
assert.deepEqual(orderedExpiryDates, ["2026-02-13", "2026-03-14", "2026-03-15", "2026-03-22"], "Rego expiry sorting should place earlier dates first.");
assert.equal(rego.isRegoExpiringWithinThirtyDays("2026-03-14", referenceDate), true, "Expired registrations should be included in the special filter.");
assert.equal(rego.isRegoExpiringWithinThirtyDays("2026-04-15", referenceDate), false, "Registrations beyond thirty days should not be included in the special filter.");

assert.ok(typesSource.includes("regoExpiry?: string;"), "The existing Vehicle.regoExpiry field should be reused.");
assert.ok(vehicleHubSource.includes('value={REGO_EXPIRING_VEHICLES_FILTER}'), "The existing status dropdown should add the Rego expiry option.");
assert.ok(vehicleHubSource.includes('row.filterGroup === "Active" && isRegoExpiringWithinThirtyDays'), "The special filter should only include Active vehicles with due registrations.");
assert.ok(vehicleHubSource.includes("compareRegoExpiryDateKeys(left.vehicle.regoExpiry, right.vehicle.regoExpiry)"), "The special filter should sort expiry dates before rendering.");
assert.ok(vehicleHubSource.includes("getRegoExpiryReminder(vehicle.regoExpiry, regoToday)"), "The card reminder should be derived from existing Rego data.");
assert.ok(vehicleHubSource.includes("setInterval(refreshRegoToday, 60_000)"), "Reminder status should refresh as Melbourne calendar days change without writes.");
assert.equal(vehicleHubSource.includes("saveVehicleRecord({ rego"), false, "The reminder must not write vehicle data.");
const changedFiles = execFileSync("git", ["diff", "--name-only"], { cwd: projectRoot, encoding: "utf8" }).trim().split("\n").filter(Boolean);
assert.equal(changedFiles.includes("firestore.rules"), false, "Firestore rules must not be changed for Rego reminders.");
assert.equal(changedFiles.includes("storage.rules"), false, "Storage rules must not be changed for Rego reminders.");

console.log("Admin vehicle Rego expiry validation passed.");
