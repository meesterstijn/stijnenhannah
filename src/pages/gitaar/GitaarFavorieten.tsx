import { Loader2 } from "lucide-react";
import {
  useGuitarSongs,
  useToggleGuitarSongFavorite,
} from "@/features/guitar/hooks/useGuitarSongs";
import { SongListRow } from "@/features/guitar/components/SongListRow";

export default function GitaarFavorieten() {
  const { data: songs = [], isLoading } = useGuitarSongs();
  const toggleFavorite = useToggleGuitarSongFavorite();
  const favorites = songs.filter((s) => s.favorite);

  return (
    <div className="space-y-6">
      <div>
        <p className="wa-eyebrow mb-1.5">Gitaar</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Favorieten
        </h1>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin wa-muted" />
      ) : favorites.length === 0 ? (
        <p className="wa-muted text-sm">
          Nog geen favoriete nummers. Tik op het hartje bij een nummer.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {favorites.map((song) => (
            <SongListRow
              key={song.id}
              song={song}
              onToggleFavorite={() =>
                toggleFavorite.mutate({ id: song.id, favorite: !song.favorite })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
