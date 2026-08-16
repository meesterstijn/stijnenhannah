import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useDeleteGuitarAlbum,
  useGuitarAlbum,
} from "@/features/guitar/hooks/useGuitarAlbums";
import {
  useGuitarSongsByAlbum,
  useToggleGuitarSongFavorite,
} from "@/features/guitar/hooks/useGuitarSongs";
import { AlbumCoverThumb } from "@/features/guitar/components/AlbumCoverThumb";
import { AlbumFormDialog } from "@/features/guitar/components/AlbumFormDialog";
import { SongListRow } from "@/features/guitar/components/SongListRow";
import type { GuitarSongWithAlbum } from "@/lib/supabase";

export default function GitaarAlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: album, isLoading } = useGuitarAlbum(id);
  const { data: songs = [] } = useGuitarSongsByAlbum(id);
  const deleteAlbum = useDeleteGuitarAlbum();
  const toggleFavorite = useToggleGuitarSongFavorite();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin wa-muted" />
      </div>
    );
  }

  if (!album) {
    return <p className="wa-muted text-sm">Dit album bestaat niet (meer).</p>;
  }

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="wa-muted text-xs inline-flex items-center gap-1 hover:text-[var(--wa-text)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug
      </button>

      <div className="flex flex-col sm:flex-row items-start gap-6">
        <AlbumCoverThumb
          album={album}
          size={168}
          rounded="1rem"
          className="mx-auto sm:mx-0"
        />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                {album.title}
              </h1>
              <p className="wa-muted text-sm mt-1">
                {album.artist} · {songs.length}{" "}
                {songs.length === 1 ? "nummer" : "nummers"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="wa-button-ghost h-9 w-9 shrink-0"
                  aria-label="Meer acties"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="guitar-theme">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Bewerken
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" /> Verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {album.description && (
            <p className="text-sm leading-relaxed wa-muted max-w-prose">
              {album.description}
            </p>
          )}
          <Link
            to={`/gitaar/nummers/nieuw?album=${album.id}`}
            className="wa-button-ghost px-4 py-2 text-xs w-fit mt-1"
          >
            <Plus className="h-3.5 w-3.5" /> Nummer toevoegen
          </Link>
        </div>
      </div>

      <div className="space-y-3.5">
        <p className="wa-eyebrow">Nummers</p>
        {songs.length === 0 ? (
          <p className="wa-muted text-sm">Nog geen nummers in dit album.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {songs.map((song) => (
              <SongListRow
                key={song.id}
                song={{ ...song, album } as GuitarSongWithAlbum}
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
      </div>

      <AlbumFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        album={album}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="guitar-theme">
          <AlertDialogHeader>
            <AlertDialogTitle>Album verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{album.title}" wordt verwijderd. Nummers in dit album blijven
              bestaan, maar verliezen de koppeling met dit album.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteAlbum.mutate(album);
                navigate("/gitaar/albums");
              }}
            >
              Verwijder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
