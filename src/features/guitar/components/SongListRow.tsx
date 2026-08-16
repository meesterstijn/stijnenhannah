import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import type { GuitarSongWithAlbum } from "@/lib/supabase";
import { toDisplayNote } from "@/features/guitar/lib/transpose";
import { AlbumCoverThumb } from "./AlbumCoverThumb";

export function SongListRow({
  song,
  onToggleFavorite,
}: {
  song: GuitarSongWithAlbum;
  onToggleFavorite?: () => void;
}) {
  return (
    <Link
      to={`/gitaar/nummers/${song.id}`}
      className="flex items-center gap-3 px-3 py-2.5 sm:px-4 rounded-xl hover:bg-[var(--wa-surface-strong)] transition-colors"
    >
      <AlbumCoverThumb
        album={song.album ?? { title: song.title, cover_storage_path: null }}
        size={42}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{song.title}</p>
        <p className="wa-muted text-xs truncate mt-0.5">
          {song.artist}
          {song.album && <> · {song.album.title}</>}
        </p>
      </div>
      <span className="wa-chord text-xs shrink-0 hidden xs:inline">
        {toDisplayNote(song.original_key)}
      </span>
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="shrink-0 p-1.5 -m-1.5"
          aria-label={
            song.favorite ? "Uit favorieten" : "Aan favorieten toevoegen"
          }
        >
          <Heart
            className="h-4 w-4"
            fill={song.favorite ? "var(--wa-accent)" : "none"}
            stroke={song.favorite ? "var(--wa-accent)" : "var(--wa-text-faint)"}
          />
        </button>
      )}
    </Link>
  );
}
