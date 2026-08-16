import { Loader2 } from "lucide-react";
import { useRecentlyPlayedGuitarSongs } from "@/features/guitar/hooks/useRecentlyPlayedSongs";
import { useToggleGuitarSongFavorite } from "@/features/guitar/hooks/useGuitarSongs";
import { SongListRow } from "@/features/guitar/components/SongListRow";

export default function GitaarRecent() {
  const { data: songs, isLoading } = useRecentlyPlayedGuitarSongs();
  const toggleFavorite = useToggleGuitarSongFavorite();

  return (
    <div className="space-y-6">
      <div>
        <p className="wa-eyebrow mb-1.5">Gitaar</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Recent gespeeld
        </h1>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin wa-muted" />
      ) : songs.length === 0 ? (
        <p className="wa-muted text-sm">
          Nog geen nummers geopend op dit toestel.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {songs.map((song) => (
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
