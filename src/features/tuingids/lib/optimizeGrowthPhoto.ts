// Compresses, resizes, and EXIF-corrects a user-selected image in the browser
// before uploading to Supabase Storage.
//
// Pipeline:
//   1. Validate type + size.
//   2. Decode via blueimp-load-image with orientation:true.
//      The library detects whether the browser already auto-applies EXIF
//      orientation and compensates accordingly — so the output canvas always
//      contains physically correct pixels, never double-rotated.
//   3. Scale down to ≤ 1600 px on the longest side (no upscaling).
//   4. Export to WebP @ 0.82; PNG (lossless) as fallback when the browser
//      can't encode WebP (bv. Safari <16) — never JPEG, dat heeft geen
//      alphakanaal en zou transparante PNG's (bv. cocktailfoto's) stilzwijgend
//      op een witte achtergrond plakken.
//
// No manual EXIF-rotation is performed after loadImage — that would double-rotate.

import loadImage from "blueimp-load-image";

const MAX_SIDE_PX = 1600;
const QUALITY_WEBP = 0.82;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

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

export async function optimizeGrowthPhoto(file: File): Promise<OptimizedPhoto> {
  // Type validation
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
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Bestand te groot (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`,
    );
  }

  // Decode + resize + EXIF-oriëntatie via blueimp-load-image.
  // orientation:true instructs the library to read EXIF Orientation (1-8)
  // and apply the required rotate/flip to the canvas, regardless of whether
  // the current browser already applies EXIF natively. The library probes the
  // browser at startup and compensates, so the output is never double-rotated.
  let result: Awaited<ReturnType<typeof loadImage>>;
  try {
    result = await loadImage(file, {
      canvas: true,
      meta: true,
      orientation: true,
      maxWidth: MAX_SIDE_PX,
      maxHeight: MAX_SIDE_PX,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
  } catch (err) {
    throw new Error(
      `Afbeelding kan niet worden gelezen of verwerkt: ${err instanceof Error ? err.message : "onbekende fout"}.`,
    );
  }

  // loadImage resolves with data.image — a canvas when canvas:true is set.
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

  // Export to WebP; fall back to PNG when the browser does not support it.
  // canvas.toBlob with "image/webp" may silently return a PNG in some browsers
  // (e.g. Safari before 16) — we verify the returned MIME type. PNG (not
  // JPEG) as fallback: canvas.toBlob("image/png") is universally supported
  // and, unlike JPEG, keeps the alpha channel intact.
  let blob: Blob;
  let mimeType: "image/webp" | "image/png";
  let extension: "webp" | "png";

  let webpBlob: Blob | null = null;
  try {
    webpBlob = await canvasToBlob(canvas, "image/webp", QUALITY_WEBP);
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
