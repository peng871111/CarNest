"use client";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CARNEST_CONCIERGE_AGREEMENT_COPY, WAREHOUSE_CONDITION_SECTIONS } from "@/lib/warehouse-intake-config";
import { WarehouseIntakeRecord } from "@/types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const UNICODE_FONT_URL = "/fonts/arial-unicode.ttf";

let unicodeFontBytesPromise: Promise<Uint8Array> | null = null;

const PDF_FALLBACK_REPLACEMENTS: Array<[RegExp, string]> = [
  [/，/g, ","],
  [/。/g, "."],
  [/：/g, ":"],
  [/；/g, ";"],
  [/（/g, "("],
  [/）/g, ")"],
  [/“|”/g, "\""],
  [/‘|’/g, "'"]
];

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

function normalizePdfText(value: string, supportsUnicode: boolean) {
  const normalized = value.normalize("NFKC");
  if (supportsUnicode) {
    return normalized;
  }

  return PDF_FALLBACK_REPLACEMENTS
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), normalized)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function sanitizeText(value?: string | null, fallback = "Not provided", supportsUnicode = true) {
  const normalized = (value ?? "").trim();
  return normalizePdfText(normalized || fallback, supportsUnicode);
}

function wrapText(text: string, maxChars = 92) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function createPage(pdfDoc: PDFDocument) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  return { page, cursorY };
}

function drawPageChrome(page: PDFPage, pageNumber: number, totalPages: number) {
  page.drawText("CONFIDENTIAL", {
    x: 150,
    y: PAGE_HEIGHT / 2,
    size: 52,
    color: rgb(0.93, 0.93, 0.93),
    rotate: degrees(-35)
  });

  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_MARGIN,
    y: 18,
    size: 9,
    color: rgb(0.42, 0.42, 0.42)
  });
}

export async function generateWarehouseIntakePdf(
  record: WarehouseIntakeRecord,
  options?: {
    resolveStorageBytes?: (storagePath: string) => Promise<Uint8Array>;
  }
) {
  const pdfDoc = await PDFDocument.create();
  let regular: PDFFont;
  let bold: PDFFont;
  let supportsUnicode = true;

  try {
    pdfDoc.registerFontkit(fontkit);
    const unicodeFontBytes = await loadUnicodeFontBytes();
    regular = await pdfDoc.embedFont(unicodeFontBytes, { subset: true });
    bold = regular;
  } catch {
    supportsUnicode = false;
    regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  let { page, cursorY } = createPage(pdfDoc);

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY - requiredHeight < PAGE_MARGIN) {
      const next = createPage(pdfDoc);
      page = next.page;
      cursorY = next.cursorY;
    }
  };

  const drawHeading = (eyebrow: string, title: string, subtitle?: string) => {
    page.drawText(normalizePdfText(eyebrow, supportsUnicode), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 10,
      font: bold,
      color: rgb(0.63, 0.47, 0.24)
    });
    cursorY -= 18;
    page.drawText(normalizePdfText(title, supportsUnicode), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 22,
      font: bold,
      color: rgb(0.08, 0.08, 0.08)
    });
    cursorY -= 26;
    if (subtitle) {
      for (const line of wrapText(subtitle, 88)) {
        page.drawText(normalizePdfText(line, supportsUnicode), {
          x: PAGE_MARGIN,
          y: cursorY,
          size: 10.5,
          font: regular,
          color: rgb(0.34, 0.34, 0.34)
        });
        cursorY -= 14;
      }
      cursorY -= 8;
    }
  };

  const drawField = (label: string, value: string) => {
    ensureSpace(26);
    page.drawText(normalizePdfText(label, supportsUnicode), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 9,
      font: bold,
      color: rgb(0.55, 0.55, 0.55)
    });
    cursorY -= 13;
    for (const line of wrapText(value, 94)) {
      page.drawText(normalizePdfText(line, supportsUnicode), {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 11,
        font: regular,
        color: rgb(0.12, 0.12, 0.12)
      });
      cursorY -= 14;
    }
    cursorY -= 4;
  };

  const drawTwoColumnFields = (fields: Array<[string, string]>) => {
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 8;
    const columnWidth = CONTENT_WIDTH / 2 - 8;
    ensureSpace(Math.ceil(fields.length / 2) * 34 + 10);

    let localY = cursorY;
    for (let index = 0; index < fields.length; index += 2) {
      const entries = [fields[index], fields[index + 1]].filter(Boolean) as Array<[string, string]>;
      let rowHeight = 0;

      entries.forEach(([label, value], itemIndex) => {
        const x = itemIndex === 0 ? leftX : rightX;
        page.drawText(normalizePdfText(label, supportsUnicode), {
          x,
          y: localY,
          size: 9,
          font: bold,
          color: rgb(0.55, 0.55, 0.55)
        });
        const lines = wrapText(value, 38);
        let lineY = localY - 13;
        lines.forEach((line) => {
          page.drawText(normalizePdfText(line, supportsUnicode), {
            x,
            y: lineY,
            size: 11,
            font: regular,
            color: rgb(0.12, 0.12, 0.12),
            maxWidth: columnWidth
          });
          lineY -= 14;
        });
        rowHeight = Math.max(rowHeight, 13 + lines.length * 14 + 8);
      });

      localY -= rowHeight;
    }

    cursorY = localY - 8;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(26);
    page.drawText(normalizePdfText(title, supportsUnicode), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 14,
      font: bold,
      color: rgb(0.08, 0.08, 0.08)
    });
    cursorY -= 20;
  };

  drawHeading(
    "CarNest Warehouse Intake",
    record.vehicleTitle || "Warehouse Intake Record",
    "Storage, presentation, inspection coordination, listing support, and operational assistance. Vehicle transactions remain between buyer and seller."
  );

  drawTwoColumnFields([
    ["Reference", sanitizeText(record.vehicleReference, record.id, supportsUnicode)],
    ["Status", normalizePdfText(record.status.replace(/_/g, " "), supportsUnicode)],
    ["Owner", sanitizeText(record.ownerDetails.fullName, "Not provided", supportsUnicode)],
    ["Admin staff", sanitizeText(record.signature.adminStaffName || record.adminStaffName, "Not provided", supportsUnicode)],
    ["Vehicle", sanitizeText(record.vehicleTitle, "Not provided", supportsUnicode)],
    ["Signed at", sanitizeText(record.signature.signedAt, "Pending", supportsUnicode)]
  ]);

  drawSectionTitle("Owner details");
  drawTwoColumnFields([
    ["Full name", sanitizeText(record.ownerDetails.fullName, "Not provided", supportsUnicode)],
    ["Email", sanitizeText(record.ownerDetails.email, "Not provided", supportsUnicode)],
    ["Phone", sanitizeText(record.ownerDetails.phone, "Not provided", supportsUnicode)],
    ["Preferred contact", sanitizeText(record.ownerDetails.preferredContactMethod.replace(/_/g, " "), "Not provided", supportsUnicode)],
    ["Address", sanitizeText(record.ownerDetails.address, "Not provided", supportsUnicode)],
    ["ID type", sanitizeText(record.ownerDetails.identificationDocumentType.replace(/_/g, " "), "Not provided", supportsUnicode)],
    ["ID number", sanitizeText(record.ownerDetails.identificationDocumentNumber, "Not provided", supportsUnicode)],
    ["Legal owner confirmed", record.ownerDetails.isLegalOwnerConfirmed ? "Yes" : "No"]
  ]);
  drawField("Customer verification notes", sanitizeText(record.ownerDetails.customerVerificationNotes, "No additional customer verification notes", supportsUnicode));

  drawSectionTitle("Vehicle details");
  drawTwoColumnFields([
    ["Make", sanitizeText(record.vehicleDetails.make, "Not provided", supportsUnicode)],
    ["Model", sanitizeText(record.vehicleDetails.model, "Not provided", supportsUnicode)],
    ["Variant", sanitizeText(record.vehicleDetails.variant, "Not provided", supportsUnicode)],
    ["Year", sanitizeText(record.vehicleDetails.year, "Not provided", supportsUnicode)],
    ["Registration plate", sanitizeText(record.vehicleDetails.registrationPlate, "Not provided", supportsUnicode)],
    ["VIN", sanitizeText(record.vehicleDetails.vin, "Not provided", supportsUnicode)],
    ["Colour", sanitizeText(record.vehicleDetails.colour, "Not provided", supportsUnicode)],
    ["Odometer", sanitizeText(record.vehicleDetails.odometer, "Not provided", supportsUnicode)],
    ["Registration expiry", sanitizeText(record.vehicleDetails.registrationExpiry, "Not provided", supportsUnicode)],
    ["Number of keys", sanitizeText(record.vehicleDetails.numberOfKeys, "Not provided", supportsUnicode)],
    ["Service history", sanitizeText(record.vehicleDetails.serviceHistory, "Not provided", supportsUnicode)],
    ["Accident history", sanitizeText(record.vehicleDetails.accidentHistory, "Not provided", supportsUnicode)]
  ]);
  drawField("Vehicle notes", sanitizeText(record.vehicleDetails.notes, "No additional notes", supportsUnicode));
  drawField("Ownership proof", sanitizeText(record.vehicleDetails.ownershipProof?.name, "No ownership proof attached to this intake event", supportsUnicode));

  drawSectionTitle("Vehicle history declarations");
  drawTwoColumnFields([
    ["Written off history", record.declarations.writtenOffHistory],
    ["Repairable write-off history", record.declarations.repairableWriteOffHistory],
    ["Stolen / recovered history", record.declarations.stolenRecoveredHistory],
    ["Hail damage history", record.declarations.hailDamageHistory],
    ["Flood damage history", record.declarations.floodDamageHistory],
    ["Engine replacement history", record.declarations.engineReplacementHistory],
    ["Odometer discrepancy known", record.declarations.odometerDiscrepancyKnown],
    ["Finance owing", record.declarations.financeOwing],
    ["Finance company", sanitizeText(record.declarations.financeCompanyName, "Not provided", supportsUnicode)]
  ]);
  drawField(
    "Owner declaration",
    record.declarations.isInformationAccurate
      ? "Owner declared that all information provided is true and correct to the best of their knowledge."
      : "Owner declaration not confirmed."
  );

  drawSectionTitle("Documentation summary");
  (Object.entries(WAREHOUSE_CONDITION_SECTIONS) as unknown as Array<[keyof typeof WAREHOUSE_CONDITION_SECTIONS, ReadonlyArray<{ key: string; label: string }>]>).forEach(
    ([sectionKey, items]) => {
      ensureSpace(24);
      page.drawText(normalizePdfText(sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1), supportsUnicode), {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 12,
        font: bold,
        color: rgb(0.18, 0.18, 0.18)
      });
      cursorY -= 16;

      items.forEach((item) => {
        const entry = record.conditionReport[sectionKey][item.key];
        drawField(
          item.label,
          normalizePdfText(
            `${entry.documented || entry.condition === "documented" ? "Documentation captured" : "Not checked"}${entry.notes ? ` — ${entry.notes}` : ""}`,
            supportsUnicode
          )
        );
      });
    }
  );

  drawSectionTitle("Agreement");
  CARNEST_CONCIERGE_AGREEMENT_COPY.forEach((line) => drawField("Agreement term", line));
  drawField(
    "Acknowledgements",
    [
      record.agreement.informationAccurateConfirmed ? "Information confirmed accurate" : "Information accuracy not confirmed",
      record.agreement.storageAssistanceAuthorized ? "Storage and operational assistance authorised" : "Storage authorisation pending",
      record.agreement.conditionDocumentationConfirmed ? "Condition documentation acknowledged" : "Condition documentation acknowledgement pending",
      record.agreement.insuranceMaintainedConfirmed ? "Insurance responsibility acknowledged" : "Insurance acknowledgement pending",
      record.agreement.directSaleResponsibilityConfirmed ? "Direct sale responsibility acknowledged" : "Direct sale responsibility acknowledgement pending",
      record.agreement.electronicSigningConsented ? "Electronic signing consented" : "Electronic signing consent pending"
    ].join(" · ")
  );

  drawSectionTitle("Signature");
  drawTwoColumnFields([
    ["Signer name", sanitizeText(record.signature.signerName, "Not provided", supportsUnicode)],
    ["Admin staff", sanitizeText(record.signature.adminStaffName || record.adminStaffName, "Not provided", supportsUnicode)],
    ["Signed at", sanitizeText(record.signature.signedAt, "Pending", supportsUnicode)],
    ["PDF generated", sanitizeText(record.pdfGeneratedAt, "Pending", supportsUnicode)]
  ]);

  if (record.signature.signatureStoragePath) {
    try {
      const bytes = options?.resolveStorageBytes
        ? await options.resolveStorageBytes(record.signature.signatureStoragePath)
        : (() => {
            throw new Error("Storage byte resolver unavailable.");
          })();
      const signatureImage = record.signature.signatureStoragePath.toLowerCase().includes(".png")
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);
      ensureSpace(90);
      page.drawText(normalizePdfText("Customer signature", supportsUnicode), {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 9,
        font: bold,
        color: rgb(0.55, 0.55, 0.55)
      });
      cursorY -= 70;
      page.drawImage(signatureImage, {
        x: PAGE_MARGIN,
        y: cursorY,
        width: 180,
        height: 60
      });
      cursorY -= 18;
    } catch {
      drawField("Customer signature", "Signature captured and stored digitally.");
    }
  }

  if (record.photos.length) {
    drawSectionTitle("Vehicle documentation photos");
    const photoWidth = 240;
    const photoHeight = 150;
    let column = 0;

    for (const photo of record.photos.slice(0, 12)) {
      ensureSpace(photoHeight + 42);
      const x = column === 0 ? PAGE_MARGIN : PAGE_MARGIN + photoWidth + 16;
      const y = cursorY - photoHeight;

      try {
        const bytes = options?.resolveStorageBytes
          ? await options.resolveStorageBytes(photo.storagePath)
          : (() => {
              throw new Error("Storage byte resolver unavailable.");
            })();
        const lowerPath = photo.storagePath.toLowerCase();
        const embedded = lowerPath.includes(".png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        page.drawImage(embedded, {
          x,
          y,
          width: photoWidth,
          height: photoHeight
        });
      } catch {
        page.drawRectangle({
          x,
          y,
          width: photoWidth,
          height: photoHeight,
          borderColor: rgb(0.82, 0.82, 0.82),
          borderWidth: 1
        });
        page.drawText(normalizePdfText("Photo unavailable in PDF render", supportsUnicode), {
          x: x + 16,
          y: y + photoHeight / 2,
          size: 10,
          font: regular,
          color: rgb(0.45, 0.45, 0.45)
        });
      }

      page.drawText(normalizePdfText(photo.label, supportsUnicode), {
        x,
        y: y - 14,
        size: 10,
        font: bold,
        color: rgb(0.12, 0.12, 0.12)
      });

      if (column === 1) {
        cursorY = y - 28;
        column = 0;
      } else {
        column = 1;
      }
    }

    if (column === 1) {
      cursorY -= photoHeight + 28;
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((existingPage, index) => drawPageChrome(existingPage, index + 1, pages.length));

  return await pdfDoc.save();
}
