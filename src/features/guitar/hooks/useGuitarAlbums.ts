import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GuitarAlbum,
  type GuitarAlbumWithSongCount,
} from "@/lib/supabase";
import { deleteAlbumCoverFromStorage } from "@/features/guitar/lib/albumCoverStorage";

const ALBUMS_KEY = ["guitar", "albums"] as const;

async function fetchAlbums(): Promise<GuitarAlbumWithSongCount[]> {
  const { data, error } = await supabase
    .from("guitar_albums")
    .select("*, guitar_songs(count)")
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { guitar_songs, ...album } = row as GuitarAlbum & {
      guitar_songs: { count: number }[];
    };
    return { ...album, song_count: guitar_songs?.[0]?.count ?? 0 };
  });
}

export function useGuitarAlbums() {
  return useQuery({ queryKey: ALBUMS_KEY, queryFn: fetchAlbums });
}

export function useGuitarAlbum(albumId: string | undefined) {
  return useQuery({
    queryKey: ["guitar", "album", albumId],
    queryFn: async (): Promise<GuitarAlbum | null> => {
      if (!albumId) return null;
      const { data, error } = await supabase
        .from("guitar_albums")
        .select("*")
        .eq("id", albumId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!albumId,
  });
}

export type GuitarAlbumInput = {
  title: string;
  artist: string;
  description: string | null;
};

export function useSaveGuitarAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: string;
      input: GuitarAlbumInput;
    }): Promise<GuitarAlbum> => {
      if (id) {
        const { data, error } = await supabase
          .from("guitar_albums")
          .update(input)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("guitar_albums")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ALBUMS_KEY });
      queryClient.invalidateQueries({ queryKey: ["guitar", "songs"] });
    },
  });
}

/** Slaat het storage-pad van een geüploade cover op de albumrij op — apart van
 * useSaveGuitarAlbum omdat een cover pas geüpload kan worden nadat het
 * album-id bestaat (padconventie <album_id>/<uuid>.<ext>). */
export function useSetGuitarAlbumCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      storagePath,
    }: {
      id: string;
      storagePath: string;
    }) => {
      const { error } = await supabase
        .from("guitar_albums")
        .update({ cover_storage_path: storagePath })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ALBUMS_KEY });
    },
  });
}

export function useDeleteGuitarAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      album: Pick<GuitarAlbum, "id" | "cover_storage_path">,
    ) => {
      const { error } = await supabase
        .from("guitar_albums")
        .delete()
        .eq("id", album.id);
      if (error) throw error;
      if (album.cover_storage_path) {
        await deleteAlbumCoverFromStorage(album.cover_storage_path);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ALBUMS_KEY });
      queryClient.invalidateQueries({ queryKey: ["guitar", "songs"] });
    },
  });
}
