// Thin wrapper around the shared src/lib/optimizeImage.ts pipeline, with
// this feature's original constants — unchanged behavior (1600px longest
// side, WebP @ 0.82, 20MB input cap). Extracted to a shared module so Game
// Night's checkpoint photos (src/features/game-night/lib/optimizeCheckpointPhoto.ts)
// could reuse the exact same decode/EXIF-orientation/export logic with
// their own size/quality trade-off, instead of a second image pipeline.

import { optimizeImage, type OptimizedPhoto } from "@/lib/optimizeImage";

export type { OptimizedPhoto };

const MAX_SIDE_PX = 1600;
const QUALITY_WEBP = 0.82;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function optimizeGrowthPhoto(file: File): Promise<OptimizedPhoto> {
  return optimizeImage(file, {
    maxSidePx: MAX_SIDE_PX,
    quality: QUALITY_WEBP,
    maxFileBytes: MAX_FILE_BYTES,
  });
}
