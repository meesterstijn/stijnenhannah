import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameNightCheckpointPhoto,
  type GameNightCheckpointPhotoType,
} from "@/lib/supabase";
import {
  uploadCheckpointPhoto,
  deleteCheckpointPhotoFromStorage,
  getCheckpointPhotoSignedUrls,
} from "@/features/game-night/lib/checkpointPhotoStorage";
import type { OptimizedPhoto } from "@/features/game-night/lib/optimizeCheckpointPhoto";

export type CheckpointPhotoWithUrl = GameNightCheckpointPhoto & {
  url: string | null;
};

const PHOTOS_KEY = (checkpointId: string | undefined) =>
  ["game-night", "checkpoint-photos", checkpointId] as const;

// Combineert de DB-rijen met getekende URL's (sectie 22/35: private bucket,
// dus getPublicUrl bestaat hier niet meer). Eén batch-aanroep voor alle
// foto's van dit checkpoint i.p.v. N losse round-trips. staleTime ruim
// onder de 1 uur geldigheid van de getekende URL's (zie
// checkpointPhotoStorage.ts), zodat een checkpoint dat lang open staat op
// tijd ververst.
export function useCheckpointPhotos(checkpointId: string | undefined) {
  return useQuery({
    queryKey: PHOTOS_KEY(checkpointId),
    queryFn: async (): Promise<CheckpointPhotoWithUrl[]> => {
      if (!checkpointId) return [];
      const { data, error } = await supabase
        .from("game_night_checkpoint_photos")
        .select("*")
        .eq("checkpoint_id", checkpointId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const photos = data ?? [];
      const urls = await getCheckpointPhotoSignedUrls(
        photos.map((p) => p.storage_path),
      );
      return photos.map((p) => ({ ...p, url: urls[p.storage_path] ?? null }));
    },
    enabled: !!checkpointId,
    staleTime: 45 * 60 * 1000,
  });
}

// `checkpointId` gaat hier bewust MEE IN de mutatie-payload i.p.v. als
// hook-parameter: het checkpoint wordt lazy aangemaakt (bij de eerste
// foto), en een hook-parameter zou het id van het moment van instantiëren
// "bevriezen" in de closure — bij een snel opeenvolgende ensureCheckpoint()
// + mutateAsync() zou dat nog het (stale) null-id kunnen gebruiken. Door
// het id expliciet per aanroep mee te geven is dat risico weg.
export function useAddCheckpointPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      checkpointId: string;
      photo: OptimizedPhoto;
      photoType: GameNightCheckpointPhotoType;
      caption?: string | null;
      playerId?: string | null;
    }): Promise<GameNightCheckpointPhoto> => {
      const { storagePath } = await uploadCheckpointPhoto(
        input.checkpointId,
        input.photo,
      );

      const { count, error: countError } = await supabase
        .from("game_night_checkpoint_photos")
        .select("id", { count: "exact", head: true })
        .eq("checkpoint_id", input.checkpointId);
      if (countError) throw countError;

      const { data, error } = await supabase
        .from("game_night_checkpoint_photos")
        .insert({
          checkpoint_id: input.checkpointId,
          storage_path: storagePath,
          photo_type: input.photoType,
          caption: input.caption?.trim() || null,
          player_id: input.playerId ?? null,
          sort_order: count ?? 0,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (photo) => {
      queryClient.invalidateQueries({
        queryKey: PHOTOS_KEY(photo.checkpoint_id),
      });
    },
  });
}

export function useDeleteCheckpointPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      photo: Pick<
        GameNightCheckpointPhoto,
        "id" | "storage_path" | "checkpoint_id"
      >,
    ): Promise<GameNightCheckpointPhoto["checkpoint_id"]> => {
      await deleteCheckpointPhotoFromStorage(photo.storage_path);
      const { error } = await supabase
        .from("game_night_checkpoint_photos")
        .delete()
        .eq("id", photo.id);
      if (error) throw error;
      return photo.checkpoint_id;
    },
    onSuccess: (checkpointId) => {
      queryClient.invalidateQueries({ queryKey: PHOTOS_KEY(checkpointId) });
    },
  });
}

// Simpele buur-wissel i.p.v. algemene drag-and-drop (sectie 20: "anders
// grote links/rechts-bediening" — touch-first, geen desktop-mouse-only
// dependency).
export function useSwapPhotoSortOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      checkpointId: string;
      a: { id: string; sort_order: number };
      b: { id: string; sort_order: number };
    }): Promise<string> => {
      const { error: errorA } = await supabase
        .from("game_night_checkpoint_photos")
        .update({ sort_order: input.b.sort_order })
        .eq("id", input.a.id);
      if (errorA) throw errorA;

      const { error: errorB } = await supabase
        .from("game_night_checkpoint_photos")
        .update({ sort_order: input.a.sort_order })
        .eq("id", input.b.id);
      if (errorB) throw errorB;

      return input.checkpointId;
    },
    onSuccess: (checkpointId) => {
      queryClient.invalidateQueries({ queryKey: PHOTOS_KEY(checkpointId) });
    },
  });
}
