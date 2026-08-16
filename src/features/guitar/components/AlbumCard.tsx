import { Link } from "react-router-dom";
import type { GuitarAlbumWithSongCount } from "@/lib/supabase";
import { AlbumCoverThumb } from "./AlbumCoverThumb";

export function AlbumCard({ album }: { album: GuitarAlbumWithSongCount }) {
  return (
    <Link
      to={`/gitaar/albums/${album.id}`}
      className="group flex flex-col gap-2.5"
    >
      <AlbumCoverThumb
        album={album}
        fluid
        rounded="0.9rem"
        className="transition-transform group-hover:scale-[1.015]"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{album.title}</p>
        <p className="wa-muted text-xs truncate mt-0.5">
          {album.artist} · {album.song_count}{" "}
          {album.song_count === 1 ? "nummer" : "nummers"}
        </p>
      </div>
    </Link>
  );
}
