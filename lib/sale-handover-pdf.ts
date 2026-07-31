import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  SALE_HANDOVER_AGREEMENT_TERMS,
  SALE_HANDOVER_PREPARATION_LABELS,
  buildSaleHandoverVerificationUrl,
  calculateSaleHandoverBalance,
  getSaleHandoverBuyerDisplayName,
  getSaleHandoverVehicleTitle,
} from "@/lib/sale-handover";
import { SaleHandoverRecord } from "@/types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 34;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const UNICODE_FONT_URL = "/fonts/arial-unicode.ttf";
const PUBLIC_SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://www.carnest.au";

let unicodeFontBytesPromise: Promise<Uint8Array> | null = null;

async function loadUnicodeFontBytes() {
  if (!unicodeFontBytesPromise) {
    unicodeFontBytesPromise = fetch(UNICODE_FONT_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error("Unable to load Unicode PDF font.");
      }
      return new Uint8Array(await response.arrayBuffer());
    });
  }

  return await unicodeFontBytesPromise;
}

function sanitizeText(value?: string | number | null, fallback = "Not provided") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
    timeZoneName: "short",
  }).format(date);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawTextBlock(input: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size: number;
  lineHeight?: number;
  color?: ReturnType<typeof rgb>;
}) {
  let cursorY = input.y;
  const lineHeight = input.lineHeight ?? input.size + 3;
  for (const line of wrapText(input.text, input.font, input.size, input.maxWidth)) {
    input.page.drawText(line, {
      x: input.x,
      y: cursorY,
      size: input.size,
      font: input.font,
      color: input.color ?? rgb(0.12, 0.1, 0.08),
    });
    cursorY -= lineHeight;
  }
  return cursorY;
}

function drawSectionHeading(page: PDFPage, title: string, x: number, y: number, font: PDFFont) {
  page.drawText(title.toUpperCase(), {
    x,
    y,
    size: 8.5,
    font,
    color: rgb(0.58, 0.34, 0.18),
  });
  page.drawLine({
    start: { x, y: y - 5 },
    end: { x: x + CONTENT_WIDTH, y: y - 5 },
    thickness: 0.5,
    color: rgb(0.88, 0.84, 0.78),
  });
  return y - 18;
}

function drawRows(input: {
  page: PDFPage;
  rows: Array<[string, string]>;
  x: number;
  y: number;
  width: number;
  labelFont: PDFFont;
  valueFont: PDFFont;
  size?: number;
}) {
  const labelWidth = input.width * 0.34;
  let cursorY = input.y;
  for (const [label, value] of input.rows) {
    input.page.drawText(label, {
      x: input.x,
      y: cursorY,
      size: input.size ?? 7.5,
      font: input.labelFont,
      color: rgb(0.45, 0.42, 0.36),
    });
    cursorY = drawTextBlock({
      page: input.page,
      text: value || "Not provided",
      x: input.x + labelWidth,
      y: cursorY,
      maxWidth: input.width - labelWidth,
      font: input.valueFont,
      size: input.size ?? 7.5,
      lineHeight: 9.5,
      color: rgb(0.12, 0.1, 0.08),
    });
    cursorY -= 3.5;
  }
  return cursorY;
}

async function embedSignature(
  pdfDoc: PDFDocument,
  page: PDFPage,
  storagePath: string,
  frame: { x: number; y: number; width: number; height: number },
  resolveStorageBytes?: (storagePath: string) => Promise<Uint8Array>
) {
  if (!storagePath || !resolveStorageBytes) return false;

  try {
    const bytes = await resolveStorageBytes(storagePath);
    const image = await pdfDoc.embedPng(bytes).catch(() => pdfDoc.embedJpg(bytes));
    const scale = Math.min(frame.width / image.width, frame.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
      x: frame.x + (frame.width - width) / 2,
      y: frame.y + (frame.height - height) / 2,
      width,
      height,
    });
    return true;
  } catch {
    return false;
  }
}

function buildVerificationUrl(record: SaleHandoverRecord) {
  return `${PUBLIC_SITE_ORIGIN}${buildSaleHandoverVerificationUrl(record)}`;
}

function getPreparedByDisplayName(record: SaleHandoverRecord) {
  return sanitizeText(record.preparedByName || record.lastEditedByName || record.pdf?.generatedByName, "CarNest Admin");
}

export async function generateSaleHandoverPdf(
  record: SaleHandoverRecord,
  options?: {
    documentHash?: string;
    resolveStorageBytes?: (storagePath: string) => Promise<Uint8Array>;
  }
) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  try {
    const unicodeBytes = await loadUnicodeFontBytes();
    bodyFont = await pdfDoc.embedFont(unicodeBytes, { subset: true });
    boldFont = bodyFont;
  } catch {
    // Standard fonts are safe for the fixed English legal copy; Unicode is used when the bundled asset is available.
  }

  const page1 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const page2 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const generatedAt = new Date().toISOString();
  const isFullySigned = Boolean(record.sellerSignature?.signatureStoragePath && record.buyerSignature?.signatureStoragePath);
  const statusLabel = isFullySigned ? "SIGNED PRIVATE SALE & HANDOVER RECORD" : "DRAFT — NOT SIGNED";
  const latestBuyerCorrection = [...(record.amendments ?? [])]
    .reverse()
    .find((amendment) => amendment.type === "buyer_correction" && amendment.documentVersion === record.documentVersion);
  const verificationUrl = buildVerificationUrl(record);
  const qrImage = options?.documentHash
    ? await pdfDoc.embedPng(await QRCode.toDataURL(verificationUrl, {
        margin: 1,
        width: 132,
        errorCorrectionLevel: "M",
      }))
    : null;

  page1.drawText("CarNest", {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 44,
    size: 20,
    font: boldFont,
    color: rgb(0.09, 0.08, 0.07),
  });
  page1.drawText("Private Vehicle Sale & Handover Record", {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 66,
    size: 14,
    font: boldFont,
    color: rgb(0.58, 0.34, 0.18),
  });
  page1.drawText(statusLabel, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 86,
    size: 9,
    font: boldFont,
    color: isFullySigned ? rgb(0.1, 0.43, 0.25) : rgb(0.67, 0.25, 0.1),
  });
  page1.drawText(`Record No: ${record.recordNumber}`, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 104,
    size: 8,
    font: bodyFont,
    color: rgb(0.25, 0.22, 0.18),
  });
  page1.drawText(`Generated: ${formatDateTime(generatedAt)}`, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 118,
    size: 8,
    font: bodyFont,
    color: rgb(0.25, 0.22, 0.18),
  });
  page1.drawText(`Version: ${record.documentVersion} · Terms: ${record.agreementTermsVersion}`, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 132,
    size: 8,
    font: bodyFont,
    color: rgb(0.25, 0.22, 0.18),
  });
  if (latestBuyerCorrection) {
    page1.drawText("Corrected version", {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 146,
      size: 8,
      font: boldFont,
      color: rgb(0.58, 0.34, 0.18),
    });
    const amendmentReason = sanitizeText(latestBuyerCorrection.reason, "Not provided").slice(0, 90);
    page1.drawText(`Amended: ${formatDateTime(latestBuyerCorrection.createdAt)} · Reason: ${amendmentReason}`, {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 159,
      size: 7,
      font: bodyFont,
      color: rgb(0.35, 0.32, 0.27),
    });
  }
  if (qrImage) {
    page1.drawImage(qrImage, {
      x: PAGE_WIDTH - PAGE_MARGIN - 88,
      y: PAGE_HEIGHT - 124,
      width: 88,
      height: 88,
    });
    page1.drawText("Verify this document", {
      x: PAGE_WIDTH - PAGE_MARGIN - 84,
      y: PAGE_HEIGHT - 137,
      size: 7,
      font: bodyFont,
      color: rgb(0.45, 0.42, 0.36),
    });
  }

  let cursorY = latestBuyerCorrection ? PAGE_HEIGHT - 182 : PAGE_HEIGHT - 162;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 14;
  const columnWidth = CONTENT_WIDTH / 2 - 14;

  cursorY = drawSectionHeading(page1, "A. Seller Details", leftX, cursorY, boldFont);
  const sellerY = drawRows({
    page: page1,
    rows: [
      ["Customer ID", sanitizeText(record.seller.customerId)],
      ["Name", sanitizeText(record.seller.legalName)],
      ["Phone", sanitizeText(record.seller.phone)],
      ["Email", sanitizeText(record.seller.email)],
      ["Address", [record.seller.address, record.seller.suburb, record.seller.state, record.seller.postcode].filter(Boolean).join(", ") || "Not provided"],
    ],
    x: leftX,
    y: cursorY,
    width: columnWidth,
    labelFont: boldFont,
    valueFont: bodyFont,
  });

  let rightCursorY = drawSectionHeading(page1, "B. Buyer Details", rightX, PAGE_HEIGHT - 162, boldFont);
  rightCursorY = drawRows({
    page: page1,
    rows: [
      ["Customer ID", sanitizeText(record.buyer.buyerCustomerId)],
      ["Name / company", sanitizeText(getSaleHandoverBuyerDisplayName(record.buyer))],
      ["Phone", sanitizeText(record.buyer.phone)],
      ["Email", sanitizeText(record.buyer.email)],
      ["Address", [record.buyer.address, record.buyer.suburb, record.buyer.state, record.buyer.postcode].filter(Boolean).join(", ") || "Not provided"],
    ],
    x: rightX,
    y: rightCursorY,
    width: columnWidth,
    labelFont: boldFont,
    valueFont: bodyFont,
  });

  cursorY = Math.min(sellerY, rightCursorY) - 6;
  cursorY = drawSectionHeading(page1, "C. Vehicle Details", leftX, cursorY, boldFont);
  const vehicleRows: Array<[string, string]> = [
    ["Year", sanitizeText(record.vehicle.year)],
    ["Make", sanitizeText(record.vehicle.make)],
    ["Model", sanitizeText(record.vehicle.model)],
    ["Variant", sanitizeText(record.vehicle.variant)],
    ["Colour", sanitizeText(record.vehicle.colour)],
    ["Registration number", sanitizeText(record.vehicle.registrationNumber, record.vehicle.registrationStatus === "unregistered" ? "Unregistered" : "Not provided")],
    ["Registration expiry", sanitizeText(record.vehicle.registrationExpiry)],
    ["Registration status", sanitizeText(record.vehicle.registrationStatus)],
    ["Odometer at agreement", sanitizeText(record.vehicle.odometerAtAgreement)],
    ["Odometer at handover", sanitizeText(record.vehicle.odometerAtHandover)],
    ["Keys supplied", sanitizeText(record.vehicle.keysSupplied)],
    ["VIN / chassis number", sanitizeText(record.vehicle.vinOrChassis)],
    ["Engine number", sanitizeText(record.vehicle.engineNumber)],
  ];
  const vehicleMid = Math.ceil(vehicleRows.length / 2);
  const vehicleLeftY = drawRows({
    page: page1,
    rows: vehicleRows.slice(0, vehicleMid),
    x: leftX,
    y: cursorY,
    width: columnWidth,
    labelFont: boldFont,
    valueFont: bodyFont,
  });
  const vehicleRightY = drawRows({
    page: page1,
    rows: vehicleRows.slice(vehicleMid),
    x: rightX,
    y: cursorY,
    width: columnWidth,
    labelFont: boldFont,
    valueFont: bodyFont,
  });

  cursorY = Math.min(vehicleLeftY, vehicleRightY) - 4;
  cursorY = drawSectionHeading(page1, "D. Vehicle Preparation", leftX, cursorY, boldFont);
  const prepText = SALE_HANDOVER_PREPARATION_LABELS
    .filter(([key]) => key !== "otherNotes" && record.preparation[key] === true)
    .map(([, label]) => label)
    .concat(record.preparation.otherNotes ? [`Other: ${record.preparation.otherNotes}`] : [])
    .join(", ");
  cursorY = drawTextBlock({
    page: page1,
    text: prepText || "Not provided",
    x: leftX,
    y: cursorY,
    maxWidth: CONTENT_WIDTH,
    font: bodyFont,
    size: 7.5,
    lineHeight: 9.5,
  }) - 7;

  cursorY = drawSectionHeading(page1, "E. Transaction Details", leftX, cursorY, boldFont);
  const transactionRows: Array<[string, string]> = [
    ["Purchase price", formatMoney(record.transaction.purchasePrice)],
    ["Deposit", formatMoney(record.transaction.deposit)],
    ["Balance", formatMoney(calculateSaleHandoverBalance(record.transaction))],
    ["Payment method", sanitizeText(record.transaction.paymentMethod)],
    ["Sale date", sanitizeText(record.transaction.saleDate)],
    ["Settlement date", sanitizeText(record.transaction.settlementDate)],
    ["Handover date", sanitizeText(record.transaction.handoverDate)],
    ["Handover time", sanitizeText(record.transaction.handoverTime)],
    ["Handover location", sanitizeText(record.transaction.handoverLocation)],
    ["Documents supplied", sanitizeText(record.transaction.documentsSupplied)],
    ["Payment arrangement", sanitizeText(record.transaction.paymentArrangement)],
    ["Additional terms", sanitizeText(record.transaction.additionalTerms)],
  ];
  const transactionMid = Math.ceil(transactionRows.length / 2);
  const transactionLeftY = drawRows({
    page: page1,
    rows: transactionRows.slice(0, transactionMid),
    x: leftX,
    y: cursorY,
    width: columnWidth,
    labelFont: boldFont,
    valueFont: bodyFont,
  });
  const transactionRightY = drawRows({
    page: page1,
    rows: transactionRows.slice(transactionMid),
    x: rightX,
    y: cursorY,
    width: columnWidth,
    labelFont: boldFont,
    valueFont: bodyFont,
  });

  cursorY = Math.min(transactionLeftY, transactionRightY) - 4;
  cursorY = drawSectionHeading(page1, "F. Signatures", leftX, cursorY, boldFont);
  const signatureFrameWidth = columnWidth;
  const signatureFrameHeight = 46;
  page1.drawRectangle({
    x: leftX,
    y: cursorY - signatureFrameHeight + 6,
    width: signatureFrameWidth,
    height: signatureFrameHeight,
    borderColor: rgb(0.86, 0.82, 0.76),
    borderWidth: 0.6,
    color: rgb(0.99, 0.98, 0.95),
  });
  page1.drawText("Seller signature", { x: leftX, y: cursorY + 9, size: 7, font: boldFont, color: rgb(0.45, 0.42, 0.36) });
  await embedSignature(pdfDoc, page1, record.sellerSignature?.signatureStoragePath || "", {
    x: leftX + 6,
    y: cursorY - signatureFrameHeight + 10,
    width: signatureFrameWidth - 12,
    height: signatureFrameHeight - 12,
  }, options?.resolveStorageBytes);
  page1.drawText(`Signed: ${formatDateTime(record.sellerSignature?.signedAt)}`, {
    x: leftX,
    y: cursorY - signatureFrameHeight - 9,
    size: 7,
    font: bodyFont,
    color: rgb(0.35, 0.32, 0.27),
  });

  page1.drawRectangle({
    x: rightX,
    y: cursorY - signatureFrameHeight + 6,
    width: signatureFrameWidth,
    height: signatureFrameHeight,
    borderColor: rgb(0.86, 0.82, 0.76),
    borderWidth: 0.6,
    color: rgb(0.99, 0.98, 0.95),
  });
  page1.drawText("Buyer signature", { x: rightX, y: cursorY + 9, size: 7, font: boldFont, color: rgb(0.45, 0.42, 0.36) });
  await embedSignature(pdfDoc, page1, record.buyerSignature?.signatureStoragePath || "", {
    x: rightX + 6,
    y: cursorY - signatureFrameHeight + 10,
    width: signatureFrameWidth - 12,
    height: signatureFrameHeight - 12,
  }, options?.resolveStorageBytes);
  page1.drawText(`Signed: ${formatDateTime(record.buyerSignature?.signedAt)}`, {
    x: rightX,
    y: cursorY - signatureFrameHeight - 9,
    size: 7,
    font: bodyFont,
    color: rgb(0.35, 0.32, 0.27),
  });
  page1.drawText(`Prepared by CarNest: ${getPreparedByDisplayName(record)}`, {
    x: leftX,
    y: 40,
    size: 7.2,
    font: bodyFont,
    color: rgb(0.35, 0.32, 0.27),
  });
  page1.drawText(`Prepared on: ${formatDateTime(record.createdAt || generatedAt)}`, {
    x: leftX,
    y: 28,
    size: 7.2,
    font: bodyFont,
    color: rgb(0.35, 0.32, 0.27),
  });
  page1.drawText("Prepared using CarNest administrative template", {
    x: leftX,
    y: 16,
    size: 7.2,
    font: boldFont,
    color: rgb(0.58, 0.34, 0.18),
  });

  page2.drawText("IMPORTANT INFORMATION AND AGREEMENT TERMS", {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 45,
    size: 13,
    font: boldFont,
    color: rgb(0.09, 0.08, 0.07),
  });
  page2.drawText(`${record.recordNumber} · ${getSaleHandoverVehicleTitle(record)} · Terms ${record.agreementTermsVersion}`, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 62,
    size: 7.5,
    font: bodyFont,
    color: rgb(0.45, 0.42, 0.36),
  });

  let termsY = PAGE_HEIGHT - 86;
  const termTitleSize = 6.5;
  const termBodySize = 5.35;
  for (const clause of SALE_HANDOVER_AGREEMENT_TERMS) {
    page2.drawText(clause.title, {
      x: PAGE_MARGIN,
      y: termsY,
      size: termTitleSize,
      font: boldFont,
      color: rgb(0.15, 0.12, 0.1),
    });
    termsY -= 8;
    for (const paragraph of clause.paragraphs) {
      termsY = drawTextBlock({
        page: page2,
        text: paragraph,
        x: PAGE_MARGIN,
        y: termsY,
        maxWidth: CONTENT_WIDTH,
        font: bodyFont,
        size: termBodySize,
        lineHeight: 6.5,
        color: rgb(0.2, 0.18, 0.15),
      }) - 1.5;
    }
    termsY -= 2.2;
  }

  page2.drawLine({
    start: { x: PAGE_MARGIN, y: 28 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: 28 },
    thickness: 0.5,
    color: rgb(0.86, 0.82, 0.76),
  });
  page2.drawText("This CarNest document is an administrative private-sale record. It is not a VicRoads registration-transfer form.", {
    x: PAGE_MARGIN,
    y: 16,
    size: 6.5,
    font: boldFont,
    color: rgb(0.58, 0.34, 0.18),
  });

  return await pdfDoc.save();
}
