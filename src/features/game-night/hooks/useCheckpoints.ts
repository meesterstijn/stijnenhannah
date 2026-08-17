import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GameNightCheckpoint } from "@/lib/supabase";
import { deleteCheckpointPhotoFromStorage } from "@/features/game-night/lib/checkpointPhotoStorage";

const CHECKPOINTS_KEY = (gameSessionId: string | undefined) =>
  ["game-night", "checkpoints", gameSessionId] as const;

export function useCheckpointsForSession(gameSessionId: string | undefined) {
  return useQuery({
    queryKey: CHECKPOINTS_KEY(gameSessionId),
    queryFn: async (): Promise<GameNightCheckpoint[]> => {
      if (!gameSessionId) return [];
      const { data, error } = await supabase
        .from("game_night_checkpoints")
        .select("*")
        .eq("game_session_id", gameSessionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!gameSessionId,
  });
}

// Voor "Laatste spelstand" op het gepauzeerde scherm (sectie 27) — gewoon
// de eerste rij van dezelfde, al aflopend gesorteerde lijst.
export function useLatestCheckpoint(gameSessionId: string | undefined) {
  const { data: checkpoints, ...rest } =
    useCheckpointsForSession(gameSessionId);
  return { data: checkpoints?.[0] ?? null, ...rest };
}

// Sectie 32: automatische naam ("Stand N") komt server-side uit de RPC —
// geen racegevoelige client-only telling. Ook meteen de plek waar
// round_id (sectie 33, alleen relevant bij rondespellen) wordt meegegeven.
export function useCreateCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameSessionId: string;
      title?: string | null;
      notes?: string | null;
      roundId?: string | null;
    }): Promise<GameNightCheckpoint> => {
      const { data, error } = await supabase.rpc(
        "game_night_create_checkpoint",
        {
          p_game_session_id: input.gameSessionId,
          p_title: input.title ?? null,
          p_notes: input.notes ?? null,
          p_round_id: input.roundId ?? null,
        },
      );
      if (error) throw error;
      return data as GameNightCheckpoint;
    },
    onSuccess: (checkpoint) => {
      queryClient.invalidateQueries({
        queryKey: CHECKPOINTS_KEY(checkpoint.game_session_id),
      });
    },
  });
}

// Werkt titel/notitie bij op een checkpoint dat al bestaat (sectie 14: het
// checkpoint-record kan lazy bij de eerste foto aangemaakt zijn, vóórdat de
// gebruiker een titel intypt — de definitieve "Spelstand opslaan" schrijft
// die dan hier alsnog weg).
export function useUpdateCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      checkpointId: string;
      gameSessionId: string;
      title?: string | null;
      notes?: string | null;
    }): Promise<GameNightCheckpoint> => {
      const { data, error } = await supabase
        .from("game_night_checkpoints")
        .update({
          title: input.title?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .eq("id", input.checkpointId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (checkpoint) => {
      queryClient.invalidateQueries({
        queryKey: CHECKPOINTS_KEY(checkpoint.game_session_id),
      });
    },
  });
}

// Alleen gebruikt om een checkpoint op te ruimen dat lazy is aangemaakt
// (bij de eerste foto) maar waar de gebruiker de hele "Stand opslaan"-flow
// zonder iets bruikbaars annuleert (geen foto's, geen titel/notitie) — een
// checkpoint MET foto's wordt nooit automatisch verwijderd, dat is geldige
// data.
export function useDeleteEmptyCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      checkpointId: string;
      gameSessionId: string;
    }): Promise<void> => {
      const { error } = await supabase
        .from("game_night_checkpoints")
        .delete()
        .eq("id", input.checkpointId);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: CHECKPOINTS_KEY(input.gameSessionId),
      });
    },
  });
}

// Verwijdert een checkpoint MET al zijn foto's (Storage + DB, de DB-rijen
// gaan sowieso via ON DELETE CASCADE, maar de Storage-bestanden moeten
// expliciet opgeruimd worden vóórdat de rij verdwijnt).
export function useDeleteCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      checkpointId: string;
      gameSessionId: string;
      storagePaths: string[];
    }): Promise<void> => {
      for (const path of input.storagePaths) {
        await deleteCheckpointPhotoFromStorage(path);
      }
      const { error } = await supabase
        .from("game_night_checkpoints")
        .delete()
        .eq("id", input.checkpointId);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: CHECKPOINTS_KEY(input.gameSessionId),
      });
    },
  });
}
