// Supabase Storage helpers voor de PRIVATE 'game-night-checkpoints' bucket
// (20260912090000_game_night_checkpoint_photo_ux zet 'm van public naar
// private — kaarten-op-hand horen niet publiek bereikbaar te zijn via een
// kale URL). Zelfde upload/delete-vorm als
// src/features/tuingids/lib/growthPhotoStorage.ts, met één belangrijk
// verschil: lezen gaat via createSignedUrl (vereist een geldige owner-
// sessie), niet via getPublicUrl.
//
// deleteCheckpointPhotoFromStorage gooit NIET bij een Storage-fout — logt en
// gaat door, zodat de aanroeper in ieder geval de DB-rij nog kan opruimen.
// Een verweesd Storage-bestand is acceptabel; een verweesde DB-rij niet.

import { supabase } from "@/lib/supabase";
import type { OptimizedPhoto } from "./optimizeCheckpointPhoto";

export const CHECKPOINT_PHOTOS_BUCKET = "game-night-checkpoints";

// Ruim binnen de duur dat een checkpoint-editor of -viewer typisch open
// staat; useCheckpointPhotos ververst ruim vóór het verlopen (zie staleTime
// daar).
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export async function uploadCheckpointPhoto(
  checkpointId: string,
  photo: OptimizedPhoto,
): Promise<{ storagePath: string }> {
  const photoId = crypto.randomUUID();
  const storagePath = `${checkpointId}/${photoId}.${photo.extension}`;

  const { error } = await supabase.storage
    .from(CHECKPOINT_PHOTOS_BUCKET)
    .upload(storagePath, photo.blob, {
      contentType: photo.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Foto uploaden mislukt: ${error.message}`);
  }

  return { storagePath };
}

export async function deleteCheckpointPhotoFromStorage(
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(CHECKPOINT_PHOTOS_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(
      "[checkpointPhotoStorage] Storage verwijderen mislukt:",
      storagePath,
      error.message,
    );
  }
}

// Batch-variant (één API-call voor alle foto's van een checkpoint i.p.v.
// N losse round-trips).
export async function getCheckpointPhotoSignedUrls(
  storagePaths: string[],
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(CHECKPOINT_PHOTOS_BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_EXPIRY_SECONDS);

  if (error) throw error;

  const urlsByPath: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urlsByPath[item.path] = item.signedUrl;
  }
  return urlsByPath;
}
