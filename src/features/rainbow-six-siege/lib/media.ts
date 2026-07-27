// Supabase Storage helpers voor de r6-session-media bucket. Zelfde patroon
// als src/features/tuingids/lib/growthPhotoStorage.ts: alleen storage_path
// wordt in de database bewaard, de publieke URL wordt telkens afgeleid
// (goedkope stringopbouw, geen netwerkcall) — nooit apart opgeslagen.
//
// Twee verschillende opruimstrategieën, bewust:
// - deleteR6MediaFromStorage: voor het verwijderen van ÉÉN foto (losse
//   knop in de galerij). Best-effort — logt een Storage-fout en gaat door,
//   zodat de DB-rij hoe dan ook verdwijnt. Een enkel verweesd bestand hier
//   is een acceptabel, klein risico bij een normale losse verwijdering.
// - deleteR6SessionStorageFilesOrThrow: voor het verwijderen van een HELE
//   sessie (zie deleteR6Session in sessions.ts). Gooit wél een fout door
//   als Storage niet bevestigt dat de opruiming gelukt is, zodat de
//   aanroeper de sessierij NIET verwijdert wanneer de bestanden mogelijk
//   nog bestaan — zie de toelichting bij die functie voor de precieze
//   garanties (en de grenzen daarvan).

import { supabase } from "@/lib/supabase";
import type { OptimizedPhoto } from "@/features/tuingids/lib/optimizeGrowthPhoto";
import type { R6SessionMedia } from "@/features/rainbow-six-siege/types";

export const R6_SESSION_MEDIA_BUCKET = "r6-session-media";

export async function fetchR6SessionMedia(sessionId: string): Promise<R6SessionMedia[]> {
  const { data, error } = await supabase
    .from("r6_session_media")
    .select("id, session_id, match_id, storage_path, media_type, caption, sort_order, taken_at, created_at")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as R6SessionMedia[];
}

export async function insertR6SessionMediaRow(row: {
  session_id: string;
  match_id: string | null;
  storage_path: string;
  caption: string | null;
}): Promise<void> {
  const { error } = await supabase.from("r6_session_media").insert({ ...row, media_type: "image" });
  if (error) throw error;
}

export async function deleteR6SessionMediaRow(id: string): Promise<void> {
  const { error } = await supabase.from("r6_session_media").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadR6SessionMedia(sessionId: string, photo: OptimizedPhoto): Promise<string> {
  const photoId = crypto.randomUUID();
  const storagePath = `${sessionId}/${photoId}.${photo.extension}`;

  const { error } = await supabase.storage.from(R6_SESSION_MEDIA_BUCKET).upload(storagePath, photo.blob, {
    contentType: photo.mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Foto uploaden mislukt: ${error.message}`);
  }

  return storagePath;
}

export function getR6MediaPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(R6_SESSION_MEDIA_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function deleteR6MediaFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(R6_SESSION_MEDIA_BUCKET).remove([storagePath]);
  if (error) {
    console.error("[r6/media] Storage verwijderen mislukt:", storagePath, error.message);
  }
}

/**
 * Verwijdert meerdere Storage-bestanden in één call en gooit een fout als
 * dat niet lukt — gebruikt bij het verwijderen van een hele sessie, waar
 * we NIET stilzwijgend verder willen gaan met het verwijderen van de
 * databaserijen als de bestanden mogelijk nog bestaan.
 *
 * Eerlijke beperking: de Storage-API van Supabase geeft bij `remove()` geen
 * betrouwbare per-bestand bevestiging terug — de officiële documentatie
 * toont zelfs een voorbeeldrespons met `"data": []` bij een succesvolle
 * verwijdering. Het uitblijven van `error` is daarmee het sterkste signaal
 * dat de client-SDK biedt, maar geen waterdichte garantie dat elk
 * opgevraagd bestand ook echt (nog) bestond en is verwijderd. Een volledig
 * atomaire database- + Storage-transactie is via de normale client niet
 * mogelijk; zie het opleverrapport voor hoe hiermee wordt omgegaan.
 */
export async function deleteR6SessionStorageFilesOrThrow(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  const { error } = await supabase.storage.from(R6_SESSION_MEDIA_BUCKET).remove(storagePaths);
  if (error) {
    throw new Error(`Storage-opruiming mislukt: ${error.message}`);
  }
}
