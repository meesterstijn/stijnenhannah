// Generic browser-side image optimize pipeline: decode + EXIF-correct
// orientation + resize + re-encode. Extracted from
// src/features/tuingids/lib/optimizeGrowthPhoto.ts (which now wraps this
// with its original 1600px/0.82 constants, unchanged behavior) so other
// features (Game Night checkpoint photos) can reuse the exact same,
// already-proven decode/orientation/export logic with their own size/
// quality trade-off, instead of a second image pipeline.
//
// Pipeline:
//   1. Validate type + size.
//   2. Decode via blueimp-load-image with orientation:true. The library
//      detects whether the browser already auto-applies EXIF orientation
//      and compensates accordingly — so the output canvas always contains
//      physically correct pixels, never double-rotated.
//   3. Scale down to <= maxSidePx on the longest side (no upscaling).
//   4. Export to WebP @ quality; PNG (lossless) as fallback when the
//      browser can't encode WebP (e.g. Safari <16) — never JPEG, which has
//      no alpha channel and would silently flatten transparent PNGs onto
//      white.

import loadImage from "blueimp-load-image";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

export type OptimizedPhoto = {
  blob: Blob;
  mimeType: "image/webp" | "image/png";
  extension: "webp" | "png";
  originalFilename: string;
  fileSizeBytes: number;
  width: number;
  height: number;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else
          reject(
            new Error(
              "Afbeelding kan niet worden geëxporteerd (toBlob retourneerde null).",
            ),
          );
      },
      mimeType,
      quality,
    );
  });
}

export async function optimizeImage(
  file: File,
  options: { maxSidePx: number; quality: number; maxFileBytes: number },
): Promise<OptimizedPhoto> {
  const { maxSidePx, quality, maxFileBytes } = options;

  const fileType = file.type.toLowerCase();
  if (HEIC_TYPES.has(fileType)) {
    throw new Error(
      "HEIC-foto's worden nog niet ondersteund. Kies op je telefoon voor JPEG of converteer de foto eerst.",
    );
  }
  if (!ACCEPTED_TYPES.has(fileType) && !ACCEPTED_TYPES.has(file.type)) {
    throw new Error(
      `Bestandstype wordt niet ondersteund: ${file.type || "onbekend"}. Gebruik JPEG, PNG of WebP.`,
    );
  }
  if (file.size > maxFileBytes) {
    throw new Error(
      `Bestand te groot (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${(maxFileBytes / 1024 / 1024).toFixed(0)} MB.`,
    );
  }

  let result: Awaited<ReturnType<typeof loadImage>>;
  try {
    result = await loadImage(file, {
      canvas: true,
      meta: true,
      orientation: true,
      maxWidth: maxSidePx,
      maxHeight: maxSidePx,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
  } catch (err) {
    throw new Error(
      `Afbeelding kan niet worden gelezen of verwerkt: ${err instanceof Error ? err.message : "onbekende fout"}.`,
    );
  }

  const canvas = result.image;
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(
      "Kan geen canvas aanmaken: de browser retourneerde een onverwacht type na het laden van de afbeelding.",
    );
  }

  const { width, height } = canvas;
  if (width === 0 || height === 0) {
    throw new Error(
      "Afbeeldingsmetadata kan niet worden verwerkt: canvas heeft geen afmetingen.",
    );
  }

  let blob: Blob;
  let mimeType: "image/webp" | "image/png";
  let extension: "webp" | "png";

  let webpBlob: Blob | null = null;
  try {
    webpBlob = await canvasToBlob(canvas, "image/webp", quality);
  } catch {
    // toBlob failed entirely — fall through to PNG
  }

  if (webpBlob?.type === "image/webp") {
    blob = webpBlob;
    mimeType = "image/webp";
    extension = "webp";
  } else {
    try {
      blob = await canvasToBlob(canvas, "image/png");
    } catch {
      throw new Error(
        "Afbeelding kan niet worden geëxporteerd. Probeer een andere foto.",
      );
    }
    mimeType = "image/png";
    extension = "png";
  }

  return {
    blob,
    mimeType,
    extension,
    originalFilename: file.name,
    fileSizeBytes: blob.size,
    width,
    height,
  };
}
