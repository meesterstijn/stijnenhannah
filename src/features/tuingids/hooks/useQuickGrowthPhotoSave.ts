import { useCallback } from "react";
import { useGrowthLog } from "./useGrowthLog";
import { useGrowthPhotos } from "./useGrowthPhotos";
import { optimizeGrowthPhoto } from "../lib/optimizeGrowthPhoto";
import { uploadGrowthPhoto } from "../lib/growthPhotoStorage";

/**
 * De gedeelde "Foto-laag": plant_instance_id + foto's bekend → precies
 * dezelfde minimale groeimoment-opslagroute als de bestaande snelle
 * groeifoto-functie. Geëxtraheerd uit QuickGrowthPhotoDialog zodat zowel de
 * QR-groeifotoflow als "Groeifoto maken" vanuit een al-geopend plantdetail
 * (en eventuele toekomstige flows) dezelfde route hergebruiken — geen tweede
 * upload-/logboekimplementatie.
 *
 * Schrijft bewust dezelfde minimale velden als altijd: height_cm/fruit-
 * metingen/notes blijven null/leeg, quantity blijft null (batchaantal wordt
 * elders bijgehouden, nooit hier). Werkt ongewijzigd voor zowel
 * tracking_mode "individual" als "batch" — er wordt altijd precies één
 * growth_log_entry aangemaakt, ongeacht quantity; nooit één entry per plant
 * in een batch.
 */
export function useQuickGrowthPhotoSave() {
  const { addEntryAsync, deleteEntry } = useGrowthLog();
  const { addPhoto } = useGrowthPhotos();

  const savePhotos = useCallback(
    async (args: {
      instanceId: string;
      instanceName: string;
      growingSeasonId: string | null;
      date: string;
      photos: File[];
    }): Promise<{ entryId: string }> => {
      const newEntry = await addEntryAsync({
        plant_id: null,
        plant_name: args.instanceName,
        plant_instance_id: args.instanceId,
        growing_season_id: args.growingSeasonId,
        date: args.date,
        notes: "",
        height_cm: null,
        flower_count: null,
        fruit_count: null,
        fruit_length_cm: null,
        fruit_width_cm: null,
        quantity: null,
        watered: false,
        fertilized: false,
        photo_url: "",
      });

      // Een entry zonder foto zou hier een half opgeslagen resultaat zijn —
      // deze route bestaat juist om een foto vast te leggen. Bij een
      // mislukte upload ruimen we de net aangemaakte entry weer op i.p.v.
      // 'm te laten staan (anders dan de algemene PlantLogboek-notitieflow,
      // waar een meting zonder foto wél een geldig resultaat is).
      try {
        for (const photo of args.photos) {
          const optimized = await optimizeGrowthPhoto(photo);
          const { storagePath, publicUrl } = await uploadGrowthPhoto(args.instanceId, newEntry.id, optimized);
          await addPhoto({
            growth_log_entry_id: newEntry.id,
            plant_instance_id: args.instanceId,
            storage_path: storagePath,
            photo_url: publicUrl,
            original_filename: optimized.originalFilename,
            mime_type: optimized.mimeType,
            file_size_bytes: optimized.fileSizeBytes,
          });
        }
      } catch (err) {
        deleteEntry(newEntry.id);
        throw err;
      }

      return { entryId: newEntry.id };
    },
    [addEntryAsync, deleteEntry, addPhoto],
  );

  return { savePhotos };
}
