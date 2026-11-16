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

function loadWheelSelector() {
  const source = readProjectFile("lib/warehouse-wheel-selector.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(transpiled, { module, exports: module.exports }, {
    filename: "lib/warehouse-wheel-selector.ts",
  });
  return module.exports;
}

const { getWarehouseWheelSelectorStatus } = loadWheelSelector();

const wheelRecords = [
  {
    id: "front-left-scratch",
    wheelPosition: "front-left",
    wheelZone: "outer_rim_top",
    damageType: "scratch",
    notes: "Existing scratch",
    photoIds: ["front-left-photo"],
  },
  {
    id: "front-right-repaired",
    wheelPosition: "front-right",
    wheelZone: "outer_rim_top",
    damageType: "repaired_damage",
    notes: "Repaired before return",
    photoIds: [],
  },
  {
    id: "rear-left-verified",
    wheelPosition: "rear-left",
    wheelZone: "outer_rim_top",
    damageType: "curb_rash",
    notes: "Repair verified",
    photoIds: [],
    repairStatus: "verified",
  },
];

assert.equal(getWarehouseWheelSelectorStatus(wheelRecords, "front-left"), "damage_recorded", "Unresolved records must be shown as damage recorded.");
assert.equal(getWarehouseWheelSelectorStatus(wheelRecords, "front-right"), "repaired", "Recorded repaired damage must show as repaired.");
assert.equal(getWarehouseWheelSelectorStatus(wheelRecords, "rear-left"), "repaired", "Admin-verified repairs must show as repaired.");
assert.equal(getWarehouseWheelSelectorStatus(wheelRecords, "rear-right"), "original", "A wheel without a damage record must remain original.");

const workspaceSource = readProjectFile("components/admin/warehouse-intake-workspace.tsx");
const wheelSectionStart = workspaceSource.indexOf("Use the enlarged wheel diagrams to record precise wheel or rim damage independently from the overall exterior body map.");
const wheelSectionEnd = workspaceSource.indexOf("<p className=\"text-sm font-semibold text-ink\">Selected damage grid area</p>");
const wheelSection = workspaceSource.slice(wheelSectionStart, wheelSectionEnd);

assert.ok(wheelSectionStart >= 0 && wheelSectionEnd > wheelSectionStart, "Wheel condition editor section must remain present.");
assert.match(wheelSection, /grid grid-cols-2 gap-3 md:grid-cols-4/, "Wheel selectors must be a compact 2 x 2 mobile grid and four columns on larger screens.");
assert.match(wheelSection, /setSelectedWheelPosition\(wheelPosition\)/, "Each wheel selector must switch the active wheel only.");
assert.equal((wheelSection.match(/<WheelRimConditionMap/g) ?? []).length, 1, "Only the selected wheel may render an expanded inspection map.");
assert.match(wheelSection, /position=\{selectedWheelPosition\}/, "The inspection map must use the selected wheel position.");
assert.match(wheelSection, /onManageDamagePhoto=\{openDamagePhotoManagement\}/, "Selected-wheel photo repair/history controls must remain available.");
assert.match(workspaceSource, /selectedWheelZones\[selectedWheelPosition\]/, "Each wheel must retain its own selected zone while switching panels.");
assert.match(workspaceSource, /updateWheelZoneRecord\(selectedWheelPosition, selectedWheelZone/, "Notes and condition changes must remain tied to the selected wheel.");

for (const pathname of ["lib/data.ts", "lib/warehouse-intake-pdf.ts", "lib/vehicle-report-pdf.ts"]) {
  const source = readProjectFile(pathname);
  assert.match(source, /wheelDamageRecords/, `${pathname} must continue to read all stored wheel records.`);
  assert.doesNotMatch(source, /selectedWheelPosition/, `${pathname} must remain independent from the admin-only selected wheel.`);
}

console.log("Storage Contract wheel selector validation passed.");
