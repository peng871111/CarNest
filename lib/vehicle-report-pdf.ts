"use client";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  BUYER_BODY_MAP_PANEL_AREAS,
  BUYER_BODY_MAP_REFERENCE_SVG_PATH,
  BUYER_BODY_MAP_VIEWBOX,
} from "@/lib/buyer-body-map-artwork";
import {
  formatVehicleBodyDamageGridCellLabel,
  getVehicleBodyDamageGridCell,
  VEHICLE_BODY_DAMAGE_GRID_CELLS,
} from "@/lib/vehicle-body-damage-grid";
import { VEHICLE_BODY_PANEL_LABELS, VEHICLE_DAMAGE_TYPE_LABELS } from "@/lib/vehicle-condition-config";
import {
  type VehicleBodyPanelCondition,
  type WarehouseIntakePhotoRecord,
  type WarehouseIntakeRecord,
  type WarehouseVehicleDamageRecord
} from "@/types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const UNICODE_FONT_URL = "/fonts/arial-unicode.ttf";
const REPORT_TITLE = "CarNest Vehicle Condition Summary";

const BRAND_DARK = rgb(0.08, 0.08, 0.08);
const BRAND_GOLD = rgb(0.79, 0.63, 0.36);
const BRAND_GOLD_SOFT = rgb(0.94, 0.9, 0.82);
const BRAND_LINE = rgb(0.84, 0.79, 0.72);
const BRAND_SHELL = rgb(0.978, 0.972, 0.962);
const TEXT_PRIMARY = rgb(0.12, 0.12, 0.12);
const TEXT_MUTED = rgb(0.4, 0.4, 0.4);
const TEXT_LIGHT = rgb(0.96, 0.96, 0.96);
const BORDER_LIGHT = rgb(0.88, 0.85, 0.8);

const DISCLAIMER_LINES = [
  "CarNest Vehicle Condition Summary is provided as a complimentary buyer reference document only.",
  "This report reflects the information recorded at the time of inspection and is not a mechanical certification or warranty.",
  "CarNest strongly recommends every buyer obtain their own independent pre-purchase inspection before committing to a vehicle purchase."
] as const;

const REPORT_IMAGE_MAX_WIDTH = 1600;
const REPORT_IMAGE_MIN_DIMENSION = 900;
const REPORT_IMAGE_MAX_BYTES = 300 * 1024;
const REPORT_IMAGE_START_QUALITY = 0.74;
const REPORT_IMAGE_MIN_QUALITY = 0.56;
const REPORT_IMAGE_SCALE_STEP = 0.86;
const REPORT_IMAGE_QUALITY_STEP = 0.05;

const INSPECTION_LEGEND: Array<[string, string]> = [
  ["A1", "Scratch (Small)"],
  ["A2", "Scratch (Medium)"],
  ["A3", "Scratch (Large)"],
  ["U1", "Dent (Small)"],
  ["U2", "Dent (Medium)"],
  ["U3", "Dent (Large)"],
  ["R", "Repaired Panel"],
  ["W", "Paint Wave / Paint Defect"],
  ["S", "Rust"],
  ["X", "Needs Replacement"],
  ["C", "Corrosion"],
  ["Y", "Crack"],
  ["O", "Other"]
];

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

const DAMAGE_MARKER_MAP: Record<VehicleBodyPanelCondition, { code: string | null; fill: [number, number, number]; stroke: [number, number, number] }> = {
  original: { code: null, fill: [0.99, 0.99, 0.985], stroke: [0.84, 0.79, 0.72] },
  scratch: { code: "A1", fill: [0.988, 0.945, 0.82], stroke: [0.84, 0.63, 0.19] },
  dent: { code: "U1", fill: [0.992, 0.91, 0.84], stroke: [0.81, 0.43, 0.14] },
  repaint: { code: "W", fill: [0.9, 0.95, 0.985], stroke: [0.33, 0.62, 0.8] },
  repaired_damage: { code: "R", fill: [0.94, 0.91, 0.985], stroke: [0.54, 0.43, 0.84] }
};

type GridLinkedDamageRecord = WarehouseVehicleDamageRecord & {
  linkedPhotos: WarehouseIntakePhotoRecord[];
};

type GridLinkedDamageGroup = {
  gridCellId: string;
  locationLabel: string;
  panelLabel: string;
  cell: ReturnType<typeof getVehicleBodyDamageGridCell>;
  records: GridLinkedDamageRecord[];
};

type EmbeddedPdfImage =
  | Awaited<ReturnType<PDFDocument["embedJpg"]>>
  | Awaited<ReturnType<PDFDocument["embedPng"]>>;

let unicodeFontBytesPromise: Promise<Uint8Array> | null = null;
let bodyMapReferencePngBytesPromise: Promise<Uint8Array | null> | null = null;

function loadImageFromObjectUrl(objectUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode report image."));
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to encode report image."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

async function optimizePdfImageBytes(bytes: Uint8Array) {
  if (typeof window === "undefined") {
    return { bytes, mimeType: "image/jpeg" as const };
  }

  let objectUrl = "";
  let image: HTMLImageElement | null = null;
  let canvas: HTMLCanvasElement | null = null;

  try {
    const sourceBytes = Uint8Array.from(bytes);
    objectUrl = URL.createObjectURL(new Blob([sourceBytes]));
    image = await loadImageFromObjectUrl(objectUrl);

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestSide > REPORT_IMAGE_MAX_WIDTH ? REPORT_IMAGE_MAX_WIDTH / longestSide : 1;
    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));

    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to initialize report image canvas.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    let quality = REPORT_IMAGE_START_QUALITY;
    let blob = await canvasToBlob(canvas, "image/jpeg", quality);

    while (blob.size > REPORT_IMAGE_MAX_BYTES) {
      if (quality > REPORT_IMAGE_MIN_QUALITY) {
        quality = Math.max(REPORT_IMAGE_MIN_QUALITY, Number((quality - REPORT_IMAGE_QUALITY_STEP).toFixed(2)));
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
        continue;
      }

      const nextWidth = Math.round(canvas.width * REPORT_IMAGE_SCALE_STEP);
      const nextHeight = Math.round(canvas.height * REPORT_IMAGE_SCALE_STEP);
      if (Math.max(nextWidth, nextHeight) < REPORT_IMAGE_MIN_DIMENSION) {
        break;
      }

      const resizedCanvas = document.createElement("canvas");
      resizedCanvas.width = nextWidth;
      resizedCanvas.height = nextHeight;
      const resizedContext = resizedCanvas.getContext("2d");
      if (!resizedContext) {
        throw new Error("Unable to resize report image.");
      }

      resizedContext.imageSmoothingEnabled = true;
      resizedContext.imageSmoothingQuality = "high";
      resizedContext.drawImage(canvas, 0, 0, nextWidth, nextHeight);

      canvas.width = nextWidth;
      canvas.height = nextHeight;
      context.drawImage(resizedCanvas, 0, 0, nextWidth, nextHeight);
      quality = REPORT_IMAGE_START_QUALITY;
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }

    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: "image/jpeg" as const
    };
  } catch {
    return { bytes, mimeType: "image/jpeg" as const };
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (image) {
      image.src = "";
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function loadBodyMapReferencePngBytes() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!bodyMapReferencePngBytesPromise) {
    bodyMapReferencePngBytesPromise = fetch(BUYER_BODY_MAP_REFERENCE_SVG_PATH)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load body map reference SVG.");
        }

        const svgText = await response.text();
        const objectUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));

        try {
          const image = await loadImageFromObjectUrl(objectUrl);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, image.naturalWidth || BUYER_BODY_MAP_VIEWBOX.width);
          canvas.height = Math.max(1, image.naturalHeight || BUYER_BODY_MAP_VIEWBOX.height);

          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Unable to initialize body map canvas.");
          }

          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          const blob = await canvasToBlob(canvas, "image/png", 1);
          return new Uint8Array(await blob.arrayBuffer());
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => null);
  }

  return bodyMapReferencePngBytesPromise;
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

function wrapText(text: string, maxChars = 88) {
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

function drawPageChrome(page: PDFPage, pageNumber: number, totalPages: number, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 56,
    width: PAGE_WIDTH,
    height: 56,
    color: BRAND_DARK
  });

  page.drawText("CARNEST", {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 36,
    size: 16,
    font: bold,
    color: BRAND_GOLD
  });

  page.drawText(normalizePdfText(REPORT_TITLE, true), {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 49,
    size: 8.5,
    font: regular,
    color: rgb(0.86, 0.86, 0.86)
  });

  page.drawText("CARNEST", {
    x: 155,
    y: PAGE_HEIGHT / 2,
    size: 64,
    font: bold,
    color: rgb(0.965, 0.965, 0.965),
    rotate: degrees(-35),
    opacity: 0.18
  });

  page.drawLine({
    start: { x: PAGE_MARGIN, y: 28 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: 28 },
    thickness: 0.8,
    color: BRAND_LINE
  });

  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_MARGIN,
    y: 14,
    size: 8.5,
    font: regular,
    color: TEXT_MUTED
  });

  page.drawText("CarNest Inspection Report", {
    x: PAGE_WIDTH - PAGE_MARGIN - 118,
    y: 14,
    size: 8.5,
    font: regular,
    color: TEXT_MUTED
  });
}

function drawCard(page: PDFPage, x: number, y: number, width: number, height: number, dark = false) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: dark ? BRAND_DARK : BRAND_SHELL,
    borderColor: dark ? BRAND_GOLD : BORDER_LIGHT,
    borderWidth: 1
  });
}

function estimateParagraphHeight(text: string, maxChars: number, lineHeight: number) {
  return wrapText(text, maxChars).length * lineHeight;
}

function scoreTo100(score?: string | null) {
  if (!score) return "Pending";
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "Pending";
  return `${Math.round((numeric / 5) * 100)} / 100`;
}

function formatDateLabel(value?: string) {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    lineHeight: number;
    maxChars: number;
  }
) {
  let cursorY = options.y;
  const lines = wrapText(text, options.maxChars);
  lines.forEach((line) => {
    page.drawText(line, {
      x: options.x,
      y: cursorY,
      size: options.size,
      font: options.font,
      color: options.color
    });
    cursorY -= options.lineHeight;
  });

  return cursorY;
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

function buildAdditionalChecks(record: WarehouseIntakeRecord, supportsUnicode: boolean) {
  const serviceBook = sanitizeText(
    record.vehicleDetails.serviceHistory,
    "Not recorded",
    supportsUnicode
  );
  const spareKey = sanitizeText(
    record.vehicleReport.keyCondition || record.vehicleDetails.numberOfKeys,
    "Not recorded",
    supportsUnicode
  );

  return [
    ["PPSR", sanitizeText(record.vehicleReport.ppsrStatus, "Not recorded", supportsUnicode)],
    ["WOVR", sanitizeText(record.declarations.writtenOffHistory, "Not recorded", supportsUnicode)],
    ["Recall Check", "Not recorded"],
    ["Service Book", serviceBook],
    ["Spare Key", spareKey],
    ["Compliance Plate", "Not recorded"]
  ] as Array<[string, string]>;
}

function buildInspectorNotes(record: WarehouseIntakeRecord, supportsUnicode: boolean) {
  const notes = [
    record.vehicleReport.exteriorCondition ? `Exterior: ${record.vehicleReport.exteriorCondition}` : "",
    record.vehicleReport.interiorCondition ? `Interior: ${record.vehicleReport.interiorCondition}` : "",
    record.vehicleReport.wheelCondition ? `Wheels: ${record.vehicleReport.wheelCondition}` : "",
    record.vehicleReport.panelRepairNotes ? `Panel repair notes: ${record.vehicleReport.panelRepairNotes}` : "",
    record.vehicleReport.damageConditionNotes ? `Damage note: ${record.vehicleReport.damageConditionNotes}` : "",
    record.intakeNotes ? `Inspection note: ${record.intakeNotes}` : ""
  ].filter(Boolean);

  return sanitizeText(notes.join(" | "), "No inspector notes recorded.", supportsUnicode);
}

function collectVehicleReportDamageData(record: WarehouseIntakeRecord) {
  const damagePhotosById = new Map(
    record.photos
      .filter((photo) => photo.category === "damagePhotos")
      .map((photo) => [photo.id, photo] as const)
  );
  const gridOrder = new Map(
    VEHICLE_BODY_DAMAGE_GRID_CELLS.map((cell, index) => [cell.id, index] as const)
  );
  const linkedPhotoIds = new Set<string>();
  const groupsByGridCell = new Map<string, GridLinkedDamageGroup>();

  for (const damageRecord of record.vehicleReport.damageRecords ?? []) {
    const gridCellId = damageRecord.gridCellId?.trim();
    if (!gridCellId) continue;

    const cell = getVehicleBodyDamageGridCell(gridCellId);
    const linkedPhotos = damageRecord.photoIds
      .map((photoId) => {
        linkedPhotoIds.add(photoId);
        return damagePhotosById.get(photoId) ?? null;
      })
      .filter((photo): photo is WarehouseIntakePhotoRecord => Boolean(photo));

    const existingGroup = groupsByGridCell.get(gridCellId);
    const nextRecord: GridLinkedDamageRecord = {
      ...damageRecord,
      linkedPhotos,
    };

    if (existingGroup) {
      existingGroup.records.push(nextRecord);
      continue;
    }

    groupsByGridCell.set(gridCellId, {
      gridCellId,
      locationLabel: cell
        ? formatVehicleBodyDamageGridCellLabel(gridCellId)
        : `${VEHICLE_BODY_PANEL_LABELS[damageRecord.panelKey]} · ${gridCellId}`,
      panelLabel: cell?.panelLabel ?? VEHICLE_BODY_PANEL_LABELS[damageRecord.panelKey],
      cell,
      records: [nextRecord],
    });
  }

  const legacyRecordNoteByPhotoId = new Map<string, string>();
  for (const damageRecord of record.vehicleReport.damageRecords ?? []) {
    if (damageRecord.gridCellId?.trim()) continue;
    const note = damageRecord.notes?.trim();
    if (!note) continue;
    for (const photoId of damageRecord.photoIds) {
      if (!legacyRecordNoteByPhotoId.has(photoId)) {
        legacyRecordNoteByPhotoId.set(photoId, note);
      }
    }
  }

  return {
    gridDamageGroups: Array.from(groupsByGridCell.values()).sort((left, right) => {
      const leftOrder = gridOrder.get(left.gridCellId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = gridOrder.get(right.gridCellId) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.locationLabel.localeCompare(right.locationLabel);
    }),
    additionalDamagePhotos: record.photos
      .filter((photo) => photo.category === "damagePhotos" && !linkedPhotoIds.has(photo.id))
      .map((photo) => (
        !photo.note?.trim() && legacyRecordNoteByPhotoId.has(photo.id)
          ? { ...photo, note: legacyRecordNoteByPhotoId.get(photo.id) }
          : photo
      )),
  };
}

function drawSectionCardTitle(
  page: PDFPage,
  x: number,
  topY: number,
  title: string,
  regular: PDFFont,
  bold: PDFFont,
  supportsUnicode: boolean,
  subtitle?: string
) {
  page.drawText(normalizePdfText(title, supportsUnicode), {
    x,
    y: topY,
    size: 11,
    font: bold,
    color: BRAND_GOLD
  });

  if (subtitle) {
    page.drawText(normalizePdfText(subtitle, supportsUnicode), {
      x,
      y: topY - 13,
      size: 8.5,
      font: regular,
      color: TEXT_MUTED
    });
  }
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
  const damageData = collectVehicleReportDamageData(record);
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
  cursorY -= 30;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY - requiredHeight < 48) {
      const next = createPage(pdfDoc);
      page = next.page;
      cursorY = next.cursorY - 30;
    }
  };

  const drawHeroSection = () => {
    const cardHeight = 174;
    ensureSpace(cardHeight);
    const x = PAGE_MARGIN;
    const y = cursorY - cardHeight;
    drawCard(page, x, y, CONTENT_WIDTH, cardHeight, true);

    page.drawText(normalizePdfText("PREMIUM INSPECTION REPORT", supportsUnicode), {
      x: x + 18,
      y: y + cardHeight - 22,
      size: 8.5,
      font: bold,
      color: BRAND_GOLD
    });

    page.drawText(normalizePdfText(record.vehicleTitle || "Vehicle condition summary", supportsUnicode), {
      x: x + 18,
      y: y + cardHeight - 52,
      size: 24,
      font: bold,
      color: TEXT_LIGHT
    });

    page.drawText(normalizePdfText(sanitizeText(record.vehicleReference, record.id, supportsUnicode), supportsUnicode), {
      x: x + 18,
      y: y + cardHeight - 72,
      size: 10,
      font: regular,
      color: rgb(0.84, 0.84, 0.84)
    });

    const intro =
      "Buyer-facing CarNest inspection summary prepared from the stored intake and condition report record.";
    drawWrappedText(page, normalizePdfText(intro, supportsUnicode), {
      x: x + 18,
      y: y + cardHeight - 94,
      font: regular,
      size: 10,
      color: rgb(0.86, 0.86, 0.86),
      lineHeight: 13,
      maxChars: 42
    });

    page.drawText(normalizePdfText(`Generated ${formatDateLabel(record.vehicleReportGeneratedAt || record.updatedAt)}`, supportsUnicode), {
      x: x + 18,
      y: y + 18,
      size: 9,
      font: regular,
      color: rgb(0.8, 0.8, 0.8)
    });

    const scoreCardWidth = 142;
    const scoreCardHeight = 104;
    const scoreY = y + 34;
    const exteriorX = x + CONTENT_WIDTH - scoreCardWidth * 2 - 24;
    const interiorX = x + CONTENT_WIDTH - scoreCardWidth - 18;
    const scores: Array<{ title: string; value: string; x: number }> = [
      {
        title: "Exterior Condition",
        value: scoreTo100(record.vehicleReport.conditionCategories.exteriorBody.score),
        x: exteriorX
      },
      {
        title: "Interior Condition",
        value: scoreTo100(record.vehicleReport.conditionCategories.interiorCondition.score),
        x: interiorX
      }
    ];

    scores.forEach((score) => {
      page.drawRectangle({
        x: score.x,
        y: scoreY,
        width: scoreCardWidth,
        height: scoreCardHeight,
        color: rgb(0.12, 0.12, 0.12),
        borderColor: BRAND_GOLD,
        borderWidth: 1
      });
      page.drawText(normalizePdfText(score.title, supportsUnicode), {
        x: score.x + 14,
        y: scoreY + scoreCardHeight - 22,
        size: 8.5,
        font: bold,
        color: BRAND_GOLD
      });
      page.drawText(normalizePdfText(score.value, supportsUnicode), {
        x: score.x + 14,
        y: scoreY + scoreCardHeight - 58,
        size: 22,
        font: bold,
        color: TEXT_LIGHT
      });
    });

    cursorY = y - 18;
  };

  const drawInfoGridSection = (title: string, fields: Array<[string, string]>, subtitle?: string) => {
    const rowCount = Math.ceil(fields.length / 2);
    const rowHeight = 36;
    const sectionHeight = 44 + rowCount * rowHeight + 16;
    ensureSpace(sectionHeight);
    const x = PAGE_MARGIN;
    const y = cursorY - sectionHeight;
    drawCard(page, x, y, CONTENT_WIDTH, sectionHeight, false);
    drawSectionCardTitle(page, x + 18, y + sectionHeight - 22, title, regular, bold, supportsUnicode, subtitle);

    const leftX = x + 18;
    const rightX = x + CONTENT_WIDTH / 2 + 10;
    const columnWidth = CONTENT_WIDTH / 2 - 28;
    let localY = y + sectionHeight - 56;

    for (let index = 0; index < fields.length; index += 2) {
      const entries = [fields[index], fields[index + 1]].filter(Boolean) as Array<[string, string]>;
      entries.forEach(([label, value], itemIndex) => {
        const fieldX = itemIndex === 0 ? leftX : rightX;
        page.drawText(normalizePdfText(label, supportsUnicode), {
          x: fieldX,
          y: localY,
          size: 8.5,
          font: bold,
          color: TEXT_MUTED
        });
        page.drawText(normalizePdfText(value, supportsUnicode), {
          x: fieldX,
          y: localY - 14,
          size: 10.5,
          font: regular,
          color: TEXT_PRIMARY,
          maxWidth: columnWidth
        });
      });

      localY -= rowHeight;
    }

    cursorY = y - 18;
  };

  const drawTextSection = (title: string, text: string, subtitle?: string) => {
    const lines = wrapText(normalizePdfText(text, supportsUnicode), 94);
    const sectionHeight = 46 + lines.length * 13 + 20 + (subtitle ? 12 : 0);
    ensureSpace(sectionHeight);
    const x = PAGE_MARGIN;
    const y = cursorY - sectionHeight;
    drawCard(page, x, y, CONTENT_WIDTH, sectionHeight, false);
    drawSectionCardTitle(page, x + 18, y + sectionHeight - 22, title, regular, bold, supportsUnicode, subtitle);

    let textY = y + sectionHeight - (subtitle ? 50 : 38);
    lines.forEach((line) => {
      page.drawText(line, {
        x: x + 18,
        y: textY,
        size: 10.5,
        font: regular,
        color: TEXT_PRIMARY,
        maxWidth: CONTENT_WIDTH - 36
      });
      textY -= 13;
    });

    cursorY = y - 18;
  };

  const drawBodyMapSection = async () => {
    const noteText = sanitizeText(
      record.vehicleReport.damageConditionNotes || record.vehicleReport.panelRepairNotes,
      damageData.gridDamageGroups.length ? "Grid-linked damage records are shown below." : "No body damage notes recorded.",
      supportsUnicode
    );
    const noteHeight = estimateParagraphHeight(noteText, 92, 12);
    const sectionHeight = 410 + noteHeight;
    ensureSpace(sectionHeight);
    const x = PAGE_MARGIN;
    const y = cursorY - sectionHeight;
    drawCard(page, x, y, CONTENT_WIDTH, sectionHeight, false);
    drawSectionCardTitle(page, x + 18, y + sectionHeight - 22, "BODY DAMAGE MAP", regular, bold, supportsUnicode, "车身损伤图示");

    const mapFrame = {
      x: x + 18,
      y: y + 74,
      width: 238,
      height: 262
    };
    const legendX = x + 280;
    const mapScale = Math.min(mapFrame.width / BUYER_BODY_MAP_VIEWBOX.width, mapFrame.height / BUYER_BODY_MAP_VIEWBOX.height);
    const mapOriginX = mapFrame.x + (mapFrame.width - BUYER_BODY_MAP_VIEWBOX.width * mapScale) / 2;
    const mapOriginY = mapFrame.y + (mapFrame.height - BUYER_BODY_MAP_VIEWBOX.height * mapScale) / 2;
    page.drawRectangle({
      x: mapFrame.x,
      y: mapFrame.y,
      width: mapFrame.width,
      height: mapFrame.height,
      color: rgb(1, 1, 1),
      borderColor: BORDER_LIGHT,
      borderWidth: 1
    });

    const bodyMapReferencePngBytes = await loadBodyMapReferencePngBytes();
    if (bodyMapReferencePngBytes) {
      const embeddedBodyMap = await pdfDoc.embedPng(bodyMapReferencePngBytes);
      page.drawImage(embeddedBodyMap, {
        x: mapOriginX,
        y: mapOriginY,
        width: BUYER_BODY_MAP_VIEWBOX.width * mapScale,
        height: BUYER_BODY_MAP_VIEWBOX.height * mapScale
      });
    }

    BUYER_BODY_MAP_PANEL_AREAS.forEach((panel) => {
      const condition = record.vehicleReport.bodyMap?.[panel.key] ?? "original";
      const style = DAMAGE_MARKER_MAP[condition];

      if (style.code) {
        const markerX = mapOriginX + panel.markerX * mapScale;
        const markerY = mapOriginY + panel.markerY * mapScale;
        page.drawRectangle({
          x: markerX - 14,
          y: markerY - 8,
          width: 28,
          height: 16,
          color: BRAND_DARK,
          borderColor: BRAND_GOLD,
          borderWidth: 0.8
        });
        page.drawText(style.code, {
          x: markerX - 8,
          y: markerY - 3.5,
          size: 8.5,
          font: bold,
          color: BRAND_GOLD
        });
      }
    });

    damageData.gridDamageGroups.forEach((group) => {
      if (!group.cell) return;
      const gridX = mapOriginX + group.cell.x * mapScale;
      const gridY = mapOriginY + group.cell.y * mapScale;
      const markerX = mapOriginX + group.cell.markerX * mapScale;
      const markerY = mapOriginY + group.cell.markerY * mapScale;

      page.drawRectangle({
        x: gridX,
        y: gridY,
        width: group.cell.width * mapScale,
        height: group.cell.height * mapScale,
        color: BRAND_GOLD_SOFT,
        borderColor: BRAND_GOLD,
        borderWidth: 0.9
      });
      page.drawCircle({
        x: markerX,
        y: markerY,
        size: 10,
        color: BRAND_DARK,
        borderColor: BRAND_GOLD,
        borderWidth: 0.8
      });
      page.drawText(group.cell.code, {
        x: markerX - 5.5,
        y: markerY - 3.3,
        size: 7.2,
        font: bold,
        color: BRAND_GOLD
      });
    });

    page.drawText(normalizePdfText("Inspection Symbol Legend", supportsUnicode), {
      x: legendX,
      y: y + sectionHeight - 46,
      size: 11,
      font: bold,
      color: TEXT_PRIMARY
    });

    let legendY = y + sectionHeight - 66;
    INSPECTION_LEGEND.forEach(([code, label]) => {
      page.drawRectangle({
        x: legendX,
        y: legendY - 5,
        width: 22,
        height: 14,
        color: BRAND_DARK
      });
      page.drawText(code, {
        x: legendX + 5,
        y: legendY - 1.5,
        size: 7.5,
        font: bold,
        color: BRAND_GOLD
      });
      page.drawText(normalizePdfText(label, supportsUnicode), {
        x: legendX + 30,
        y: legendY - 1,
        size: 9,
        font: regular,
        color: TEXT_PRIMARY
      });
      legendY -= 18;
    });

    page.drawCircle({
      x: legendX + 11,
      y: legendY + 2,
      size: 8,
      color: BRAND_DARK,
      borderColor: BRAND_GOLD,
      borderWidth: 0.8
    });
    page.drawText("A1", {
      x: legendX + 6.5,
      y: legendY - 1,
      size: 6.8,
      font: bold,
      color: BRAND_GOLD
    });
    page.drawText(normalizePdfText("Grid-linked damage location", supportsUnicode), {
      x: legendX + 30,
      y: legendY - 1,
      size: 9,
      font: regular,
      color: TEXT_PRIMARY
    });

    let notesY = y + 48 + noteHeight;
    drawWrappedText(page, normalizePdfText(noteText, supportsUnicode), {
      x: mapFrame.x,
      y: notesY,
      font: regular,
      size: 10,
      color: TEXT_PRIMARY,
      lineHeight: 12,
      maxChars: 92
    });

    cursorY = y - 18;
  };

  const drawSignatureSection = async () => {
    const signatureMetaHeight = 104;
    const signatureImageHeight = record.signature.signatureStoragePath ? 90 : 0;
    const sectionHeight = signatureMetaHeight + signatureImageHeight + 36;
    ensureSpace(sectionHeight);
    const x = PAGE_MARGIN;
    const y = cursorY - sectionHeight;
    drawCard(page, x, y, CONTENT_WIDTH, sectionHeight, false);
    drawSectionCardTitle(page, x + 18, y + sectionHeight - 22, "Inspector Signature", regular, bold, supportsUnicode);

    const fields: Array<[string, string]> = [
      ["Signer Name", sanitizeText(record.signature.signerName, "Not provided", supportsUnicode)],
      ["Inspector", sanitizeText(record.signature.adminStaffName || record.adminStaffName, "Not provided", supportsUnicode)],
      ["Signed At", sanitizeText(formatDateLabel(record.signature.signedAt), "Pending", supportsUnicode)],
      ["PDF Generated", sanitizeText(formatDateLabel(record.pdfGeneratedAt), "Pending", supportsUnicode)]
    ];

    let rowY = y + sectionHeight - 48;
    fields.forEach(([label, value], index) => {
      const fieldX = x + 18 + (index % 2) * ((CONTENT_WIDTH - 36) / 2 + 8);
      if (index && index % 2 === 0) {
        rowY -= 34;
      }
      page.drawText(normalizePdfText(label, supportsUnicode), {
        x: fieldX,
        y: rowY,
        size: 8.5,
        font: bold,
        color: TEXT_MUTED
      });
      page.drawText(normalizePdfText(value, supportsUnicode), {
        x: fieldX,
        y: rowY - 14,
        size: 10.5,
        font: regular,
        color: TEXT_PRIMARY,
        maxWidth: 220
      });
    });

    if (record.signature.signatureStoragePath) {
      try {
        const bytes = options?.resolveStorageBytes
          ? await options.resolveStorageBytes(record.signature.signatureStoragePath)
          : (() => {
              throw new Error("Storage byte resolver unavailable.");
            })();
        const image = record.signature.signatureStoragePath.toLowerCase().includes(".png")
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const frame = {
          x: x + 18,
          y: y + 16,
          width: 190,
          height: 60
        };
        page.drawRectangle({
          x: frame.x,
          y: frame.y,
          width: frame.width,
          height: frame.height,
          color: rgb(1, 1, 1),
          borderColor: BORDER_LIGHT,
          borderWidth: 1
        });
        page.drawImage(image, getContainedImageRect(image, frame, 8));
      } catch {
        page.drawText(normalizePdfText("Signature captured and stored digitally.", supportsUnicode), {
          x: x + 18,
          y: y + 28,
          size: 10,
          font: regular,
          color: TEXT_MUTED
        });
      }
    }

    cursorY = y - 18;
  };

  const drawLinkedDamagePhotos = async (photos: WarehouseIntakePhotoRecord[]) => {
    ensureSpace(18);
    page.drawText(normalizePdfText("Linked Photos", supportsUnicode), {
      x: PAGE_MARGIN + 26,
      y: cursorY,
      size: 9,
      font: bold,
      color: TEXT_MUTED
    });
    cursorY -= 16;

    if (!photos.length) {
      ensureSpace(24);
      page.drawText(normalizePdfText("No linked photos recorded for this damage entry.", supportsUnicode), {
        x: PAGE_MARGIN + 26,
        y: cursorY,
        size: 9.5,
        font: regular,
        color: TEXT_MUTED
      });
      cursorY -= 18;
      return;
    }

    const gap = 12;
    const insetX = PAGE_MARGIN + 26;
    const availableWidth = CONTENT_WIDTH - 52;
    const photoWidth = (availableWidth - gap) / 2;
    const photoHeight = photoWidth * 0.72;
    const labelHeight = 18;
    let column = 0;

    for (const photo of photos) {
      ensureSpace(photoHeight + labelHeight + 16);
      const x = insetX + (column === 0 ? 0 : photoWidth + gap);
      const frameY = cursorY - photoHeight;

      page.drawRectangle({
        x,
        y: frameY,
        width: photoWidth,
        height: photoHeight,
        color: rgb(1, 1, 1),
        borderColor: BORDER_LIGHT,
        borderWidth: 1
      });

      try {
        const bytes = options?.resolveStorageBytes
          ? await options.resolveStorageBytes(photo.storagePath)
          : (() => {
              throw new Error("Storage byte resolver unavailable.");
            })();
        const optimized = await optimizePdfImageBytes(bytes);
        const embedded = optimized.mimeType === "image/jpeg"
          ? await pdfDoc.embedJpg(optimized.bytes)
          : photo.storagePath.toLowerCase().includes(".png")
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);
        page.drawImage(embedded, getContainedImageRect(embedded, {
          x: x + 6,
          y: frameY + 6,
          width: photoWidth - 12,
          height: photoHeight - 12
        }));
      } catch {
        page.drawText(normalizePdfText("Image unavailable in PDF render", supportsUnicode), {
          x: x + 14,
          y: frameY + photoHeight / 2,
          size: 9,
          font: regular,
          color: TEXT_MUTED
        });
      }

      page.drawText(normalizePdfText(photo.label || "Damage image", supportsUnicode), {
        x,
        y: frameY - 13,
        size: 8.5,
        font: bold,
        color: TEXT_PRIMARY,
        maxWidth: photoWidth
      });

      if (column === 1) {
        cursorY = frameY - labelHeight - 8;
        column = 0;
      } else {
        column = 1;
      }
    }

    if (column === 1) {
      cursorY -= photoHeight + labelHeight + 8;
    }
  };

  const drawDamageRecordsSection = async () => {
    ensureSpace(28);
    page.drawText(normalizePdfText("Damage Records", supportsUnicode), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 14,
      font: bold,
      color: TEXT_PRIMARY
    });
    cursorY -= 20;

    if (!damageData.gridDamageGroups.length) {
      const emptyHeight = 64;
      ensureSpace(emptyHeight);
      const y = cursorY - emptyHeight;
      drawCard(page, PAGE_MARGIN, y, CONTENT_WIDTH, emptyHeight, false);
      page.drawText(normalizePdfText("No grid-linked damage photos recorded.", supportsUnicode), {
        x: PAGE_MARGIN + 18,
        y: y + emptyHeight - 26,
        size: 10.5,
        font: bold,
        color: TEXT_PRIMARY
      });
      page.drawText(normalizePdfText("This PDF does not have any grid-linked damage records yet.", supportsUnicode), {
        x: PAGE_MARGIN + 18,
        y: y + emptyHeight - 42,
        size: 9.5,
        font: regular,
        color: TEXT_MUTED
      });
      cursorY = y - 18;
      return;
    }

    for (const group of damageData.gridDamageGroups) {
      const groupHeight = 52;
      ensureSpace(groupHeight);
      const groupY = cursorY - groupHeight;
      drawCard(page, PAGE_MARGIN, groupY, CONTENT_WIDTH, groupHeight, false);

      page.drawText(normalizePdfText("Body Area / Grid Location", supportsUnicode), {
        x: PAGE_MARGIN + 18,
        y: groupY + groupHeight - 18,
        size: 8.5,
        font: bold,
        color: TEXT_MUTED
      });
      page.drawText(normalizePdfText(group.locationLabel, supportsUnicode), {
        x: PAGE_MARGIN + 18,
        y: groupY + groupHeight - 34,
        size: 11,
        font: bold,
        color: TEXT_PRIMARY
      });
      page.drawText(
        normalizePdfText(
          `${group.panelLabel} · ${group.records.length} damage record${group.records.length === 1 ? "" : "s"}`,
          supportsUnicode
        ),
        {
          x: PAGE_MARGIN + 18,
          y: groupY + 10,
          size: 9,
          font: regular,
          color: TEXT_MUTED
        }
      );

      cursorY = groupY - 10;

      for (const damageRecord of group.records) {
        const notesText = sanitizeText(
          damageRecord.notes,
          "No additional notes recorded for this damage entry.",
          supportsUnicode
        );
        const noteLines = wrapText(notesText, 80);
        const recordHeight = 70 + noteLines.length * 12;
        ensureSpace(recordHeight);
        const recordY = cursorY - recordHeight;

        page.drawRectangle({
          x: PAGE_MARGIN + 12,
          y: recordY,
          width: CONTENT_WIDTH - 24,
          height: recordHeight,
          color: rgb(1, 1, 1),
          borderColor: BORDER_LIGHT,
          borderWidth: 1
        });

        page.drawText(normalizePdfText("Body Area / Grid Location", supportsUnicode), {
          x: PAGE_MARGIN + 26,
          y: recordY + recordHeight - 18,
          size: 8.5,
          font: bold,
          color: TEXT_MUTED
        });
        page.drawText(normalizePdfText(group.locationLabel, supportsUnicode), {
          x: PAGE_MARGIN + 26,
          y: recordY + recordHeight - 32,
          size: 10,
          font: regular,
          color: TEXT_PRIMARY
        });

        page.drawText(normalizePdfText("Damage Type", supportsUnicode), {
          x: PAGE_MARGIN + CONTENT_WIDTH / 2,
          y: recordY + recordHeight - 18,
          size: 8.5,
          font: bold,
          color: TEXT_MUTED
        });
        page.drawText(normalizePdfText(VEHICLE_DAMAGE_TYPE_LABELS[damageRecord.damageType], supportsUnicode), {
          x: PAGE_MARGIN + CONTENT_WIDTH / 2,
          y: recordY + recordHeight - 32,
          size: 10,
          font: regular,
          color: TEXT_PRIMARY
        });

        page.drawText(normalizePdfText("Notes", supportsUnicode), {
          x: PAGE_MARGIN + 26,
          y: recordY + recordHeight - 48,
          size: 8.5,
          font: bold,
          color: TEXT_MUTED
        });

        let noteY = recordY + recordHeight - 62;
        noteLines.forEach((line) => {
          page.drawText(line, {
            x: PAGE_MARGIN + 26,
            y: noteY,
            size: 9.5,
            font: regular,
            color: TEXT_PRIMARY
          });
          noteY -= 12;
        });

        cursorY = recordY - 8;
        await drawLinkedDamagePhotos(damageRecord.linkedPhotos);
        cursorY -= 8;
      }
    }
  };

  const drawPhotoAppendix = async (
    title: string,
    photos: WarehouseIntakeRecord["photos"],
    includeMeta = false,
    defaultMeta = ""
  ) => {
    if (!photos.length) return;

    ensureSpace(40);
    const headerHeight = 22;
    page.drawText(normalizePdfText(title, supportsUnicode), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 14,
      font: bold,
      color: TEXT_PRIMARY
    });
    cursorY -= headerHeight;

    const gap = 16;
    const photoWidth = (CONTENT_WIDTH - gap) / 2;
    const photoHeight = photoWidth * 0.72;
    const metaHeight = includeMeta ? 48 : 20;
    const cardHeight = photoHeight + metaHeight + 18;
    let column = 0;

    for (const photo of photos) {
      ensureSpace(cardHeight + 12);
      const x = column === 0 ? PAGE_MARGIN : PAGE_MARGIN + photoWidth + gap;
      const y = cursorY - photoHeight - 8;

      page.drawRectangle({
        x,
        y,
        width: photoWidth,
        height: photoHeight,
        color: rgb(0.995, 0.995, 0.995),
        borderColor: BORDER_LIGHT,
        borderWidth: 1
      });

      try {
        const bytes = options?.resolveStorageBytes
          ? await options.resolveStorageBytes(photo.storagePath)
          : (() => {
              throw new Error("Storage byte resolver unavailable.");
            })();
        const optimized = await optimizePdfImageBytes(bytes);
        const embedded = optimized.mimeType === "image/jpeg"
          ? await pdfDoc.embedJpg(optimized.bytes)
          : photo.storagePath.toLowerCase().includes(".png")
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);
        page.drawImage(embedded, getContainedImageRect(embedded, {
          x: x + 6,
          y: y + 6,
          width: photoWidth - 12,
          height: photoHeight - 12
        }));
      } catch {
        page.drawText(normalizePdfText("Image unavailable in PDF render", supportsUnicode), {
          x: x + 16,
          y: y + photoHeight / 2,
          size: 10,
          font: regular,
          color: TEXT_MUTED
        });
      }

      page.drawText(normalizePdfText(photo.label, supportsUnicode), {
        x,
        y: y - 14,
        size: 9.5,
        font: bold,
        color: TEXT_PRIMARY
      });

      if (includeMeta) {
        const meta = sanitizeText(photo.note || defaultMeta, "", supportsUnicode);
        if (meta) {
          page.drawText(normalizePdfText(meta, supportsUnicode), {
            x,
            y: y - 27,
            size: 8.5,
            font: regular,
            color: TEXT_MUTED,
            maxWidth: photoWidth
          });
        }
      }

      if (column === 1) {
        cursorY = y - metaHeight - 10;
        column = 0;
      } else {
        column = 1;
      }
    }

    if (column === 1) {
      cursorY -= cardHeight + 8;
    }
  };

  const vehicleFields: Array<[string, string]> = [
    ["Year", sanitizeText(record.vehicleDetails.year, "Not provided", supportsUnicode)],
    ["First Registration", "Not provided"],
    ["Make / Model", sanitizeText([record.vehicleDetails.make, record.vehicleDetails.model].filter(Boolean).join(" / "), "Not provided", supportsUnicode)],
    ["Variant", sanitizeText(record.vehicleDetails.variant, "Not provided", supportsUnicode)],
    ["VIN", sanitizeText(record.vehicleDetails.vin, "Not provided", supportsUnicode)],
    ["Rego", sanitizeText(record.vehicleDetails.registrationPlate, "Not provided", supportsUnicode)],
    ["Engine", "Not provided"],
    ["Chassis", sanitizeText(record.vehicleDetails.vin, "Not provided", supportsUnicode)],
    ["Odometer", sanitizeText(record.vehicleDetails.odometer, "Not provided", supportsUnicode)],
    ["Fuel", sanitizeText(record.vehicleDetails.fuelType, "Not provided", supportsUnicode)],
    ["Transmission", sanitizeText(record.vehicleDetails.transmission, "Not provided", supportsUnicode)],
    ["Drive Type", sanitizeText(record.vehicleDetails.drivetrain, "Not provided", supportsUnicode)]
  ];

  const featuresText = sanitizeText(
    record.vehicleDetails.notes || record.intakeNotes,
    "No features or equipment notes recorded.",
    supportsUnicode
  );
  const serviceHistoryText = sanitizeText(
    record.vehicleDetails.serviceHistory,
    "No service history notes recorded.",
    supportsUnicode
  );

  drawHeroSection();
  drawInfoGridSection("Vehicle Information", vehicleFields);
  await drawBodyMapSection();
  await drawDamageRecordsSection();
  drawInfoGridSection("Additional Checks", buildAdditionalChecks(record, supportsUnicode));
  drawTextSection("Features / Equipment", featuresText);
  drawTextSection("Service History", serviceHistoryText);
  drawTextSection("Inspector Notes", buildInspectorNotes(record, supportsUnicode));
  await drawSignatureSection();

  drawTextSection("Important Notice", DISCLAIMER_LINES.join(" "), "Informational reference only");

  const documentationPhotos = record.photos.filter((photo) => photo.category !== "damagePhotos").slice(0, 8);

  await drawPhotoAppendix("Supporting Inspection Images", documentationPhotos, false);
  await drawPhotoAppendix(
    "Additional damage photos",
    damageData.additionalDamagePhotos,
    true,
    record.vehicleReport.damageConditionNotes
  );

  const pages = pdfDoc.getPages();
  pages.forEach((existingPage, index) => drawPageChrome(existingPage, index + 1, pages.length, regular, bold));

  return await pdfDoc.save();
}
