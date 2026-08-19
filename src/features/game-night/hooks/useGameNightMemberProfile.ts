import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameNightColorPaletteEntry,
  type GameNightPlayer,
} from "@/lib/supabase";

// Game Night V2.3 — member-/eigen-profielfunctionaliteit. Alle schrijfacties
// gaan via de smalle, server-side gecontroleerde RPC's uit
// 20260912150000_game_night_member_auth.sql — nooit een brede directe
// UPDATE op game_night_players vanaf de client (zie de motivatie in die
// migratie: game_night_players heeft te veel owner-only kolommen voor een
// veilige kolom-grant-restrictie).

const COLOR_PALETTE_KEY = ["game-night", "color-palette"] as const;

// Alleen actieve kleuren — voor owner filtert de RLS niets extra weg (owner
// ziet alles via de eigen ALL-policy), dus deze `.eq` is de daadwerkelijke
// grens voor "welke kleuren mag je KIEZEN" voor iedereen die deze hook
// gebruikt, ongeacht rol.
export function useGameNightColorPalette() {
  return useQuery({
    queryKey: COLOR_PALETTE_KEY,
    queryFn: async (): Promise<GameNightColorPaletteEntry[]> => {
      const { data, error } = await supabase
        .from("game_night_color_palette")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Eigen nickname/kleur/character bijwerken (sectie 12, V2.8 sectie 5/14
// uitgebreid met character_id). De RPC zoekt de rij zelf op via
// auth_user_id = auth.uid() — er wordt hier bewust geen player-id
// meegegeven, dat zou spoofbare input zijn (sectie 25).
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nickname: string;
      colorId: string | null;
      // Verplicht (niet optioneel): de RPC zet character_id onvoorwaardelijk
      // op deze waarde — een aanroep die dit veld "vergeet" zou een al
      // gekozen character stilzwijgend wissen. Elke caller moet dus altijd
      // de HUIDIGE (of nieuw gekozen) waarde meesturen, ook als alleen
      // nickname/kleur wijzigen.
      characterId: string | null;
    }): Promise<GameNightPlayer> => {
      const { data, error } = await supabase.rpc(
        "game_night_update_my_profile",
        {
          p_nickname: input.nickname,
          p_color_id: input.colorId,
          p_character_id: input.characterId,
        },
      );
      if (error) throw error;
      return data as GameNightPlayer;
    },
    onSuccess: () => {
      // De eigen speler-rij zit in de gedeelde analytics-batch (geen apart
      // "mijn profiel"-endpoint, zie GameNightMe.tsx) — die query ongeldig
      // maken laat nickname/kleur overal direct kloppen, ook op Hall of
      // Fame/spelerslijst/-profiel.
      queryClient.invalidateQueries({
        queryKey: ["game-night", "analytics-raw"],
      });
    },
  });
}

// Owner-only: de HUIDIGE rol van een doelaccount opzoeken vóórdat er
// gekoppeld wordt (review-correctie sectie 3) — het systeem is voorlopig
// single-role (zie de migratie), dus koppelen aan een 'r6_player'/
// 'cocktail_guest'-account vervangt stilzwijgend die rol. Deze lookup maakt
// dat zichtbaar op het moment van beslissen i.p.v. alleen achteraf in een
// rapport. Leunt op de bestaande "Owner reads all profiles"-policy
// (`private.is_owner() or id = auth.uid()`) — geen nieuwe RLS nodig.
export function useProfileRoleLookup(authUserId: string | null) {
  return useQuery({
    queryKey: ["game-night", "profile-role-lookup", authUserId],
    queryFn: async (): Promise<string | null> => {
      if (!authUserId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("app_role")
        .eq("id", authUserId)
        .maybeSingle();
      if (error) throw error;
      return data?.app_role ?? null;
    },
    enabled: !!authUserId,
  });
}

// ── Owner: account koppelen/ontkoppelen (sectie 14-15) ────────────────────
export function useLinkPlayerAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      playerId: string;
      authUserId: string;
    }): Promise<GameNightPlayer> => {
      const { data, error } = await supabase.rpc(
        "game_night_link_player_account",
        { p_player_id: input.playerId, p_auth_user_id: input.authUserId },
      );
      if (error) throw error;
      return data as GameNightPlayer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["game-night", "analytics-raw"],
      });
    },
  });
}

export function useUnlinkPlayerAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string): Promise<GameNightPlayer> => {
      const { data, error } = await supabase.rpc(
        "game_night_unlink_player_account",
        { p_player_id: playerId },
      );
      if (error) throw error;
      return data as GameNightPlayer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["game-night", "analytics-raw"],
      });
    },
  });
}
