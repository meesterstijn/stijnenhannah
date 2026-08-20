import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameNightFaceCrop,
  type GameNightPlayer,
} from "@/lib/supabase";

// Game Night — persoonlijke face-layer opslaan/wissen via de smalle
// self-service-RPC (game_night_update_my_face, 20260918000000). Zelfde
// patroon als useUpdateMyProfile in useGameNightMemberProfile.ts: nooit een
// directe UPDATE op game_night_players vanaf de client.
export function useUpdateMyFace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      faceOriginalPath: string | null;
      faceAssetPath: string | null;
      faceCrop?: GameNightFaceCrop | null;
    }): Promise<GameNightPlayer> => {
      const { data, error } = await supabase.rpc("game_night_update_my_face", {
        p_face_original_path: input.faceOriginalPath,
        p_face_asset_path: input.faceAssetPath,
        p_face_crop: input.faceCrop ?? null,
      });
      if (error) throw error;
      return data as GameNightPlayer;
    },
    onSuccess: () => {
      // Zelfde query-key als useUpdateMyProfile — de eigen speler-rij zit
      // in de gedeelde analytics-batch, geen apart endpoint.
      queryClient.invalidateQueries({
        queryKey: ["game-night", "analytics-raw"],
      });
    },
  });
}
