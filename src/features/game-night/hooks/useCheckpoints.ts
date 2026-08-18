import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GameNightCheckpoint } from "@/lib/supabase";
import { deleteCheckpointPhotoFromStorage } from "@/features/game-night/lib/checkpointPhotoStorage";
import { getCheckpointPhotoSignedUrls } from "@/features/game-night/lib/checkpointPhotoStorage";
import type { CheckpointPhotoWithUrl } from "@/features/game-night/hooks/useCheckpointPhotos";
import {
  isCeremonySafePhotoType,
  pickRepresentativePhotosPerSession,
  selectFinalePhotos,
  type FinalePhoto,
} from "@/features/game-night/lib/gameNightFinale";

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

// Aantal checkpoints per spelsessie, voor bv. een "N spelstanden"-label bij
// meerdere recente potjes tegelijk (speldetail, Game Night V6 sectie 23/34)
// — ÉÉN `.in(...)`-query voor de hele set game_session_id's i.p.v.
// useCheckpointsForSession N keer in een .map() aanroepen (dat zou N losse
// network-requests + N keer signed-URL-ophalen betekenen, wat hier niet
// eens nodig is: alleen het AANTAL is nodig, geen foto's/URL's).
export function useCheckpointCountsForGameSessions(gameSessionIds: string[]) {
  const sortedIds = [...gameSessionIds].sort();
  return useQuery({
    queryKey: ["game-night", "checkpoint-counts", sortedIds] as const,
    queryFn: async (): Promise<Map<string, number>> => {
      if (sortedIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from("game_night_checkpoints")
        .select("game_session_id")
        .in("game_session_id", sortedIds);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        counts.set(
          row.game_session_id,
          (counts.get(row.game_session_id) ?? 0) + 1,
        );
      }
      return counts;
    },
    enabled: sortedIds.length > 0,
  });
}

// "Momenten van de avond" (Game Night V7, sectie 22-25): twee queries
// totaal voor de HELE finale — alle checkpoints van de gegeven spelsessies
// in één `.in(...)`, dan hun foto's in één tweede `.in(...)` — nooit een
// aparte query per spelsessie of per checkpoint. Verborgen foto-typen
// (cards/player) worden hier al weggefilterd vóórdat er ook maar één
// signed URL voor aangevraagd wordt (sectie 25: geen signed URLs voor
// foto's die de ceremonie toch nooit toont). De uiteindelijke selectie
// (max 1 per sessie, max 4 totaal) is pure logica in gameNightFinale.ts.
export function useFinalePhotos(gameSessionIds: string[]) {
  const sortedIds = [...gameSessionIds].sort();
  return useQuery({
    queryKey: ["game-night", "finale-photos", sortedIds] as const,
    queryFn: async (): Promise<FinalePhoto[]> => {
      if (sortedIds.length === 0) return [];

      const { data: checkpoints, error: checkpointError } = await supabase
        .from("game_night_checkpoints")
        .select("id, game_session_id, created_at")
        .in("game_session_id", sortedIds)
        .order("created_at", { ascending: true });
      if (checkpointError) throw checkpointError;
      if (!checkpoints || checkpoints.length === 0) return [];

      const { data: photos, error: photoError } = await supabase
        .from("game_night_checkpoint_photos")
        .select("*")
        .in(
          "checkpoint_id",
          checkpoints.map((c) => c.id),
        )
        .order("sort_order", { ascending: true });
      if (photoError) throw photoError;

      const safePhotos = (photos ?? []).filter((p) =>
        isCeremonySafePhotoType(p.photo_type),
      );
      if (safePhotos.length === 0) return [];

      const urls = await getCheckpointPhotoSignedUrls(
        safePhotos.map((p) => p.storage_path),
      );
      const safePhotosByCheckpoint = new Map<
        string,
        CheckpointPhotoWithUrl[]
      >();
      for (const photo of safePhotos) {
        const withUrl: CheckpointPhotoWithUrl = {
          ...photo,
          url: urls[photo.storage_path] ?? null,
        };
        const arr = safePhotosByCheckpoint.get(photo.checkpoint_id) ?? [];
        arr.push(withUrl);
        safePhotosByCheckpoint.set(photo.checkpoint_id, arr);
      }

      const perSession = pickRepresentativePhotosPerSession(
        checkpoints,
        safePhotosByCheckpoint,
      );
      return selectFinalePhotos(perSession);
    },
    enabled: sortedIds.length > 0,
  });
}
