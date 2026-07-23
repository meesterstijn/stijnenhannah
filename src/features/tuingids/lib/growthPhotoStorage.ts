// Supabase Storage helpers for the growth-photos bucket.
// All paths follow: <plant_instance_id>/<entry_id>/<photo_uuid>.<ext>
//
// deleteGrowthPhotoFromStorage does NOT throw on Storage errors — it logs
// the failure and returns normally so the caller can continue cleaning up
// other files or DB rows. Orphaned Storage files are acceptable; orphaned
// DB rows are not, so callers must handle that order themselves.

import { supabase } from "@/lib/supabase";
import type { OptimizedPhoto } from "./optimizeGrowthPhoto";

export const GROWTH_PHOTOS_BUCKET = "growth-photos";

export type UploadedGrowthPhoto = {
  storagePath: string;
  publicUrl: string;
};

export async function uploadGrowthPhoto(
  plantInstanceId: string,
  entryId: string,
  photo: OptimizedPhoto,
): Promise<UploadedGrowthPhoto> {
  const photoId = crypto.randomUUID();
  const storagePath = `${plantInstanceId}/${entryId}/${photoId}.${photo.extension}`;

  const { error } = await supabase.storage
    .from(GROWTH_PHOTOS_BUCKET)
    .upload(storagePath, photo.blob, {
      contentType: photo.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Foto uploaden mislukt: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(GROWTH_PHOTOS_BUCKET)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}

export async function deleteGrowthPhotoFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(GROWTH_PHOTOS_BUCKET)
    .remove([storagePath]);

  if (error) {
    // Non-fatal: log and continue. The DB row will still be removed by the
    // caller. An orphaned Storage file is acceptable; an orphaned DB row is not.
    console.error("[growthPhotoStorage] Storage verwijderen mislukt:", storagePath, error.message);
  }
}
