import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  buildAccountingReportSummary,
  formatMelbourneDateHeading,
  getAccountingEntryGstPortion,
  getAccountingEntryNetPortion,
  getAccountingPaymentMethodLabel,
  getAccountingPeriodLabel,
  getEntryMelbourneDateKey,
  type AccountingPeriodOption,
  type AccountingReportSummary
} from "@/lib/admin-accounting-utils";
import { formatAccountingCurrency } from "@/lib/utils";
import { AdminAccountingEntry } from "@/types";

export type AccountingExportFormat = "xlsx" | "pdf" | "csv";

function getEntryTypeLabel(type: AdminAccountingEntry["type"]) {
  if (type === "income") return "Income";
  if (type === "expense") return "Expense";
  if (type === "receivable") return "Receivable";
  return "Payable";
}

function getEntryStatusLabel(status: AdminAccountingEntry["status"]) {
  if (status === "partially_paid") return "Partially paid";
  if (status === "unpaid") return "Unpaid";
  return "Paid";
}

function escapeCsvValue(value: string | number | boolean) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function formatEntryDate(entry: AdminAccountingEntry) {
  const dateKey = getEntryMelbourneDateKey(entry);
  return dateKey ? formatMelbourneDateHeading(dateKey) : "Pending date";
}

function buildExportFilename(format: AccountingExportFormat, period: AccountingPeriodOption) {
  const safePeriod = getAccountingPeriodLabel(period).toLowerCase().replace(/\s+/g, "-");
  const timestamp = new Date().toISOString().slice(0, 10);
  return `carnest-accounting-${safePeriod}-${timestamp}.${format}`;
}

function buildDetailedRows(entries: AdminAccountingEntry[]) {
  return entries.map((entry) => ({
    date: formatEntryDate(entry),
    type: getEntryTypeLabel(entry.type),
    category: entry.category || getEntryTypeLabel(entry.type),
    amount: entry.amount,
    gstIncluded: entry.gstIncluded ? "Yes" : "No",
    gstAmount: getAccountingEntryGstPortion(entry),
    netAmount: getAccountingEntryNetPortion(entry),
    paymentMethod: getAccountingPaymentMethodLabel(entry.paymentMethod),
    status: getEntryStatusLabel(entry.status),
    vehicle: entry.relatedDisplayReference || "",
    vehicleTitle: entry.relatedVehicleTitle || "",
    customer: entry.relatedCustomerName || "",
    note: entry.note || "",
    createdBy: entry.createdByName || "CarNest Admin",
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toLocaleString("en-AU") : ""
  }));
}

function buildSummaryRows(summary: AccountingReportSummary) {
  return [
    ["Total Income", formatAccountingCurrency(summary.totalIncome)],
    ["Total Expenses", formatAccountingCurrency(summary.totalExpense)],
    ["Net Profit / Loss", formatAccountingCurrency(summary.netCashflow)],
    ["GST Collected", formatAccountingCurrency(summary.gstCollected)],
    ["GST Paid", formatAccountingCurrency(summary.gstPaid)],
    ["GST Payable", formatAccountingCurrency(summary.gstPayable)],
    ["Outstanding Receivables", formatAccountingCurrency(summary.receivables)],
    ["Outstanding Payables", formatAccountingCurrency(summary.payables)]
  ];
}

function buildPaymentMethodSummaryRows(summary: AccountingReportSummary) {
  const totals = {
    cash: 0,
    bankTransfer: 0,
    creditCard: 0,
    other: 0
  };

  summary.paymentMethodBreakdown.forEach((item) => {
    const netValue = item.totalIncome - item.totalExpense;
    if (item.paymentMethod === "cash") totals.cash += netValue;
    else if (item.paymentMethod === "bank_transfer") totals.bankTransfer += netValue;
    else if (item.paymentMethod === "credit_card") totals.creditCard += netValue;
    else totals.other += netValue;
  });

  return [
    ["Cash Total", formatAccountingCurrency(totals.cash)],
    ["Bank Transfer Total", formatAccountingCurrency(totals.bankTransfer)],
    ["Credit Card Total", formatAccountingCurrency(totals.creditCard)],
    ["Other Total", formatAccountingCurrency(totals.other)]
  ];
}

export async function exportAccountingCsv(entries: AdminAccountingEntry[], period: AccountingPeriodOption) {
  const summary = buildAccountingReportSummary(entries);
  const rows = buildDetailedRows(entries);
  const csvLines = [
    ["CarNest Accounting Export", getAccountingPeriodLabel(period)].map(escapeCsvValue).join(","),
    "",
    ...buildSummaryRows(summary).map((row) => row.map(escapeCsvValue).join(",")),
    "",
    "Payment Method Summary",
    ...buildPaymentMethodSummaryRows(summary).map((row) => row.map(escapeCsvValue).join(",")),
    "",
    "Payment Method Breakdown",
    ["Method", "Income", "Expense", "Net"].map(escapeCsvValue).join(","),
    ...summary.paymentMethodBreakdown.map((item) =>
      [
        getAccountingPaymentMethodLabel(item.paymentMethod),
        formatAccountingCurrency(item.totalIncome),
        formatAccountingCurrency(item.totalExpense),
        formatAccountingCurrency(item.netCashflow)
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
    "",
    "Expense Category Breakdown",
    ["Category", "Total Expense"].map(escapeCsvValue).join(","),
    ...summary.expenseCategoryBreakdown.map((item) =>
      [item.category, formatAccountingCurrency(item.totalExpense)].map(escapeCsvValue).join(",")
    ),
    "",
    "Vehicle Profit Report",
    ["Vehicle / Listing", "Customer", "Income", "Expenses", "Profit"].map(escapeCsvValue).join(","),
    ...summary.vehicleProfitBreakdown.map((item) =>
      [
        [item.displayReference, item.vehicleTitle].filter(Boolean).join(" · ") || "General business entry",
        item.customerName || "",
        formatAccountingCurrency(item.totalIncome),
        formatAccountingCurrency(item.totalExpense),
        formatAccountingCurrency(item.netProfit)
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
    "",
    "Customer Report",
    ["Customer", "Income Generated", "Expenses", "Profit Contribution"].map(escapeCsvValue).join(","),
    ...summary.customerProfitBreakdown.map((item) =>
      [
        item.customerName,
        formatAccountingCurrency(item.totalIncome),
        formatAccountingCurrency(item.totalExpense),
        formatAccountingCurrency(item.profitContribution)
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
    "",
    "Detailed Transactions",
    [
      "Date",
      "Type",
      "Category",
      "Amount",
      "GST Included",
      "GST Amount",
      "Net Amount",
      "Payment Method",
      "Status",
      "Vehicle",
      "Vehicle Title",
      "Customer",
      "Note",
      "Created By",
      "Updated At"
    ]
      .map(escapeCsvValue)
      .join(","),
    ...rows.map((row) =>
      [
        row.date,
        row.type,
        row.category,
        row.amount.toFixed(2),
        row.gstIncluded,
        row.gstAmount.toFixed(2),
        row.netAmount.toFixed(2),
        row.paymentMethod,
        row.status,
        row.vehicle,
        row.vehicleTitle,
        row.customer,
        row.note,
        row.createdBy,
        row.updatedAt
      ]
        .map(escapeCsvValue)
        .join(",")
    )
  ];

  triggerDownload(new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8" }), buildExportFilename("csv", period));
}

export async function exportAccountingXlsx(entries: AdminAccountingEntry[], period: AccountingPeriodOption) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const summary = buildAccountingReportSummary(entries);
  const detailRows = buildDetailedRows(entries);

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Value", key: "value", width: 24 }
  ];
  summarySheet.addRow({ metric: "Period", value: getAccountingPeriodLabel(period) });
  summarySheet.addRow({});
  buildSummaryRows(summary).forEach(([metric, value]) => {
    summarySheet.addRow({ metric, value });
  });
  summarySheet.addRow({});
  summarySheet.addRow({ metric: "Payment Method Summary", value: "" });
  buildPaymentMethodSummaryRows(summary).forEach(([metric, value]) => {
    summarySheet.addRow({ metric, value });
  });
  summarySheet.addRow({});
  summarySheet.addRow({ metric: "Payment Method Breakdown", value: "" });
  summarySheet.addRow({ metric: "Method", value: "Income / Expense / Net" });
  summary.paymentMethodBreakdown.forEach((item) => {
    summarySheet.addRow({
      metric: getAccountingPaymentMethodLabel(item.paymentMethod),
      value: `${formatAccountingCurrency(item.totalIncome)} / ${formatAccountingCurrency(item.totalExpense)} / ${formatAccountingCurrency(item.netCashflow)}`
    });
  });
  summarySheet.addRow({});
  summarySheet.addRow({ metric: "Expense Category Breakdown", value: "" });
  summarySheet.addRow({ metric: "Category", value: "Total Expense" });
  summary.expenseCategoryBreakdown.forEach((item) => {
    summarySheet.addRow({
      metric: item.category,
      value: formatAccountingCurrency(item.totalExpense)
    });
  });

  summarySheet.getRow(1).font = { bold: true };

  const detailSheet = workbook.addWorksheet("Detailed Transactions");
  detailSheet.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Type", key: "type", width: 14 },
    { header: "Category", key: "category", width: 22 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "GST Included", key: "gstIncluded", width: 14 },
    { header: "GST Amount", key: "gstAmount", width: 14 },
    { header: "Net Amount", key: "netAmount", width: 14 },
    { header: "Payment Method", key: "paymentMethod", width: 18 },
    { header: "Status", key: "status", width: 16 },
    { header: "Vehicle", key: "vehicle", width: 16 },
    { header: "Vehicle Title", key: "vehicleTitle", width: 28 },
    { header: "Customer", key: "customer", width: 24 },
    { header: "Note", key: "note", width: 40 },
    { header: "Created By", key: "createdBy", width: 18 },
    { header: "Updated At", key: "updatedAt", width: 24 }
  ];
  detailRows.forEach((row) => detailSheet.addRow(row));
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.views = [{ state: "frozen", ySplit: 1 }];

  const vehicleProfitSheet = workbook.addWorksheet("Vehicle Profit Report");
  vehicleProfitSheet.columns = [
    { header: "Vehicle / Listing", key: "vehicle", width: 36 },
    { header: "Customer", key: "customer", width: 24 },
    { header: "Income", key: "income", width: 16 },
    { header: "Expenses", key: "expenses", width: 16 },
    { header: "Profit", key: "profit", width: 16 }
  ];
  summary.vehicleProfitBreakdown.forEach((item) => {
    vehicleProfitSheet.addRow({
      vehicle: [item.displayReference, item.vehicleTitle].filter(Boolean).join(" · ") || "General business entry",
      customer: item.customerName || "",
      income: item.totalIncome,
      expenses: item.totalExpense,
      profit: item.netProfit
    });
  });
  vehicleProfitSheet.getRow(1).font = { bold: true };
  vehicleProfitSheet.views = [{ state: "frozen", ySplit: 1 }];

  const customerReportSheet = workbook.addWorksheet("Customer Report");
  customerReportSheet.columns = [
    { header: "Customer", key: "customer", width: 28 },
    { header: "Income Generated", key: "income", width: 18 },
    { header: "Expenses", key: "expenses", width: 16 },
    { header: "Profit Contribution", key: "profit", width: 20 }
  ];
  summary.customerProfitBreakdown.forEach((item) => {
    customerReportSheet.addRow({
      customer: item.customerName,
      income: item.totalIncome,
      expenses: item.totalExpense,
      profit: item.profitContribution
    });
  });
  customerReportSheet.getRow(1).font = { bold: true };
  customerReportSheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    buildExportFilename("xlsx", period)
  );
}

export async function exportAccountingPdf(entries: AdminAccountingEntry[], period: AccountingPeriodOption) {
  const summary = buildAccountingReportSummary(entries);
  const detailRows = buildDetailedRows(entries);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([842, 1191]);
  let y = 1130;

  const addLine = (text: string, options?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) => {
    const size = options?.size ?? 11;
    if (y < 60) {
      page = pdf.addPage([842, 1191]);
      y = 1130;
    }
    page.drawText(text, {
      x: 48,
      y,
      size,
      font: options?.bold ? boldFont : font,
      color: options?.color ?? rgb(0.16, 0.17, 0.2)
    });
    y -= size + 8;
  };

  addLine("CarNest Accounting Export", { bold: true, size: 18 });
  addLine(`Period: ${getAccountingPeriodLabel(period)}`, { size: 12, color: rgb(0.45, 0.37, 0.27) });
  y -= 6;
  addLine("Summary", { bold: true, size: 13 });
  buildSummaryRows(summary).forEach(([metric, value]) => addLine(`${metric}: ${value}`));
  y -= 6;
  addLine("Payment Method Summary", { bold: true, size: 13 });
  buildPaymentMethodSummaryRows(summary).forEach(([metric, value]) => addLine(`${metric}: ${value}`));
  y -= 6;
  addLine("Payment Method Breakdown", { bold: true, size: 13 });
  summary.paymentMethodBreakdown.forEach((item) => {
    addLine(
      `${getAccountingPaymentMethodLabel(item.paymentMethod)} — Income ${formatAccountingCurrency(item.totalIncome)} · Expense ${formatAccountingCurrency(item.totalExpense)} · Net ${formatAccountingCurrency(item.netCashflow)}`
    );
  });
  y -= 6;
  addLine("Expense Category Breakdown", { bold: true, size: 13 });
  summary.expenseCategoryBreakdown.forEach((item) => {
    addLine(`${item.category}: ${formatAccountingCurrency(item.totalExpense)}`);
  });
  y -= 6;
  addLine("Vehicle Profit Report", { bold: true, size: 13 });
  summary.vehicleProfitBreakdown.forEach((item) => {
    addLine(
      `${[item.displayReference, item.vehicleTitle].filter(Boolean).join(" · ") || "General business entry"} — Income ${formatAccountingCurrency(item.totalIncome)} · Expense ${formatAccountingCurrency(item.totalExpense)} · Profit ${formatAccountingCurrency(item.netProfit)}`,
      { bold: true }
    );
    if (item.customerName) {
      addLine(`Customer: ${item.customerName}`, { size: 10, color: rgb(0.35, 0.35, 0.38) });
    }
  });
  y -= 6;
  addLine("Customer Report", { bold: true, size: 13 });
  summary.customerProfitBreakdown.forEach((item) => {
    addLine(
      `${item.customerName} — Income ${formatAccountingCurrency(item.totalIncome)} · Expense ${formatAccountingCurrency(item.totalExpense)} · Profit ${formatAccountingCurrency(item.profitContribution)}`
    );
  });
  y -= 6;
  addLine("Detailed Transactions", { bold: true, size: 13 });
  detailRows.forEach((row) => {
    addLine(`${row.date} · ${row.type} · ${row.category} · ${formatAccountingCurrency(row.amount)}`, { bold: true });
    addLine(
      `${row.paymentMethod} · ${row.status} · GST ${formatAccountingCurrency(row.gstAmount)} · Net ${formatAccountingCurrency(row.netAmount)}`,
      { size: 10, color: rgb(0.35, 0.35, 0.38) }
    );
    addLine(
      `${row.vehicle || "General business entry"}${row.customer ? ` · ${row.customer}` : ""}${row.note ? ` · ${row.note}` : ""}`,
      { size: 10, color: rgb(0.35, 0.35, 0.38) }
    );
    y -= 4;
  });

  const bytes = await pdf.save();
  const pdfBytes = Uint8Array.from(bytes);
  triggerDownload(new Blob([pdfBytes], { type: "application/pdf" }), buildExportFilename("pdf", period));
}
