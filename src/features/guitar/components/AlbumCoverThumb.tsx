import { getAlbumCoverUrl } from "@/features/guitar/lib/albumCoverStorage";

type AlbumLike = { title: string; cover_storage_path: string | null };

/** Vierkante albumcover met monogram-fallback zolang er geen cover is
 * geüpload — nooit een generieke muzieknoot/decoratie-illustratie (section 3).
 * `fluid` laat de cover meeschalen met de breedte van de ouder (gridkaarten);
 * anders een vaste `size` in px (sidebar/lijstrijen). */
export function AlbumCoverThumb({
  album,
  size = 40,
  fluid = false,
  rounded = "0.55rem",
  className = "",
}: {
  album: AlbumLike;
  size?: number;
  fluid?: boolean;
  rounded?: string;
  className?: string;
}) {
  const url = album.cover_storage_path
    ? getAlbumCoverUrl(album.cover_storage_path)
    : null;

  return (
    <div
      className={`wa-cover shrink-0 ${fluid ? "w-full aspect-square" : ""} ${className}`}
      style={{
        width: fluid ? undefined : size,
        height: fluid ? undefined : size,
        borderRadius: rounded,
        boxShadow: "none",
      }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="h-full w-full flex items-center justify-center font-semibold"
          style={{
            fontSize: fluid ? "2.4rem" : size * 0.42,
            background: "var(--wa-accent-soft)",
            color: "var(--wa-accent-soft-text)",
          }}
        >
          {album.title.trim().charAt(0).toUpperCase() || "♪"}
        </div>
      )}
    </div>
  );
}
