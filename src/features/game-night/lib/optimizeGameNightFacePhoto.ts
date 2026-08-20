// Thin wrapper around the shared src/lib/optimizeImage.ts pipeline, mirrors
// src/features/tuingids/lib/optimizeGrowthPhoto.ts. Used only for the
// ORIGINAL selfie upload (size cap before it goes to Storage) — the derived
// 512x512 canonical face is produced separately by
// renderCanonicalFaceCanvas() (gameNightFaceCanvas.ts), which needs an
// exact fixed export size, not this generic longest-side resize.

import { optimizeImage, type OptimizedPhoto } from "@/lib/optimizeImage";

export type { OptimizedPhoto };

const MAX_SIDE_PX = 1600;
const QUALITY_WEBP = 0.85;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function optimizeGameNightFacePhoto(
  file: File,
): Promise<OptimizedPhoto> {
  return optimizeImage(file, {
    maxSidePx: MAX_SIDE_PX,
    quality: QUALITY_WEBP,
    maxFileBytes: MAX_FILE_BYTES,
  });
}
