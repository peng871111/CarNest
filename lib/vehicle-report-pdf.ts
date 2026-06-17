"use client";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { WarehouseIntakeRecord } from "@/types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const UNICODE_FONT_URL = "/fonts/arial-unicode.ttf";
const REPORT_TITLE = "CarNest Vehicle Report";

const RATING_GUIDE: Array<[string, string]> = [
  ["5.0", "Original paint and panels, no exterior damage, no noticeable interior wear, complete service history, complete keys, mechanically sound, still under warranty."],
  ["4.5", "Original paint and panels, minor stone chips / small wheel rash / very small marks only, light normal interior usage, complete service history, complete keys, mechanically sound."],
  ["4.0", "Some paint or cosmetic repair, wheel rash possible, light interior usage marks, no major wear, complete service history, complete keys, mechanically sound."],
  ["3.5", "Small dents or scratches, some panel repair, wheel rash, visible interior usage marks, service history may be incomplete, keys may be incomplete, mechanically sound."],
  ["3.0", "Visible scratches, dents, or unrepaired paint/panel issues, wheel rash, obvious interior usage marks, service history may be incomplete, keys may be incomplete, mechanically sound."],
  ["2.5", "Noticeable exterior paint/panel damage, unrepaired dents/scratches, wheel damage, interior wear, incomplete service history, incomplete keys, possible mechanical concerns."]
];

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

type EmbeddedPdfImage = Awaited<ReturnType<PDFDocument["embedJpg"]>>;

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
  page.drawText("CARNEST", {
    x: 185,
    y: PAGE_HEIGHT / 2,
    size: 58,
    color: rgb(0.95, 0.95, 0.95),
    rotate: degrees(-35)
  });

  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_MARGIN,
    y: 18,
    size: 9,
    color: rgb(0.42, 0.42, 0.42)
  });
}

function getContainedImageRect(
  image: EmbeddedPdfImage,
  frame: { x: number; y: number; width: number; height: number },
  padding = 0
) {
  const safeWidth = Math.max(1, frame.width - padding * 2);
  const safeHeight = Math.max(1, frame.height - padding * 2);
  const widthRatio = safeWidth / image.width;
  const heightRatio = safeHeight / image.height;
  const scale = Math.min(widthRatio, heightRatio);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  return {
    x: frame.x + (frame.width - drawWidth) / 2,
    y: frame.y + (frame.height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  };
}

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

export async function generateVehicleReportPdf(
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

  const drawHeading = (title: string, subtitle?: string) => {
    page.drawText(normalizePdfText(REPORT_TITLE, supportsUnicode), {
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

  const drawPhotoSection = async (
    title: string,
    photos: WarehouseIntakeRecord["photos"],
    includeMeta = false
  ) => {
    if (!photos.length) return;

    drawSectionTitle(title);
    const photoGap = 16;
    const photoWidth = (CONTENT_WIDTH - photoGap) / 2;
    const photoHeight = photoWidth * 0.75;
    const metaHeight = includeMeta ? 44 : 18;
    const photoCardHeight = photoHeight + metaHeight + 22;
    let column = 0;

    for (const photo of photos) {
      ensureSpace(photoCardHeight + 12);
      const x = column === 0 ? PAGE_MARGIN : PAGE_MARGIN + photoWidth + photoGap;
      const frameY = cursorY - photoHeight - 12;
      const lowerPath = photo.storagePath.toLowerCase();

      page.drawRectangle({
        x,
        y: frameY,
        width: photoWidth,
        height: photoHeight,
        color: rgb(0.985, 0.985, 0.985),
        borderColor: rgb(0.86, 0.86, 0.86),
        borderWidth: 1
      });

      try {
        const bytes = options?.resolveStorageBytes
          ? await options.resolveStorageBytes(photo.storagePath)
          : (() => {
              throw new Error("Storage byte resolver unavailable.");
            })();
        const embedded = lowerPath.includes(".png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const imageRect = getContainedImageRect(embedded, {
          x: x + 6,
          y: frameY + 6,
          width: photoWidth - 12,
          height: photoHeight - 12
        });
        page.drawImage(embedded, imageRect);
      } catch {
        page.drawText(normalizePdfText("Photo unavailable in PDF render", supportsUnicode), {
          x: x + 16,
          y: frameY + photoHeight / 2,
          size: 10,
          font: regular,
          color: rgb(0.45, 0.45, 0.45)
        });
      }

      page.drawText(normalizePdfText(photo.label, supportsUnicode), {
        x,
        y: frameY - 16,
        size: 10,
        font: bold,
        color: rgb(0.12, 0.12, 0.12)
      });

      if (includeMeta) {
        const categoryLabel = photo.category.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
        const noteValue = photo.note || record.vehicleReport.damageConditionNotes || "";
        let metaY = frameY - 29;

        if (categoryLabel) {
          page.drawText(normalizePdfText(categoryLabel, supportsUnicode), {
            x,
            y: metaY,
            size: 8.5,
            font: regular,
            color: rgb(0.42, 0.42, 0.42),
            maxWidth: photoWidth
          });
          metaY -= 11;
        }

        if (noteValue) {
          const noteLines = wrapText(noteValue, 42).slice(0, 2);
          noteLines.forEach((line) => {
            page.drawText(normalizePdfText(line, supportsUnicode), {
              x,
              y: metaY,
              size: 8.5,
              font: regular,
              color: rgb(0.18, 0.18, 0.18),
              maxWidth: photoWidth
            });
            metaY -= 10;
          });
        }
      }

      if (column === 1) {
        cursorY = frameY - metaHeight - 12;
        column = 0;
      } else {
        column = 1;
      }
    }

    if (column === 1) {
      cursorY -= photoCardHeight + 6;
    }
  };

  const damagePhotos = record.photos.filter((photo) => photo.category === "damagePhotos");
  const documentationPhotos = record.photos.filter((photo) => photo.category !== "damagePhotos").slice(0, 8);

  drawHeading(
    record.vehicleTitle || "Vehicle condition summary",
    "Buyer-facing condition summary generated from the CarNest storage contract workflow. Informational only and not a warranty, valuation, or statement of mechanical certification."
  );

  drawTwoColumnFields([
    ["Listing reference", sanitizeText(record.vehicleReference, record.id, supportsUnicode)],
    ["CarNest condition rating", sanitizeText(record.vehicleReport.conditionRating, "Pending", supportsUnicode)],
    ["Vehicle", sanitizeText(record.vehicleTitle, "Not provided", supportsUnicode)],
    ["Generated", sanitizeText(record.vehicleReportGeneratedAt || record.updatedAt, "Pending", supportsUnicode)]
  ]);

  drawSectionTitle("Vehicle information");
  drawTwoColumnFields([
    ["Year", sanitizeText(record.vehicleDetails.year, "Not provided", supportsUnicode)],
    ["Make", sanitizeText(record.vehicleDetails.make, "Not provided", supportsUnicode)],
    ["Model", sanitizeText(record.vehicleDetails.model, "Not provided", supportsUnicode)],
    ["Variant", sanitizeText(record.vehicleDetails.variant, "Not provided", supportsUnicode)],
    ["Registration plate", sanitizeText(record.vehicleDetails.registrationPlate, "Not provided", supportsUnicode)],
    ["VIN", sanitizeText(record.vehicleDetails.vin, "Not provided", supportsUnicode)],
    ["Odometer", sanitizeText(record.vehicleDetails.odometer, "Not provided", supportsUnicode)],
    ["Fuel type", sanitizeText(record.vehicleDetails.fuelType, "Not provided", supportsUnicode)],
    ["Transmission", sanitizeText(record.vehicleDetails.transmission, "Not provided", supportsUnicode)],
    ["Drivetrain", sanitizeText(record.vehicleDetails.drivetrain, "Not provided", supportsUnicode)],
    ["Number of keys", sanitizeText(record.vehicleDetails.numberOfKeys, "Not provided", supportsUnicode)],
    ["Service history", sanitizeText(record.vehicleDetails.serviceHistory, "Not provided", supportsUnicode)],
    ["Warranty status", sanitizeText(record.vehicleDetails.warrantyStatus, "Not provided", supportsUnicode)],
    ["Number of owners", sanitizeText(record.vehicleDetails.numberOfOwners, "Not provided", supportsUnicode)]
  ]);

  drawSectionTitle("Condition declarations");
  drawTwoColumnFields([
    ["Accident history", sanitizeText(record.vehicleDetails.accidentHistory || record.declarations.writtenOffHistory, "Not provided", supportsUnicode)],
    ["Finance owing", sanitizeText(record.declarations.financeOwing, "Not provided", supportsUnicode)],
    ["Odometer issue", sanitizeText(record.declarations.odometerDiscrepancyKnown, "Not provided", supportsUnicode)],
    ["RWC cooperation", sanitizeText(record.vehicleReport.rwcCooperation.replace(/_/g, " "), "Not provided", supportsUnicode)]
  ]);

  drawSectionTitle("Vehicle condition");
  drawField("Exterior / body condition", sanitizeText(record.vehicleReport.exteriorCondition, "Not provided", supportsUnicode));
  drawField("Panel repair / repaint notes", sanitizeText(record.vehicleReport.panelRepairNotes, "Not provided", supportsUnicode));
  drawField("Interior condition", sanitizeText(record.vehicleReport.interiorCondition, "Not provided", supportsUnicode));
  drawField("Wheel condition", sanitizeText(record.vehicleReport.wheelCondition, "Not provided", supportsUnicode));
  drawField("Mechanical condition", sanitizeText(record.vehicleReport.mechanicalCondition, "Not provided", supportsUnicode));
  drawField("Service record condition", sanitizeText(record.vehicleReport.serviceRecordCondition, "Not provided", supportsUnicode));
  drawField("Key condition", sanitizeText(record.vehicleReport.keyCondition, "Not provided", supportsUnicode));
  drawField("Damage / condition notes", sanitizeText(record.vehicleReport.damageConditionNotes || record.conditionReport.exterior.visibleDefects?.notes, "No additional damage notes recorded", supportsUnicode));

  if (damagePhotos.length) {
    await drawPhotoSection("Damage / condition notes", damagePhotos, true);
  }

  if (documentationPhotos.length) {
    await drawPhotoSection("Documentation photos", documentationPhotos, false);
  }

  drawSectionTitle("Buyer reference disclaimer");
  drawField(
    "Important",
    "Information in this report is provided free of charge for buyer reference only. CarNest recommends that any serious buyer arrange an independent inspection with their own qualified mechanic before purchase. This report is not a mechanical warranty, valuation, roadworthy certificate, or legal representation. CarNest accepts no legal liability for decisions made based on this report."
  );

  drawSectionTitle("CarNest condition rating guide");
  RATING_GUIDE.forEach(([rating, description]) => {
    drawField(`Rating ${rating}`, description);
  });
  drawField(
    "Listing acceptance note",
    "CarNest does not accept vehicles rated 2.5 or below for public platform listing."
  );

  const pages = pdfDoc.getPages();
  pages.forEach((existingPage, index) => drawPageChrome(existingPage, index + 1, pages.length));

  return await pdfDoc.save();
}
