"use client";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from "pdf-lib";
import { CARNEST_CONCIERGE_AGREEMENT_COPY, WAREHOUSE_CONDITION_SECTIONS } from "@/lib/warehouse-intake-config";
import { WarehouseIntakeRecord } from "@/types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function sanitizeText(value?: string | null, fallback = "Not provided") {
  const normalized = (value ?? "").trim();
  return normalized || fallback;
}

function wrapText(text: string, maxChars = 92) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
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

async function fetchImageBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
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

export async function generateWarehouseIntakePdf(record: WarehouseIntakeRecord) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let { page, cursorY } = createPage(pdfDoc);

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY - requiredHeight < PAGE_MARGIN) {
      const next = createPage(pdfDoc);
      page = next.page;
      cursorY = next.cursorY;
    }
  };

  const drawHeading = (eyebrow: string, title: string, subtitle?: string) => {
    page.drawText(eyebrow, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 10,
      font: bold,
      color: rgb(0.63, 0.47, 0.24)
    });
    cursorY -= 18;
    page.drawText(title, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 22,
      font: bold,
      color: rgb(0.08, 0.08, 0.08)
    });
    cursorY -= 26;
    if (subtitle) {
      for (const line of wrapText(subtitle, 88)) {
        page.drawText(line, {
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
    page.drawText(label, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 9,
      font: bold,
      color: rgb(0.55, 0.55, 0.55)
    });
    cursorY -= 13;
    for (const line of wrapText(value, 94)) {
      page.drawText(line, {
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
        page.drawText(label, {
          x,
          y: localY,
          size: 9,
          font: bold,
          color: rgb(0.55, 0.55, 0.55)
        });
        const lines = wrapText(value, 38);
        let lineY = localY - 13;
        lines.forEach((line) => {
          page.drawText(line, {
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
    page.drawText(title, {
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
    ["Reference", sanitizeText(record.vehicleReference, record.id)],
    ["Status", record.status.replace(/_/g, " ")],
    ["Owner", sanitizeText(record.ownerDetails.fullName)],
    ["Admin staff", sanitizeText(record.signature.adminStaffName || record.adminStaffName)],
    ["Vehicle", sanitizeText(record.vehicleTitle)],
    ["Signed at", sanitizeText(record.signature.signedAt, "Pending")]
  ]);

  drawSectionTitle("Owner details");
  drawTwoColumnFields([
    ["Full name", sanitizeText(record.ownerDetails.fullName)],
    ["Email", sanitizeText(record.ownerDetails.email)],
    ["Phone", sanitizeText(record.ownerDetails.phone)],
    ["Driver licence number", sanitizeText(record.ownerDetails.driverLicenceNumber)],
    ["Address", sanitizeText(record.ownerDetails.address)],
    ["Legal owner confirmed", record.ownerDetails.isLegalOwnerConfirmed ? "Yes" : "No"]
  ]);

  drawSectionTitle("Vehicle details");
  drawTwoColumnFields([
    ["Make", sanitizeText(record.vehicleDetails.make)],
    ["Model", sanitizeText(record.vehicleDetails.model)],
    ["Year", sanitizeText(record.vehicleDetails.year)],
    ["Registration plate", sanitizeText(record.vehicleDetails.registrationPlate)],
    ["VIN", sanitizeText(record.vehicleDetails.vin)],
    ["Colour", sanitizeText(record.vehicleDetails.colour)],
    ["Odometer", sanitizeText(record.vehicleDetails.odometer)],
    ["Registration expiry", sanitizeText(record.vehicleDetails.registrationExpiry)],
    ["Number of keys", sanitizeText(record.vehicleDetails.numberOfKeys)],
    ["Service history", sanitizeText(record.vehicleDetails.serviceHistory)],
    ["Accident history", sanitizeText(record.vehicleDetails.accidentHistory)]
  ]);
  drawField("Vehicle notes", sanitizeText(record.vehicleDetails.notes, "No additional notes"));

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
    ["Finance company", sanitizeText(record.declarations.financeCompanyName, "Not provided")]
  ]);
  drawField(
    "Owner declaration",
    record.declarations.isInformationAccurate
      ? "Owner declared that all information provided is true and correct to the best of their knowledge."
      : "Owner declaration not confirmed."
  );

  drawSectionTitle("Condition checklist");
  (Object.entries(WAREHOUSE_CONDITION_SECTIONS) as unknown as Array<[keyof typeof WAREHOUSE_CONDITION_SECTIONS, ReadonlyArray<{ key: string; label: string }>]>).forEach(
    ([sectionKey, items]) => {
      ensureSpace(24);
      page.drawText(sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1), {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 12,
        font: bold,
        color: rgb(0.18, 0.18, 0.18)
      });
      cursorY -= 16;

      items.forEach((item) => {
        const entry = record.conditionReport[sectionKey][item.key];
        drawField(item.label, `${entry.condition.replace(/_/g, " ")}${entry.notes ? ` — ${entry.notes}` : ""}`);
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
      record.agreement.electronicSigningConsented ? "Electronic signing consented" : "Electronic signing consent pending"
    ].join(" · ")
  );

  drawSectionTitle("Signature");
  drawTwoColumnFields([
    ["Signer name", sanitizeText(record.signature.signerName)],
    ["Admin staff", sanitizeText(record.signature.adminStaffName || record.adminStaffName)],
    ["Signed at", sanitizeText(record.signature.signedAt, "Pending")],
    ["PDF generated", sanitizeText(record.pdfGeneratedAt, "Pending")]
  ]);

  if (record.signature.signatureImageUrl) {
    try {
      const bytes = await fetchImageBytes(record.signature.signatureImageUrl);
      const signatureImage = record.signature.signatureImageUrl.toLowerCase().includes(".png")
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);
      ensureSpace(90);
      page.drawText("Customer signature", {
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
    drawSectionTitle("Condition photos");
    const photoWidth = 240;
    const photoHeight = 150;
    let column = 0;

    for (const photo of record.photos.slice(0, 12)) {
      ensureSpace(photoHeight + 42);
      const x = column === 0 ? PAGE_MARGIN : PAGE_MARGIN + photoWidth + 16;
      const y = cursorY - photoHeight;

      try {
        const bytes = await fetchImageBytes(photo.url);
        const lowerUrl = photo.url.toLowerCase();
        const embedded = lowerUrl.includes(".png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
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
        page.drawText("Photo unavailable in PDF render", {
          x: x + 16,
          y: y + photoHeight / 2,
          size: 10,
          font: regular,
          color: rgb(0.45, 0.45, 0.45)
        });
      }

      page.drawText(photo.label, {
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
