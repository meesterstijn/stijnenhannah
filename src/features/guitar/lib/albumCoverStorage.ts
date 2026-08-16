// Supabase Storage helpers voor de guitar-album-covers-bucket — mirrort
// cocktailPhotoStorage.ts/growthPhotoStorage.ts exact (pad, upload-opties,
// non-throwing delete). Pad: <album_id>/<uuid>.<ext>.

import { supabase } from "@/lib/supabase";
import type { OptimizedPhoto } from "@/features/tuingids/lib/optimizeGrowthPhoto";

export const GUITAR_ALBUM_COVERS_BUCKET = "guitar-album-covers";

export function getAlbumCoverUrl(storagePath: string): string {
  return supabase.storage
    .from(GUITAR_ALBUM_COVERS_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl;
}

export type UploadedAlbumCover = {
  storagePath: string;
  publicUrl: string;
};

export async function uploadAlbumCover(
  albumId: string,
  photo: OptimizedPhoto,
): Promise<UploadedAlbumCover> {
  const photoId = crypto.randomUUID();
  const storagePath = `${albumId}/${photoId}.${photo.extension}`;

  const { error } = await supabase.storage
    .from(GUITAR_ALBUM_COVERS_BUCKET)
    .upload(storagePath, photo.blob, {
      contentType: photo.mimeType,
      upsert: false,
    });
  if (error) throw new Error(`Cover uploaden mislukt: ${error.message}`);

  return { storagePath, publicUrl: getAlbumCoverUrl(storagePath) };
}

export async function deleteAlbumCoverFromStorage(
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(GUITAR_ALBUM_COVERS_BUCKET)
    .remove([storagePath]);
  if (error) {
    // Niet-fataal: een verweesd Storage-bestand is acceptabel, een
    // verweesde DB-rij niet — zelfde afweging als de andere featurebuckets.
    console.error(
      "[albumCoverStorage] Storage verwijderen mislukt:",
      storagePath,
      error.message,
    );
  }
}
