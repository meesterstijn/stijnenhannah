import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GuitarSong,
  type GuitarSongWithAlbum,
} from "@/lib/supabase";

const SONGS_KEY = ["guitar", "songs"] as const;
const SONG_SELECT =
  "*, album:guitar_albums(id, title, artist, cover_storage_path)";

export function useGuitarSongs() {
  return useQuery({
    queryKey: SONGS_KEY,
    queryFn: async (): Promise<GuitarSongWithAlbum[]> => {
      const { data, error } = await supabase
        .from("guitar_songs")
        .select(SONG_SELECT)
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GuitarSongWithAlbum[];
    },
  });
}

export function useGuitarSong(songId: string | undefined) {
  return useQuery({
    queryKey: ["guitar", "song", songId],
    queryFn: async (): Promise<GuitarSongWithAlbum | null> => {
      if (!songId) return null;
      const { data, error } = await supabase
        .from("guitar_songs")
        .select(SONG_SELECT)
        .eq("id", songId)
        .single();
      if (error) throw error;
      return data as unknown as GuitarSongWithAlbum;
    },
    enabled: !!songId,
  });
}

export function useGuitarSongsByAlbum(albumId: string | undefined) {
  return useQuery({
    queryKey: ["guitar", "songs", "album", albumId],
    queryFn: async (): Promise<GuitarSong[]> => {
      if (!albumId) return [];
      const { data, error } = await supabase
        .from("guitar_songs")
        .select("*")
        .eq("album_id", albumId)
        .order("title", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!albumId,
  });
}

export type GuitarSongInput = {
  title: string;
  artist: string;
  album_id: string | null;
  original_key: string;
  bpm: number | null;
  source_url: string | null;
  content: string;
};

function invalidateSongQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: SONGS_KEY });
  queryClient.invalidateQueries({ queryKey: ["guitar", "album"] });
  queryClient.invalidateQueries({ queryKey: ["guitar", "albums"] });
}

export function useSaveGuitarSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: string;
      input: GuitarSongInput;
    }): Promise<GuitarSong> => {
      if (id) {
        const { data, error } = await supabase
          .from("guitar_songs")
          .update(input)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("guitar_songs")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSongQueries(queryClient),
  });
}

export function useDeleteGuitarSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("guitar_songs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSongQueries(queryClient),
  });
}

export function useToggleGuitarSongFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, favorite }: { id: string; favorite: boolean }) => {
      const { error } = await supabase
        .from("guitar_songs")
        .update({ favorite })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSongQueries(queryClient),
  });
}

/** Client-side zoeken op titel/artiest/album — de bibliotheek van één
 * huishouden blijft klein genoeg om niet server-side te hoeven filteren. */
export function filterGuitarSongs(
  songs: GuitarSongWithAlbum[],
  query: string,
): GuitarSongWithAlbum[] {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter(
    (song) =>
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q) ||
      (song.album?.title.toLowerCase().includes(q) ?? false),
  );
}
