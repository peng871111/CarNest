"use client";

import { PreparedVehicleImageUpload } from "@/types";

const WEBP_MIME_TYPE = "image/webp";
const JPEG_MIME_TYPE = "image/jpeg";
const EMAIL_ATTACHMENT_MIME_TYPE = JPEG_MIME_TYPE;

const FULL_MAX_WIDTH = 1600;
const FULL_OUTPUT_QUALITY = 0.75;
const FULL_MIN_OUTPUT_QUALITY = 0.6;
const FULL_MAX_OUTPUT_BYTES = 400 * 1024;

const THUMBNAIL_MAX_WIDTH = 900;
const THUMBNAIL_OUTPUT_QUALITY = 0.6;
const THUMBNAIL_MIN_OUTPUT_QUALITY = 0.5;
const THUMBNAIL_MAX_OUTPUT_BYTES = 150 * 1024;

const QUALITY_STEP = 0.04;
const SCALE_STEP = 0.9;
const MIN_IMAGE_DIMENSION = 720;

export interface CompressVehicleImageOptions {
  maxWidth: number;
  quality: number;
  maxBytes: number;
  minQuality: number;
  outputMimeType?: string;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to read image: ${file.name}`));
    };

    image.src = objectUrl;
  });
}

function releaseCanvas(canvas?: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

function getScaledDimensions(width: number, height: number, maxWidth: number) {
  const longestSide = Math.max(width, height);
  if (longestSide <= maxWidth) {
    return { width, height };
  }

  const scale = maxWidth / longestSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to compress image."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function supportsWebPOutput() {
  const canvas = document.createElement("canvas");
  return canvas.toDataURL(WEBP_MIME_TYPE).startsWith(`data:${WEBP_MIME_TYPE}`);
}

function getOutputMimeType(preferredMimeType?: string) {
  if (preferredMimeType === JPEG_MIME_TYPE) return JPEG_MIME_TYPE;
  if (preferredMimeType === WEBP_MIME_TYPE) {
    return supportsWebPOutput() ? WEBP_MIME_TYPE : JPEG_MIME_TYPE;
  }
  return supportsWebPOutput() ? WEBP_MIME_TYPE : JPEG_MIME_TYPE;
}

function blobToOutputFile(blob: Blob, fileName: string, mimeType: string) {
  const sanitizedName = fileName.replace(/\.[^.]+$/, "").replace(/\s+/g, "-").toLowerCase();
  const extension = mimeType === WEBP_MIME_TYPE ? "webp" : "jpg";
  return new File([blob], `${sanitizedName}.${extension}`, { type: mimeType });
}

async function canvasToOptimizedFile(canvas: HTMLCanvasElement, fileName: string, options: CompressVehicleImageOptions) {
  const mimeType = getOutputMimeType(options.outputMimeType);
  let workingCanvas = canvas;
  let quality = options.quality;
  let blob = await canvasToBlob(workingCanvas, mimeType, quality);

  while (blob.size > options.maxBytes) {
    if (quality > options.minQuality) {
      quality = Math.max(options.minQuality, Number((quality - QUALITY_STEP).toFixed(2)));
      blob = await canvasToBlob(workingCanvas, mimeType, quality);
      continue;
    }

    const nextWidth = Math.round(workingCanvas.width * SCALE_STEP);
    const nextHeight = Math.round(workingCanvas.height * SCALE_STEP);
    if (Math.max(nextWidth, nextHeight) < MIN_IMAGE_DIMENSION) {
      break;
    }

    const resizedCanvas = document.createElement("canvas");
    resizedCanvas.width = nextWidth;
    resizedCanvas.height = nextHeight;
    const resizedContext = resizedCanvas.getContext("2d");
    if (!resizedContext) {
      throw new Error("Unable to continue image compression.");
    }

    resizedContext.imageSmoothingEnabled = true;
    resizedContext.imageSmoothingQuality = "high";
    resizedContext.drawImage(workingCanvas, 0, 0, nextWidth, nextHeight);

    if (workingCanvas !== canvas) {
      releaseCanvas(workingCanvas);
    }
    workingCanvas = resizedCanvas;
    quality = options.quality;
    blob = await canvasToBlob(workingCanvas, mimeType, quality);
  }

  const outputFile = blobToOutputFile(blob, fileName, mimeType);
  if (workingCanvas !== canvas) {
    releaseCanvas(workingCanvas);
  }
  return outputFile;
}

export async function compressVehicleImage(file: File, options: CompressVehicleImageOptions) {
  // TODO: Public licence-plate blur is not implemented yet.
  // The current client-side upload path only creates resized optimized derivatives.
  // Proper plate blur needs a server-side detection + blurred-derivative pipeline.
  const image = await loadImage(file);
  const { width, height } = getScaledDimensions(image.naturalWidth, image.naturalHeight, options.maxWidth);

  const canvas = document.createElement("canvas");

  try {
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to prepare image processing context.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    return await canvasToOptimizedFile(canvas, file.name, options);
  } finally {
    image.src = "";
    releaseCanvas(canvas);
  }
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64Content = ""] = result.split(",", 2);
      if (!base64Content) {
        reject(new Error("Unable to encode image attachment."));
        return;
      }
      resolve(base64Content);
    };
    reader.onerror = () => reject(new Error("Unable to read image attachment."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareVehicleActivityEmailAttachments(files: File[]) {
  const attachments = [] as { content: string; contentType: string }[];

  for (const file of files.slice(0, 5)) {
    const optimizedFile = await compressVehicleImage(file, {
      maxWidth: 1200,
      quality: 0.72,
      minQuality: 0.65,
      maxBytes: 300 * 1024,
      outputMimeType: EMAIL_ATTACHMENT_MIME_TYPE
    });

    attachments.push({
      content: await blobToBase64(optimizedFile),
      contentType: optimizedFile.type || EMAIL_ATTACHMENT_MIME_TYPE
    });
  }

  return attachments;
}

export async function prepareVehicleImageUpload(file: File): Promise<PreparedVehicleImageUpload> {
  const thumbnailFile = await compressVehicleImage(file, {
    maxWidth: THUMBNAIL_MAX_WIDTH,
    quality: THUMBNAIL_OUTPUT_QUALITY,
    minQuality: THUMBNAIL_MIN_OUTPUT_QUALITY,
    maxBytes: THUMBNAIL_MAX_OUTPUT_BYTES
  });
  const fullFile = await compressVehicleImage(file, {
    maxWidth: FULL_MAX_WIDTH,
    quality: FULL_OUTPUT_QUALITY,
    minQuality: FULL_MIN_OUTPUT_QUALITY,
    maxBytes: FULL_MAX_OUTPUT_BYTES
  });

  return {
    id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceName: file.name,
    thumbnailFile,
    fullFile,
    previewUrl: URL.createObjectURL(fullFile)
  };
}

export async function prepareVehicleImageUploads(files: File[]) {
  const preparedUploads = [] as PreparedVehicleImageUpload[];
  for (const file of files) {
    preparedUploads.push(await prepareVehicleImageUpload(file));
  }
  return preparedUploads;
}

export async function optimizeVehicleImage(file: File) {
  return (await prepareVehicleImageUpload(file)).fullFile;
}

export async function optimizeVehicleImages(files: File[]) {
  const optimizedImages = [] as File[];
  for (const file of files) {
    optimizedImages.push(await optimizeVehicleImage(file));
  }
  return optimizedImages;
}

export const VEHICLE_IMAGE_UPLOAD_LIMIT = 21;
export const VEHICLE_IMAGE_FULL_MAX_DIMENSION = FULL_MAX_WIDTH;
export const VEHICLE_IMAGE_FULL_MAX_OUTPUT_BYTES = FULL_MAX_OUTPUT_BYTES;
export const VEHICLE_IMAGE_FULL_OUTPUT_QUALITY = FULL_OUTPUT_QUALITY;
export const VEHICLE_IMAGE_THUMBNAIL_MAX_DIMENSION = THUMBNAIL_MAX_WIDTH;
export const VEHICLE_IMAGE_THUMBNAIL_MAX_OUTPUT_BYTES = THUMBNAIL_MAX_OUTPUT_BYTES;
export const VEHICLE_IMAGE_THUMBNAIL_OUTPUT_QUALITY = THUMBNAIL_OUTPUT_QUALITY;
