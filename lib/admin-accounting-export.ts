import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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

const ACCOUNTING_UNICODE_FONT_URL = "/fonts/arial-unicode.ttf";
let accountingUnicodeFontBytesPromise: Promise<Uint8Array | null> | null = null;
let accountingBrowserFontPromise: Promise<string> | null = null;
const accountingTextFallbackImageCache = new Map<string, Uint8Array>();

async function loadAccountingUnicodeFontBytes() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!accountingUnicodeFontBytesPromise) {
    accountingUnicodeFontBytesPromise = fetch(ACCOUNTING_UNICODE_FONT_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load accounting PDF Unicode font.");
        }

        return new Uint8Array(await response.arrayBuffer());
      })
      .catch(() => null);
  }

  return await accountingUnicodeFontBytesPromise;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to encode fallback text image."));
        return;
      }

      resolve(blob);
    }, mimeType);
  });
}

async function ensureAccountingBrowserFontFamily() {
  if (typeof window === "undefined" || typeof FontFace === "undefined" || !("fonts" in document)) {
    return "\"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif";
  }

  if (!accountingBrowserFontPromise) {
    accountingBrowserFontPromise = (async () => {
      const family = "CarNestAccountingPdfUnicode";
      const fontRegistry = document.fonts;
      if (!fontRegistry.check(`12px "${family}"`)) {
        const fontFace = new FontFace(family, `url(${ACCOUNTING_UNICODE_FONT_URL})`);
        await fontFace.load();
        fontRegistry.add(fontFace);
        await fontRegistry.ready;
      }

      return `"${family}", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
    })().catch(() => "\"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif");
  }

  return await accountingBrowserFontPromise;
}

function accountingRgbToCss(color: ReturnType<typeof rgb>) {
  return `rgb(${Math.round(color.red * 255)}, ${Math.round(color.green * 255)}, ${Math.round(color.blue * 255)})`;
}

async function renderAccountingTextFallbackImage(
  text: string,
  options: {
    bold?: boolean;
    color: ReturnType<typeof rgb>;
    size: number;
  }
) {
  if (typeof window === "undefined") {
    return null;
  }

  const cacheKey = JSON.stringify([text, options.size, options.bold ? 1 : 0, options.color.red, options.color.green, options.color.blue]);
  const cached = accountingTextFallbackImageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const fontFamily = await ensureAccountingBrowserFontFamily();
  const fontSize = Math.max(10, options.size + 2);
  const paddingX = 6;
  const paddingY = 4;
  const scale = 2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const fontWeight = options.bold ? 700 : 400;
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const measuredWidth = Math.ceil(context.measureText(text).width);
  const width = Math.max(1, measuredWidth + paddingX * 2);
  const height = Math.max(1, Math.ceil(fontSize * 1.55) + paddingY * 2);
  canvas.width = width * scale;
  canvas.height = height * scale;

  const scaledContext = canvas.getContext("2d");
  if (!scaledContext) {
    return null;
  }

  scaledContext.scale(scale, scale);
  scaledContext.clearRect(0, 0, width, height);
  scaledContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  scaledContext.fillStyle = accountingRgbToCss(options.color);
  scaledContext.textBaseline = "top";
  scaledContext.fillText(text, paddingX, paddingY);

  try {
    const blob = await canvasToBlob(canvas, "image/png");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    accountingTextFallbackImageCache.set(cacheKey, bytes);
    return bytes;
  } catch {
    return null;
  }
}

async function drawAccountingPdfTextSafely(
  pdf: PDFDocument,
  page: PDFPage,
  text: string,
  options: {
    bold?: boolean;
    color: ReturnType<typeof rgb>;
    font: PDFFont;
    size: number;
    x: number;
    y: number;
  }
) {
  try {
    page.drawText(text, {
      x: options.x,
      y: options.y,
      size: options.size,
      font: options.font,
      color: options.color
    });

    if (options.bold) {
      page.drawText(text, {
        x: options.x + 0.2,
        y: options.y,
        size: options.size,
        font: options.font,
        color: options.color
      });
    }
    return;
  } catch (error) {
    try {
      const fallbackBytes = await renderAccountingTextFallbackImage(text, {
        bold: options.bold,
        color: options.color,
        size: options.size
      });

      if (fallbackBytes) {
        const embedded = await pdf.embedPng(fallbackBytes);
        const width = embedded.width / 2;
        const height = embedded.height / 2;
        page.drawImage(embedded, {
          x: options.x,
          y: options.y - Math.max(0, height - options.size),
          width,
          height
        });
        return;
      }
    } catch {
      // Fall through to a visible non-crashing placeholder.
    }

    try {
      page.drawText("[Text render unavailable]", {
        x: options.x,
        y: options.y,
        size: Math.max(9, options.size - 1),
        font: options.font,
        color: options.color
      });
    } catch {
      // Ignore final fallback failures to keep the export flowing.
    }

    console.warn("Failed to render accounting PDF text.", error);
  }
}

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
  let font: PDFFont;
  let boldFont: PDFFont;

  try {
    const unicodeFontBytes = await loadAccountingUnicodeFontBytes();
    if (unicodeFontBytes) {
      pdf.registerFontkit(fontkit);
      font = await pdf.embedFont(unicodeFontBytes, { subset: true });
      boldFont = font;
    } else {
      font = await pdf.embedFont(StandardFonts.Helvetica);
      boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    }
  } catch {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  let page = pdf.addPage([842, 1191]);
  let y = 1130;

  const addLine = async (text: string, options?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) => {
    const size = options?.size ?? 11;
    const color = options?.color ?? rgb(0.16, 0.17, 0.2);
    if (y < 60) {
      page = pdf.addPage([842, 1191]);
      y = 1130;
    }

    await drawAccountingPdfTextSafely(pdf, page, text, {
      x: 48,
      y,
      size,
      font: options?.bold ? boldFont : font,
      bold: options?.bold,
      color
    });
    y -= size + 8;
  };

  await addLine("CarNest Accounting Export", { bold: true, size: 18 });
  await addLine(`Period: ${getAccountingPeriodLabel(period)}`, { size: 12, color: rgb(0.45, 0.37, 0.27) });
  y -= 6;
  await addLine("Summary", { bold: true, size: 13 });
  for (const [metric, value] of buildSummaryRows(summary)) {
    await addLine(`${metric}: ${value}`);
  }
  y -= 6;
  await addLine("Payment Method Summary", { bold: true, size: 13 });
  for (const [metric, value] of buildPaymentMethodSummaryRows(summary)) {
    await addLine(`${metric}: ${value}`);
  }
  y -= 6;
  await addLine("Payment Method Breakdown", { bold: true, size: 13 });
  for (const item of summary.paymentMethodBreakdown) {
    await addLine(
      `${getAccountingPaymentMethodLabel(item.paymentMethod)} — Income ${formatAccountingCurrency(item.totalIncome)} · Expense ${formatAccountingCurrency(item.totalExpense)} · Net ${formatAccountingCurrency(item.netCashflow)}`
    );
  }
  y -= 6;
  await addLine("Expense Category Breakdown", { bold: true, size: 13 });
  for (const item of summary.expenseCategoryBreakdown) {
    await addLine(`${item.category}: ${formatAccountingCurrency(item.totalExpense)}`);
  }
  y -= 6;
  await addLine("Vehicle Profit Report", { bold: true, size: 13 });
  for (const item of summary.vehicleProfitBreakdown) {
    await addLine(
      `${[item.displayReference, item.vehicleTitle].filter(Boolean).join(" · ") || "General business entry"} — Income ${formatAccountingCurrency(item.totalIncome)} · Expense ${formatAccountingCurrency(item.totalExpense)} · Profit ${formatAccountingCurrency(item.netProfit)}`,
      { bold: true }
    );
    if (item.customerName) {
      await addLine(`Customer: ${item.customerName}`, { size: 10, color: rgb(0.35, 0.35, 0.38) });
    }
  }
  y -= 6;
  await addLine("Customer Report", { bold: true, size: 13 });
  for (const item of summary.customerProfitBreakdown) {
    await addLine(
      `${item.customerName} — Income ${formatAccountingCurrency(item.totalIncome)} · Expense ${formatAccountingCurrency(item.totalExpense)} · Profit ${formatAccountingCurrency(item.profitContribution)}`
    );
  }
  y -= 6;
  await addLine("Detailed Transactions", { bold: true, size: 13 });
  for (const row of detailRows) {
    await addLine(`${row.date} · ${row.type} · ${row.category} · ${formatAccountingCurrency(row.amount)}`, { bold: true });
    await addLine(
      `${row.paymentMethod} · ${row.status} · GST ${formatAccountingCurrency(row.gstAmount)} · Net ${formatAccountingCurrency(row.netAmount)}`,
      { size: 10, color: rgb(0.35, 0.35, 0.38) }
    );
    await addLine(
      `${row.vehicle || "General business entry"}${row.customer ? ` · ${row.customer}` : ""}${row.note ? ` · ${row.note}` : ""}`,
      { size: 10, color: rgb(0.35, 0.35, 0.38) }
    );
    y -= 4;
  }

  const bytes = await pdf.save();
  const pdfBytes = Uint8Array.from(bytes);
  triggerDownload(new Blob([pdfBytes], { type: "application/pdf" }), buildExportFilename("pdf", period));
}
