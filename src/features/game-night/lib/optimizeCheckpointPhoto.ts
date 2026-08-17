// Checkpoint-foto's bestaan om later kaarten/bordposities/nummers te
// kunnen reconstrueren (sectie 11/12) — leesbaarheid weegt zwaarder dan bij
// bv. groeifoto's, dus een grotere maximale lange zijde (2200px i.p.v.
// 1600px) en hogere WebP-kwaliteit. Zelfde bewezen decode/EXIF-oriëntatie/
// export-pijplijn als de rest van de site (src/lib/optimizeImage.ts).

import { optimizeImage, type OptimizedPhoto } from "@/lib/optimizeImage";

export type { OptimizedPhoto };

const MAX_SIDE_PX = 2200;
const QUALITY_WEBP = 0.88;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB (zelfde bovengrens als elders)

export async function optimizeCheckpointPhoto(
  file: File,
): Promise<OptimizedPhoto> {
  return optimizeImage(file, {
    maxSidePx: MAX_SIDE_PX,
    quality: QUALITY_WEBP,
    maxFileBytes: MAX_FILE_BYTES,
  });
}
