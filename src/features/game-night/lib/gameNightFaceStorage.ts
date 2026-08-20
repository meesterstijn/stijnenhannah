// Supabase Storage helpers for the game-night-player-faces bucket (PRIVATE
// — real selfies, see 20260918000000_game_night_player_face.sql). Paths
// follow: <player_id>/original.<ext> and <player_id>/face.<ext> — flat,
// mirrors growth-photos/cocktail-photos/game-night-checkpoints (see that
// migration for the RLS policies that rely on this exact convention via
// private.storage_first_segment_uuid()).
//
// Only the storage PATH is returned/stored (in game_night_players via
// game_night_update_my_face) — never a public URL, since the bucket is
// private. Rendering resolves a short-lived signed URL on demand, see
// useSignedFaceUrl.ts (used exclusively by CharacterVisual.tsx's
// "personal-face" layer).

import { supabase } from "@/lib/supabase";

export const PLAYER_FACES_BUCKET = "game-night-player-faces";

export type UploadedFacePhoto = {
  storagePath: string;
};

async function uploadPlayerFaceFile(
  playerId: string,
  filename: "original" | "face",
  blob: Blob,
  mimeType: string,
  extension: string,
): Promise<UploadedFacePhoto> {
  const storagePath = `${playerId}/${filename}.${extension}`;

  const { error } = await supabase.storage
    .from(PLAYER_FACES_BUCKET)
    .upload(storagePath, blob, {
      contentType: mimeType,
      // Bewust upsert:true (i.t.t. groei-/cocktailfoto's, die altijd een
      // nieuwe uuid-bestandsnaam krijgen): een speler heeft precies ÉÉN
      // origineel en ÉÉN afgeleide face tegelijk — "Gezicht wijzigen"
      // vervangt die twee bestanden op hun vaste pad, geen opeenstapeling
      // van oude versies.
      upsert: true,
    });

  if (error) {
    throw new Error(`Foto uploaden mislukt: ${error.message}`);
  }

  return { storagePath };
}

export function uploadPlayerFaceOriginal(
  playerId: string,
  blob: Blob,
  mimeType: string,
  extension: string,
): Promise<UploadedFacePhoto> {
  return uploadPlayerFaceFile(playerId, "original", blob, mimeType, extension);
}

export function uploadPlayerFaceAsset(
  playerId: string,
  blob: Blob,
): Promise<UploadedFacePhoto> {
  return uploadPlayerFaceFile(playerId, "face", blob, "image/png", "png");
}
