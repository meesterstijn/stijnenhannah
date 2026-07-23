// Compresses and resizes a user-selected image file in the browser before
// uploading to Supabase Storage. Goals: ≤ 1600 px on the longest side,
// WebP output at quality 0.82 (JPEG fallback), target ≈ 300–500 kB.
//
// Returns an OptimizedPhoto with the compressed Blob. Throws a Dutch-language
// Error on invalid input or when the browser cannot decode/encode the image.

const MAX_SIDE_PX = 1600;
const QUALITY = 0.82;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type OptimizedPhoto = {
  blob: Blob;
  mimeType: string;
  extension: string;
  originalFilename: string;
  fileSizeBytes: number;
};

export async function optimizeGrowthPhoto(file: File): Promise<OptimizedPhoto> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error(
      `Ongeldig bestandstype: ${file.type || "onbekend"}. Gebruik JPEG, PNG of WebP.`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Bestand te groot (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`,
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Afbeelding kan niet worden gelezen. Controleer of het bestand niet beschadigd is.");
  }

  const { width, height } = bitmap;

  // Scale down only — never upscale small images
  let targetWidth = width;
  let targetHeight = height;
  if (width > MAX_SIDE_PX || height > MAX_SIDE_PX) {
    if (width >= height) {
      targetWidth = MAX_SIDE_PX;
      targetHeight = Math.round((height / width) * MAX_SIDE_PX);
    } else {
      targetHeight = MAX_SIDE_PX;
      targetWidth = Math.round((width / height) * MAX_SIDE_PX);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Kan geen canvas aanmaken voor compressie.");
  }
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  // Try WebP first; fall back to JPEG when the browser doesn't support it
  const supportsWebP = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  const outputMime = supportsWebP ? "image/webp" : "image/jpeg";
  const outputExt = supportsWebP ? "webp" : "jpg";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Compressie mislukt. Probeer een andere foto."));
      },
      outputMime,
      QUALITY,
    );
  });

  return {
    blob,
    mimeType: outputMime,
    extension: outputExt,
    originalFilename: file.name,
    fileSizeBytes: blob.size,
  };
}
