import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  GameNightCharacterPart,
  GameNightColorPaletteEntry,
} from "@/lib/supabase";
import type { GuestFace } from "@/features/game-night/lib/guestIdentity";

export type GuestPlayer = {
  id: string;
  name: string;
  guest_face: GuestFace | null;
  color_id: string | null;
  color: string | null;
  body: GameNightCharacterPart | null;
};

export type GuestOptions = {
  valid: boolean;
  invitation?: { valid: boolean; game_night_name?: string };
  palette?: GameNightColorPaletteEntry[];
  bodies?: GameNightCharacterPart[];
  me?: GuestPlayer | null;
};

export type GuestState =
  | { valid: false }
  | {
      valid: true;
      session: {
        id: string;
        name: string;
        status: "active" | "paused" | "completed";
      };
      me: GuestPlayer;
      at_table: boolean;
      players: GuestPlayer[];
      game: { name: string; status: "active" | "paused" } | null;
    };

export type GuestProfileInput = {
  p_name: string;
  p_color_id: string | null;
  p_base_part_id: string | null;
  p_guest_face: GuestFace;
};

export function useGuestPlayers(joinToken?: string) {
  return useQuery({
    queryKey: ["game-night-guest-players", joinToken],
    queryFn: async (): Promise<{ valid: boolean; players?: GuestPlayer[] }> => {
      const { data, error } = await supabase.rpc("game_night_guest_players", {
        p_join_token: joinToken,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!joinToken,
    retry: false,
  });
}

export function useGuestOptions(guestToken: string | null, joinToken?: string) {
  return useQuery({
    queryKey: ["game-night-guest-options", guestToken, joinToken],
    queryFn: async (): Promise<GuestOptions> => {
      const { data, error } = await supabase.rpc("game_night_guest_options", {
        p_guest_token: guestToken,
        p_join_token: joinToken ?? null,
      });
      if (error) throw error;
      return data as GuestOptions;
    },
    enabled: !!(guestToken || joinToken),
    retry: false,
    staleTime: 30_000,
  });
}

export function useGuestState(
  guestToken: string | null,
  sessionId?: string,
  joinToken?: string,
) {
  return useQuery({
    queryKey: ["game-night-guest-state", guestToken, sessionId, joinToken],
    queryFn: async (): Promise<GuestState> => {
      const { data, error } = await supabase.rpc("game_night_guest_state", {
        p_guest_token: guestToken,
        p_session_id: sessionId ?? null,
        p_join_token: joinToken ?? null,
      });
      if (error) throw error;
      return data as GuestState;
    },
    enabled: !!guestToken && !!(sessionId || joinToken),
    retry: false,
    refetchInterval: (query) => {
      const state = query.state.data;
      return sessionId && state?.valid && state.session.status !== "completed"
        ? 5_000
        : false;
    },
    refetchIntervalInBackground: false,
  });
}
