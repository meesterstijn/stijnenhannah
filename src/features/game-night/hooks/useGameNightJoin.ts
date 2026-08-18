import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Game Night V2.4 — telefoonkant van QR-join (/game-night/join/:token).
// useValidateJoinToken werkt ZONDER login (de RPC is aan `anon` gegrant) —
// dit is bewust de enige plek in de hele site waar een niet-ingelogde
// bezoeker iets uit Supabase mag lezen.

export type JoinTokenValidation =
  | { valid: true; gameNightName: string; startedAt: string }
  | { valid: false };

export function useValidateJoinToken(token: string | undefined) {
  return useQuery({
    queryKey: ["game-night", "validate-join-token", token],
    queryFn: async (): Promise<JoinTokenValidation> => {
      if (!token) return { valid: false };
      const { data, error } = await supabase.rpc(
        "game_night_validate_join_token",
        { p_token: token },
      );
      if (error) throw error;
      const result = data as {
        valid: boolean;
        game_night_name?: string;
        started_at?: string;
      };
      if (!result.valid) return { valid: false };
      return {
        valid: true,
        gameNightName: result.game_night_name ?? "Game Night",
        startedAt: result.started_at ?? new Date().toISOString(),
      };
    },
    enabled: !!token,
    // Het token kan tussentijds intrekken/verlopen — een korte staleTime
    // i.p.v. oneindig cachen, maar geen agressieve polling nodig.
    staleTime: 15_000,
    retry: false,
  });
}

// Alleen zinvol/toegestaan voor 'owner'/'game_night_member' (RLS) — beide
// rollen kunnen sowieso al een linked player hebben (r6_player/
// cocktail_guest/no_access kunnen dat per constructie nooit: elke flow die
// auth_user_id zet, zet in dezelfde stap ook de rol naar game_night_member,
// en V2.3's unlink zet 'm juist weer op null). GameNightJoin.tsx roept dit
// dus alleen aan wanneer `enabled` op basis van de huidige rol al vaststaat
// dat de check zinvol kán zijn — voor elke andere rol wordt gewoon
// aangenomen dat er nog geen gekoppelde speler is (altijd correct).
export function useMyLinkedPlayer(enabled: boolean) {
  return useQuery({
    queryKey: ["game-night", "my-linked-player"],
    queryFn: async (): Promise<{ id: string; name: string } | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("game_night_players")
        .select("id, name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled,
  });
}

export type JoinViaTokenResult = {
  playerId: string;
  name: string;
  nickname: string | null;
  gameNightSessionId: string;
  gameNightName: string;
};

export function useJoinViaToken() {
  return useMutation({
    mutationFn: async (input: {
      token: string;
      newPlayer?: {
        name: string;
        nickname?: string;
        colorId?: string | null;
      };
      // Correctie (sectie 6): server-side verplicht voor accounts die al
      // r6_player/cocktail_guest zijn — de RPC weigert zonder deze
      // bevestiging, geen stille rolvervanging. Voor elke andere rol
      // (no_access/game_night_member/owner) heeft dit geen effect.
      confirmRoleReplacement?: boolean;
    }): Promise<JoinViaTokenResult> => {
      const { data, error } = await supabase.rpc("game_night_join_via_token", {
        p_token: input.token,
        p_new_player_name: input.newPlayer?.name ?? null,
        p_new_player_nickname: input.newPlayer?.nickname ?? null,
        p_new_player_color_id: input.newPlayer?.colorId ?? null,
        p_confirm_role_replacement: input.confirmRoleReplacement ?? false,
      });
      if (error) throw error;
      const result = data as {
        player_id: string;
        name: string;
        nickname: string | null;
        game_night_session_id: string;
        game_night_name: string;
      };
      return {
        playerId: result.player_id,
        name: result.name,
        nickname: result.nickname,
        gameNightSessionId: result.game_night_session_id,
        gameNightName: result.game_night_name,
      };
    },
  });
}
