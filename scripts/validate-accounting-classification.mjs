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

function loadAccountingUtilsModule() {
  const source = readProjectFile("lib/admin-accounting-utils.ts");
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

  vm.runInNewContext(transpiled, sandbox, { filename: "lib/admin-accounting-utils.ts" });
  return module.exports;
}

const {
  buildAccountingCashSummary,
  buildAccountingReportSummary,
  getAccountingRelatedVehicleDisplayLabel,
  getAccountingUnlinkedVehicleLabel,
} = loadAccountingUtilsModule();

function entry(overrides) {
  return {
    id: "entry-test",
    type: "income",
    date: "2026-08-09",
    amount: 0,
    category: "",
    paymentMethod: "bank_transfer",
    gstIncluded: true,
    gstCalculationMode: "inclusive",
    relatedVehicleId: "",
    relatedVehicleRecordId: "",
    relatedDisplayReference: "",
    relatedVehicleTitle: "",
    relatedCustomerProfileId: "",
    relatedCustomerName: "",
    note: "",
    status: "paid",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

assert.equal(
  getAccountingUnlinkedVehicleLabel("income"),
  "General income (not linked to a vehicle)",
  "Unlinked income must never be labelled as a business expense."
);
assert.equal(
  getAccountingUnlinkedVehicleLabel("expense"),
  "Business expense (not linked to a vehicle)",
  "Unlinked expense should retain the business-expense wording."
);
assert.equal(
  getAccountingUnlinkedVehicleLabel("receivable"),
  "Not linked to a vehicle",
  "Unlinked receivable should use neutral vehicle-link wording."
);

assert.equal(
  getAccountingRelatedVehicleDisplayLabel(entry({ type: "income", category: "Listing fee" })),
  "General income (not linked to a vehicle)",
  "Recent Entries label for unlinked Listing fee income should be income-safe."
);
assert.equal(
  getAccountingRelatedVehicleDisplayLabel(entry({ type: "expense", category: "Other expense" })),
  "Business expense (not linked to a vehicle)",
  "Recent Entries label for unlinked expenses should describe the unlinked expense."
);
assert.equal(
  getAccountingRelatedVehicleDisplayLabel(entry({
    type: "income",
    relatedDisplayReference: "CN-0404",
    relatedVehicleTitle: "2018 Toyota RAV4",
    relatedCustomerName: "Customer Name",
  })),
  "CN-0404 · 2018 Toyota RAV4 · Customer Name",
  "Linked income should display the linked listing details, not a generic expense label."
);
assert.equal(
  getAccountingRelatedVehicleDisplayLabel(entry({
    type: "expense",
    relatedDisplayReference: "CN-0505",
    relatedVehicleTitle: "2020 Mazda 3",
  })),
  "CN-0505 · 2020 Mazda 3",
  "Linked expense should display the linked listing details."
);

const entries = [
  entry({ id: "unlinked-income", type: "income", category: "Listing fee", amount: 700, paymentMethod: "cash" }),
  entry({
    id: "linked-income",
    type: "income",
    category: "Listing fee",
    amount: 300,
    paymentMethod: "bank_transfer",
    relatedVehicleId: "listing-1",
    relatedDisplayReference: "CN-0001",
    relatedVehicleTitle: "Linked Listing",
  }),
  entry({ id: "unlinked-expense", type: "expense", category: "Other expense", amount: 120, paymentMethod: "cash" }),
  entry({
    id: "linked-expense",
    type: "expense",
    category: "Repair",
    amount: 80,
    paymentMethod: "bank_transfer",
    relatedVehicleId: "listing-1",
    relatedDisplayReference: "CN-0001",
    relatedVehicleTitle: "Linked Listing",
  }),
];

const cashSummary = buildAccountingCashSummary(entries);
assert.equal(cashSummary.totalIncome, 1000, "Income total must be based on entry.type === income, including unlinked income.");
assert.equal(cashSummary.totalExpense, 200, "Expense total must be based on entry.type === expense, including unlinked expense.");
assert.equal(cashSummary.incomeByCash, 700, "Cash income must include unlinked cash income.");
assert.equal(cashSummary.expenseByCash, 120, "Cash expense must include unlinked cash expense.");
assert.equal(cashSummary.netCashflow, 800, "Net cashflow must remain income minus expense.");

const reportSummary = buildAccountingReportSummary(entries);
assert.equal(reportSummary.totalIncome, 1000, "Report total income must not depend on vehicle linkage.");
assert.equal(reportSummary.totalExpense, 200, "Report total expense must not depend on vehicle linkage.");
assert.equal(
  reportSummary.expenseCategoryBreakdown.some((item) => item.category === "Listing fee"),
  false,
  "Income categories must not appear in the expense-category breakdown."
);
assert.equal(reportSummary.vehicleProfitBreakdown.length, 1, "Only linked entries should appear in the vehicle profit breakdown.");
assert.equal(reportSummary.vehicleProfitBreakdown[0].totalIncome, 300, "Linked income should stay income in vehicle reports.");
assert.equal(reportSummary.vehicleProfitBreakdown[0].totalExpense, 80, "Linked expense should stay expense in vehicle reports.");

const accountingPanelSource = readProjectFile("components/admin/admin-accounting-panel.tsx");
assert.equal(
  accountingPanelSource.includes('entry.relatedDisplayReference || "Business expense"'),
  false,
  "Recent Entries must not fall back to Business expense without checking entry.type."
);

console.log("Accounting classification validation passed.");
