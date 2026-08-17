// Storage-URL-helper voor de game-night-covers-bucket — zelfde patroon als
// albumCoverStorage.ts in de Gitaar-module. Geen upload-flow in deze stap
// (V1 heeft geen "spel toevoegen"-UI); alleen de getter, zodat covers die
// later handmatig (of via een toekomstige beheer-UI) geüpload worden
// meteen tonen.

import { supabase } from "@/lib/supabase";

export const GAME_NIGHT_COVERS_BUCKET = "game-night-covers";

export function getGameCoverUrl(storagePath: string): string {
  return supabase.storage
    .from(GAME_NIGHT_COVERS_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl;
}
