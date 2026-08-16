import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useGuitarAlbums } from "@/features/guitar/hooks/useGuitarAlbums";
import { AlbumCard } from "@/features/guitar/components/AlbumCard";
import { AlbumFormDialog } from "@/features/guitar/components/AlbumFormDialog";

export default function GitaarAlbums() {
  const { data: albums = [], isLoading } = useGuitarAlbums();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="wa-eyebrow mb-1.5">Gitaar</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Albums
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="wa-button px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" /> Album toevoegen
        </button>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin wa-muted" />
      ) : albums.length === 0 ? (
        <div className="py-2">
          <p className="text-sm font-medium">Nog geen albums</p>
          <p className="wa-muted text-xs mt-1">
            Maak je eerste album om nummers in te groeperen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      )}

      <AlbumFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
