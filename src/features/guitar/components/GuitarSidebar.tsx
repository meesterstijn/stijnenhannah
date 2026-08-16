import { Link, useLocation } from "react-router-dom";
import { Music2, Disc3, Heart, History } from "lucide-react";
import { useGuitarAlbums } from "@/features/guitar/hooks/useGuitarAlbums";
import { AlbumCoverThumb } from "./AlbumCoverThumb";

const NAV: {
  to: string;
  label: string;
  icon: typeof Music2;
  exact?: boolean;
}[] = [
  { to: "/gitaar", label: "Mijn muziek", icon: Music2, exact: true },
  { to: "/gitaar/albums", label: "Albums", icon: Disc3 },
  { to: "/gitaar/favorieten", label: "Favorieten", icon: Heart },
  { to: "/gitaar/recent", label: "Recent gespeeld", icon: History },
];

export function GuitarSidebar() {
  const { pathname } = useLocation();
  const { data: albums = [] } = useGuitarAlbums();

  return (
    <aside className="flex flex-col gap-8">
      <div>
        <p className="wa-eyebrow px-2 mb-3">Gitaar</p>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`wa-nav-item px-2.5 py-2 text-sm ${active ? "active" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {albums.length > 0 && (
        <div>
          <p className="wa-eyebrow px-2 mb-3">Mijn albums</p>
          <div className="flex flex-col gap-0.5">
            {albums.slice(0, 8).map((album) => (
              <Link
                key={album.id}
                to={`/gitaar/albums/${album.id}`}
                className={`wa-nav-item px-2.5 py-1.5 text-sm ${pathname === `/gitaar/albums/${album.id}` ? "active" : ""}`}
              >
                <AlbumCoverThumb album={album} size={26} />
                <span className="truncate">{album.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
