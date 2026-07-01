"use client";

import { type PDFDocument } from "pdf-lib";

export type PdfEmbeddedImage =
  | Awaited<ReturnType<PDFDocument["embedJpg"]>>
  | Awaited<ReturnType<PDFDocument["embedPng"]>>;

export type PdfImageKind = "photo" | "signature";

type PreparedPdfImageSource = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
};

type CreatePdfImageAssetLoaderOptions = {
  pdfDoc: PDFDocument;
  resolveStorageBytes?: (storagePath: string) => Promise<Uint8Array>;
  photoMaxBytes?: number;
  photoMaxDimension?: number;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_PHOTO_MAX_BYTES = 320 * 1024;
const DEFAULT_PHOTO_MAX_DIMENSION = 1400;
const DEFAULT_PHOTO_MIN_DIMENSION = 720;
const DEFAULT_PHOTO_START_QUALITY = 0.74;
const DEFAULT_PHOTO_MIN_QUALITY = 0.56;
const DEFAULT_PHOTO_QUALITY_STEP = 0.05;
const DEFAULT_PHOTO_SCALE_STEP = 0.86;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error(`${label} timed out.`)), timeoutMs);
    promise
      .then((value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      });
  });
}

function detectPdfImageMimeType(bytes: Uint8Array, storagePath = ""): "image/jpeg" | "image/png" {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  return storagePath.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";
}

function loadImageFromObjectUrl(objectUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode PDF image."));
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to encode PDF image."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function releaseCanvas(canvas?: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

async function optimizePdfPhotoSource(
  bytes: Uint8Array,
  storagePath: string,
  options: {
    maxBytes: number;
    maxDimension: number;
    timeoutMs: number;
  }
): Promise<PreparedPdfImageSource> {
  const originalMimeType = detectPdfImageMimeType(bytes, storagePath);
  if (typeof window === "undefined") {
    return { bytes, mimeType: originalMimeType };
  }

  if (originalMimeType === "image/jpeg" && bytes.length <= options.maxBytes) {
    return { bytes, mimeType: originalMimeType };
  }

  let objectUrl = "";
  let image: HTMLImageElement | null = null;
  let canvas: HTMLCanvasElement | null = null;

  try {
    const blobBytes = new Uint8Array(bytes.byteLength);
    blobBytes.set(bytes);
    objectUrl = URL.createObjectURL(new Blob([blobBytes.buffer as ArrayBuffer], { type: originalMimeType }));
    image = await withTimeout(loadImageFromObjectUrl(objectUrl), options.timeoutMs, "PDF image decode");

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestSide > options.maxDimension ? options.maxDimension / longestSide : 1;
    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));

    if (scale === 1 && bytes.length <= options.maxBytes) {
      return { bytes, mimeType: originalMimeType };
    }

    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to initialise PDF image canvas.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    let quality = DEFAULT_PHOTO_START_QUALITY;
    let blob = await withTimeout(canvasToBlob(canvas, "image/jpeg", quality), options.timeoutMs, "PDF image encoding");

    while (blob.size > options.maxBytes) {
      if (quality > DEFAULT_PHOTO_MIN_QUALITY) {
        quality = Math.max(DEFAULT_PHOTO_MIN_QUALITY, Number((quality - DEFAULT_PHOTO_QUALITY_STEP).toFixed(2)));
        blob = await withTimeout(canvasToBlob(canvas, "image/jpeg", quality), options.timeoutMs, "PDF image encoding");
        continue;
      }

      const nextWidth = Math.round(canvas.width * DEFAULT_PHOTO_SCALE_STEP);
      const nextHeight = Math.round(canvas.height * DEFAULT_PHOTO_SCALE_STEP);
      if (Math.max(nextWidth, nextHeight) < DEFAULT_PHOTO_MIN_DIMENSION) {
        break;
      }

      const resizedCanvas = document.createElement("canvas");
      resizedCanvas.width = nextWidth;
      resizedCanvas.height = nextHeight;
      const resizedContext = resizedCanvas.getContext("2d");
      if (!resizedContext) {
        throw new Error("Unable to resize PDF image.");
      }

      resizedContext.imageSmoothingEnabled = true;
      resizedContext.imageSmoothingQuality = "high";
      resizedContext.drawImage(canvas, 0, 0, nextWidth, nextHeight);

      canvas.width = nextWidth;
      canvas.height = nextHeight;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(resizedCanvas, 0, 0, nextWidth, nextHeight);
      releaseCanvas(resizedCanvas);

      width = nextWidth;
      height = nextHeight;
      quality = DEFAULT_PHOTO_START_QUALITY;
      blob = await withTimeout(canvasToBlob(canvas, "image/jpeg", quality), options.timeoutMs, "PDF image encoding");
    }

    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: "image/jpeg",
    };
  } catch {
    return { bytes, mimeType: originalMimeType };
  } finally {
    releaseCanvas(canvas);
    if (image) {
      image.src = "";
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export function createPdfImageAssetLoader(options: CreatePdfImageAssetLoaderOptions) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const photoMaxBytes = options.photoMaxBytes ?? DEFAULT_PHOTO_MAX_BYTES;
  const photoMaxDimension = options.photoMaxDimension ?? DEFAULT_PHOTO_MAX_DIMENSION;
  const rawBytesCache = new Map<string, Promise<Uint8Array | null>>();
  const preparedSourceCache = new Map<string, Promise<PreparedPdfImageSource | null>>();
  const embeddedImageCache = new Map<string, Promise<PdfEmbeddedImage | null>>();

  const getRawBytes = (storagePath: string) => {
    if (!rawBytesCache.has(storagePath)) {
      rawBytesCache.set(storagePath, (async () => {
        if (!options.resolveStorageBytes) return null;
        try {
          return await withTimeout(options.resolveStorageBytes(storagePath), timeoutMs, `PDF image fetch (${storagePath})`);
        } catch {
          return null;
        }
      })());
    }

    return rawBytesCache.get(storagePath)!;
  };

  const getPreparedSource = (storagePath: string, kind: PdfImageKind = "photo") => {
    const cacheKey = `${kind}:${storagePath}`;
    if (!preparedSourceCache.has(cacheKey)) {
      preparedSourceCache.set(cacheKey, (async () => {
        const rawBytes = await getRawBytes(storagePath);
        if (!rawBytes) return null;

        if (kind === "signature") {
          return {
            bytes: rawBytes,
            mimeType: detectPdfImageMimeType(rawBytes, storagePath),
          } satisfies PreparedPdfImageSource;
        }

        return await optimizePdfPhotoSource(rawBytes, storagePath, {
          maxBytes: photoMaxBytes,
          maxDimension: photoMaxDimension,
          timeoutMs,
        });
      })());
    }

    return preparedSourceCache.get(cacheKey)!;
  };

  const prefetch = async (storagePaths: string[], kind: PdfImageKind = "photo") => {
    const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)));
    await Promise.all(uniquePaths.map(async (storagePath) => {
      await getPreparedSource(storagePath, kind).catch(() => null);
    }));
  };

  const loadEmbeddedImage = async (storagePath: string, kind: PdfImageKind = "photo") => {
    const cacheKey = `${kind}:${storagePath}`;
    if (!embeddedImageCache.has(cacheKey)) {
      embeddedImageCache.set(cacheKey, (async () => {
        const preparedSource = await getPreparedSource(storagePath, kind);
        if (!preparedSource) return null;

        if (preparedSource.mimeType === "image/png") {
          return await options.pdfDoc.embedPng(preparedSource.bytes);
        }

        return await options.pdfDoc.embedJpg(preparedSource.bytes);
      })());
    }

    return await embeddedImageCache.get(cacheKey)!;
  };

  return {
    prefetch,
    loadEmbeddedImage,
  };
}
