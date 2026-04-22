"use client";

const MAX_IMAGE_DIMENSION = 1600;
const OUTPUT_QUALITY = 0.72;
const MIN_OUTPUT_QUALITY = 0.52;
const MAX_OUTPUT_BYTES = 500 * 1024;
const QUALITY_STEP = 0.04;
const SCALE_STEP = 0.9;
const MIN_IMAGE_DIMENSION = 960;

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

function getScaledDimensions(width: number, height: number) {
  const longestSide = Math.max(width, height);
  if (longestSide <= MAX_IMAGE_DIMENSION) {
    return { width, height };
  }

  const scale = MAX_IMAGE_DIMENSION / longestSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to compress image."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

function jpegBlobToFile(blob: Blob, fileName: string) {
  return new Promise<File>((resolve, reject) => {
    const sanitizedName = fileName.replace(/\.[^.]+$/, "").replace(/\s+/g, "-").toLowerCase();
    resolve(new File([blob], `${sanitizedName}.jpg`, { type: "image/jpeg" }));
  });
}

async function canvasToOptimizedJpegFile(canvas: HTMLCanvasElement, fileName: string) {
  let workingCanvas = canvas;
  let quality = OUTPUT_QUALITY;
  let blob = await canvasToJpegBlob(workingCanvas, quality);

  while (blob.size > MAX_OUTPUT_BYTES) {
    if (quality > MIN_OUTPUT_QUALITY) {
      quality = Math.max(MIN_OUTPUT_QUALITY, Number((quality - QUALITY_STEP).toFixed(2)));
      blob = await canvasToJpegBlob(workingCanvas, quality);
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

    workingCanvas = resizedCanvas;
    quality = OUTPUT_QUALITY;
    blob = await canvasToJpegBlob(workingCanvas, quality);
  }

  return jpegBlobToFile(blob, fileName);
}

export async function optimizeVehicleImage(file: File) {
  // TODO: Public licence-plate blur is not implemented yet.
  // The current client-side upload path only resizes/compresses images.
  // Proper plate blur needs a server-side detection + blurred-derivative pipeline
  // before public inventory/detail pages can safely serve blurred images.
  const image = await loadImage(file);
  const { width, height } = getScaledDimensions(image.naturalWidth, image.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare image processing context.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  return canvasToOptimizedJpegFile(canvas, file.name);
}

export async function optimizeVehicleImages(files: File[]) {
  return Promise.all(files.map((file) => optimizeVehicleImage(file)));
}

export const VEHICLE_IMAGE_UPLOAD_LIMIT = 21;
export const VEHICLE_IMAGE_MAX_DIMENSION = MAX_IMAGE_DIMENSION;
export const VEHICLE_IMAGE_OUTPUT_QUALITY = OUTPUT_QUALITY;
export const VEHICLE_IMAGE_MIN_OUTPUT_QUALITY = MIN_OUTPUT_QUALITY;
export const VEHICLE_IMAGE_MAX_OUTPUT_BYTES = MAX_OUTPUT_BYTES;
