import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Music2, Plus, Search } from "lucide-react";
import { useGuitarAlbums } from "@/features/guitar/hooks/useGuitarAlbums";
import {
  filterGuitarSongs,
  useGuitarSongs,
  useToggleGuitarSongFavorite,
} from "@/features/guitar/hooks/useGuitarSongs";
import { useRecentlyPlayedGuitarSongs } from "@/features/guitar/hooks/useRecentlyPlayedSongs";
import { AlbumCard } from "@/features/guitar/components/AlbumCard";
import { AlbumCoverThumb } from "@/features/guitar/components/AlbumCoverThumb";
import { SongListRow } from "@/features/guitar/components/SongListRow";

export default function GitaarMijnMuziek() {
  const [query, setQuery] = useState("");
  const { data: songs = [], isLoading: songsLoading } = useGuitarSongs();
  const { data: albums = [], isLoading: albumsLoading } = useGuitarAlbums();
  const { data: recent } = useRecentlyPlayedGuitarSongs(8);
  const toggleFavorite = useToggleGuitarSongFavorite();

  const filteredSongs = filterGuitarSongs(songs, query);
  const isSearching = query.trim() !== "";

  return (
    <div className="space-y-9 sm:space-y-11">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="wa-eyebrow mb-1.5">Gitaar</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Mijn muziek
          </h1>
        </div>
        <Link
          to="/gitaar/nummers/nieuw"
          className="wa-button px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" /> Nummer toevoegen
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 wa-muted pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op titel, artiest of album…"
          className="w-full h-11 rounded-full pl-10 pr-4 text-sm"
        />
      </div>

      {!isSearching && recent.length > 0 && (
        <section className="space-y-3.5">
          <p className="wa-eyebrow">Recent gespeeld</p>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            {recent.map((song) => (
              <Link
                key={song.id}
                to={`/gitaar/nummers/${song.id}`}
                className="flex flex-col gap-2 w-28 shrink-0"
              >
                <AlbumCoverThumb
                  album={
                    song.album ?? {
                      title: song.title,
                      cover_storage_path: null,
                    }
                  }
                  size={112}
                  rounded="0.85rem"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{song.title}</p>
                  <p className="wa-muted text-[11px] truncate">{song.artist}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!isSearching && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <p className="wa-eyebrow">Albums</p>
            {albums.length > 0 && (
              <Link
                to="/gitaar/albums"
                className="wa-muted text-xs hover:underline underline-offset-2"
              >
                Alles bekijken
              </Link>
            )}
          </div>
          {albumsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin wa-muted" />
          ) : albums.length === 0 ? (
            <EmptyAlbums />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-7">
              {albums.slice(0, 8).map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3.5">
        <p className="wa-eyebrow">
          {isSearching ? `Nummers · "${query}"` : "Nummers"}
        </p>
        {songsLoading ? (
          <Loader2 className="h-4 w-4 animate-spin wa-muted" />
        ) : filteredSongs.length === 0 ? (
          <p className="wa-muted text-sm">
            {isSearching
              ? "Geen nummers gevonden."
              : "Nog geen nummers toegevoegd."}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredSongs.map((song) => (
              <SongListRow
                key={song.id}
                song={song}
                onToggleFavorite={() =>
                  toggleFavorite.mutate({
                    id: song.id,
                    favorite: !song.favorite,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyAlbums() {
  return (
    <div className="flex items-center gap-3.5 py-1">
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: "var(--wa-accent-soft)",
          color: "var(--wa-accent-soft-text)",
        }}
      >
        <Music2 className="h-4 w-4" strokeWidth={1.7} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">Nog geen albums</p>
        <p className="wa-muted text-xs mt-0.5">
          Groepeer je nummers in een album.{" "}
          <Link
            to="/gitaar/albums"
            className="underline underline-offset-2 hover:text-[var(--wa-text)]"
          >
            Album maken
          </Link>
        </p>
      </div>
    </div>
  );
}
