// Storage-helpers voor de setup/bordfoto (V2.7A) — hergebruikt bewust
// DEZELFDE bucket als cover_storage_path (game-night-covers, zie
// gameCoverStorage.ts): de bestaande owner-only insert/update/delete-
// policies matchen generiek op bucket_id + het eerste padsegment als
// game_night_games.id (private.storage_first_segment_uuid), dus gelden al
// zonder wijziging voor setup-paden. Padconventie:
// <game_id>/setup-<uuid>.<ext> — de "setup-"-prefix houdt dit onderscheiden
// van een eventuele toekomstige cover-upload-feature in dezelfde map.
//
// Zelfde upload/delete-vorm als features/guitar/lib/albumCoverStorage.ts
// (`upsert: false` — nooit in-place overschrijven, altijd een nieuw object;
// een vervangen/verwijderde oude foto wordt best-effort uit Storage
// verwijderd, een falende Storage-delete is niet fataal — een verweesd
// bestand is acceptabel, een verweesde databaserij niet).

import { supabase } from "@/lib/supabase";
import type { OptimizedPhoto } from "@/features/game-night/lib/optimizeArenaSetupPhoto";

const GAME_NIGHT_COVERS_BUCKET = "game-night-covers";

export function getGameSetupUrl(storagePath: string): string {
  return supabase.storage
    .from(GAME_NIGHT_COVERS_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl;
}

export type UploadedGameSetupPhoto = {
  storagePath: string;
  publicUrl: string;
};

export async function uploadGameSetupPhoto(
  gameId: string,
  photo: OptimizedPhoto,
): Promise<UploadedGameSetupPhoto> {
  const photoId = crypto.randomUUID();
  const storagePath = `${gameId}/setup-${photoId}.${photo.extension}`;

  const { error } = await supabase.storage
    .from(GAME_NIGHT_COVERS_BUCKET)
    .upload(storagePath, photo.blob, {
      contentType: photo.mimeType,
      upsert: false,
    });
  if (error) throw new Error(`Setupfoto uploaden mislukt: ${error.message}`);

  return { storagePath, publicUrl: getGameSetupUrl(storagePath) };
}

export async function deleteGameSetupPhotoFromStorage(
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(GAME_NIGHT_COVERS_BUCKET)
    .remove([storagePath]);
  if (error) {
    console.error(
      "[gameSetupStorage] Storage verwijderen mislukt:",
      storagePath,
      error.message,
    );
  }
}
