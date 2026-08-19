// Setup/bordfoto's (V2.7A) — eigen naam/bestand i.p.v. optimizeCheckpointPhoto
// hergebruiken: functioneel identieke instellingen (leesbaarheid van een
// opgebouwd bord weegt hier net zo zwaar als bij checkpoints), maar een
// checkpoint is conceptueel iets anders (een moment TIJDENS het spel) dan
// een setupfoto (de vaste identiteit van het spel zelf) — zelfde bewezen
// decode/EXIF-oriëntatie/export-pijplijn als de rest van de site
// (src/lib/optimizeImage.ts).

import { optimizeImage, type OptimizedPhoto } from "@/lib/optimizeImage";

export type { OptimizedPhoto };

const MAX_SIDE_PX = 2200;
const QUALITY_WEBP = 0.88;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB (zelfde bovengrens als elders)

export async function optimizeArenaSetupPhoto(
  file: File,
): Promise<OptimizedPhoto> {
  return optimizeImage(file, {
    maxSidePx: MAX_SIDE_PX,
    quality: QUALITY_WEBP,
    maxFileBytes: MAX_FILE_BYTES,
  });
}
