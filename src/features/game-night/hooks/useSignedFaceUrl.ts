import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PLAYER_FACES_BUCKET } from "@/features/game-night/lib/gameNightFaceStorage";

// Game Night — game-night-player-faces is een PRIVÉ bucket (echte selfies,
// zie 20260918000000_game_night_player_face.sql). `face_asset_path`/
// `face_original_path` op game_night_players zijn dus kale storage-paden,
// geen direct bruikbare URL's — deze hook lost er telkens één op naar een
// tijdelijke getekende URL. Uitsluitend gebruikt door CharacterVisual.tsx
// voor de ene "personal-face"-laag; alle overige (publieke, statische)
// character-onderdelen hebben dit niet nodig en blijven ongewijzigd direct
// via hun pad renderen — geen brede wijziging aan de rest van de app.
//
// `staleTime` ruim onder de expiry (1 uur, zie EXPIRES_IN_SECONDS): React
// Query haalt vanzelf een nieuwe getekende URL op zodra de oude te oud
// dreigt te worden (bv. bij een lang openstaande Lobby/Arena-pagina),
// zonder dat elke render een nieuwe aanroep doet.
const EXPIRES_IN_SECONDS = 60 * 60;
const STALE_TIME_MS = 45 * 60 * 1000;

export function useSignedFaceUrl(storagePath: string | null | undefined) {
  return useQuery({
    queryKey: ["game-night", "signed-face-url", storagePath],
    queryFn: async (): Promise<string> => {
      if (!storagePath) throw new Error("Geen storage-pad opgegeven");
      const { data, error } = await supabase.storage
        .from(PLAYER_FACES_BUCKET)
        .createSignedUrl(storagePath, EXPIRES_IN_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!storagePath,
    staleTime: STALE_TIME_MS,
  });
}
