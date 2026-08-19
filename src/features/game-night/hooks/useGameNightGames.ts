import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameDifficulty,
  type GameNightArenaStyle,
  type GameNightArenaSymbol,
  type GameNightCelebrationStyle,
  type GameNightGame,
  type GameResultMode,
} from "@/lib/supabase";

const GAMES_KEY = ["game-night", "games"] as const;

export function useGameNightGames() {
  return useQuery({
    queryKey: GAMES_KEY,
    queryFn: async (): Promise<GameNightGame[]> => {
      // archived_at (toegevoegd in 20260912020000) verbergt een spel met
      // gespeelde geschiedenis uit de actieve spellenkast zonder de rij of
      // zijn resultaten te verwijderen (sectie 27) — nog geen UI om een
      // spel te archiveren, maar de query moet het gedrag al respecteren.
      const { data, error } = await supabase
        .from("game_night_games")
        .select("*")
        .is("archived_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type GameFlowConfig = {
  uses_rounds: boolean;
  track_round_results: boolean;
  has_session_winner: boolean;
  result_mode: GameResultMode;
};

// "Spelverloop"-instellingen (Spellenkast-correctie): schrijft rechtstreeks
// naar game_night_games, dus persistent en meteen van toepassing op elke
// NIEUWE spelsessie van dit spel. Lopende/historische spelsessies lezen hun
// eigen configuratiesnapshot (zie GameNightGameSession) en veranderen hier
// dus niet door — precies zoals de opdracht (sectie 29-31) vereist.
export function useUpdateGameFlowConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameId: string;
      config: GameFlowConfig;
    }): Promise<GameNightGame> => {
      const { data, error } = await supabase
        .from("game_night_games")
        .update(input.config)
        .eq("id", input.gameId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAMES_KEY });
    },
  });
}

export type GameInfo = {
  min_players: number | null;
  max_players: number | null;
  duration_minutes: number | null;
  difficulty: GameDifficulty | null;
  tags: string[];
};

// "Spelinfo"-sectie (Game Night V4, sectie 25): min/max spelers, duur,
// moeilijkheid en tags bestonden al als kolommen op game_night_games
// (result-config-migratie/seed) maar hadden nog geen bewerk-UI — dit is
// dus de eerste keer dat ze schrijfbaar worden, geen nieuwe velden.
export function useUpdateGameInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameId: string;
      info: GameInfo;
    }): Promise<GameNightGame> => {
      const { data, error } = await supabase
        .from("game_night_games")
        .update(input.info)
        .eq("id", input.gameId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAMES_KEY });
    },
  });
}

// Game Night V2.7A — "Game Arena"-configuratie (sectie 13). Rechtstreekse
// update naar game_night_games, zelfde patroon als useUpdateGameFlowConfig/
// useUpdateGameInfo hierboven (owner-only RLS, geen RPC nodig). Kleur-/
// taglinevalidatie en -normalisatie gebeurt server-side in de
// 20260912200000-trigger — een ongeldige waarde komt hier terug als een
// Postgres-fout (errcode 22023) die de UI als opslagfout toont.
export type GameArenaConfig = {
  arena_primary_color: string | null;
  arena_secondary_color: string | null;
  arena_style: GameNightArenaStyle | null;
  arena_symbol: GameNightArenaSymbol | null;
  arena_tagline: string | null;
  celebration_style: GameNightCelebrationStyle | null;
};

export function useUpdateGameArenaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameId: string;
      config: GameArenaConfig;
    }): Promise<GameNightGame> => {
      const { data, error } = await supabase
        .from("game_night_games")
        .update(input.config)
        .eq("id", input.gameId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAMES_KEY });
    },
  });
}

// Setup/bordfoto (sectie 3/14) — losstaand van useUpdateGameArenaConfig
// zodat de upload-mutatie (Storage-schrijf + pas daarna deze kolomupdate)
// dezelfde tweestaps-vorm volgt als useSetGuitarAlbumCover: het bestand
// moet eerst succesvol naar Storage geschreven zijn vóórdat het pad in de
// rij belandt, nooit andersom. `storagePath: null` verwijdert de setupfoto
// (het bestand zelf uit Storage verwijderen is de verantwoordelijkheid van
// de aanroeper, via deleteGameSetupPhotoFromStorage — zie GameFlowSettingsSheet).
export function useSetGameSetupPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameId: string;
      storagePath: string | null;
    }): Promise<GameNightGame> => {
      const { data, error } = await supabase
        .from("game_night_games")
        .update({ setup_storage_path: input.storagePath })
        .eq("id", input.gameId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAMES_KEY });
    },
  });
}
