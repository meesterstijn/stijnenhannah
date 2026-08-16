import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
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
  useDeleteGuitarSong,
  useGuitarSong,
  useToggleGuitarSongFavorite,
} from "@/features/guitar/hooks/useGuitarSongs";
import { useRecentlyPlayedIds } from "@/features/guitar/hooks/useRecentlyPlayedSongs";
import {
  parseChordSheet,
  transposeSections,
} from "@/features/guitar/lib/chordSheet";
import { netSemitones } from "@/features/guitar/lib/transpose";
import { ChordSheetView } from "@/features/guitar/components/ChordSheetView";
import { KeyCapoBar } from "@/features/guitar/components/KeyCapoBar";
import { GuitarPlayMode } from "@/features/guitar/components/GuitarPlayMode";

export default function GitaarSong() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: song, isLoading } = useGuitarSong(id);
  const toggleFavorite = useToggleGuitarSongFavorite();
  const deleteSong = useDeleteGuitarSong();
  const { recordPlay } = useRecentlyPlayedIds();

  const [transposeOffset, setTransposeOffset] = useState(0);
  const [capo, setCapo] = useState(0);
  const [playMode, setPlayMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (song) recordPlay(song.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id]);

  const sections = useMemo(
    () => (song ? parseChordSheet(song.content) : []),
    [song],
  );
  // Zonder expliciete instelling wordt de spelling (# vs b) afgeleid uit hoe
  // de originele toonsoort zelf genoteerd is — section 11 noemt dit als
  // latere verfijning, dit is de eenvoudige, voorspelbare startwaarde.
  const preferFlat = song?.original_key.includes("b") ?? false;
  const transposedSections = useMemo(
    () =>
      transposeSections(sections, netSemitones(transposeOffset, capo), {
        preferFlat,
      }),
    [sections, transposeOffset, capo, preferFlat],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin wa-muted" />
      </div>
    );
  }

  if (!song) {
    return <p className="wa-muted text-sm">Dit nummer bestaat niet (meer).</p>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="wa-muted text-xs inline-flex items-center gap-1 mb-3 hover:text-[var(--wa-text)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Terug
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
            {song.title}
          </h1>
          <p className="wa-muted text-sm mt-1.5">
            {song.artist}
            {song.album && (
              <>
                {" · "}
                <Link
                  to={`/gitaar/albums/${song.album.id}`}
                  className="hover:underline underline-offset-2"
                >
                  {song.album.title}
                </Link>
              </>
            )}
            {song.bpm && <> · {song.bpm} BPM</>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              toggleFavorite.mutate({ id: song.id, favorite: !song.favorite })
            }
            className="wa-button-ghost h-9 w-9"
            aria-label={
              song.favorite ? "Uit favorieten" : "Aan favorieten toevoegen"
            }
          >
            <Heart
              className="h-4 w-4"
              fill={song.favorite ? "var(--wa-accent)" : "none"}
              stroke={song.favorite ? "var(--wa-accent)" : "currentColor"}
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="wa-button-ghost h-9 w-9"
                aria-label="Meer acties"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="guitar-theme">
              <DropdownMenuItem
                onClick={() => navigate(`/gitaar/nummers/${song.id}/bewerken`)}
              >
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
      </div>

      <KeyCapoBar
        originalKey={song.original_key}
        transposeOffset={transposeOffset}
        capo={capo}
        onTransposeChange={setTransposeOffset}
        onCapoChange={setCapo}
        preferFlat={preferFlat}
      />

      <button
        type="button"
        onClick={() => setPlayMode(true)}
        className="wa-button w-full sm:w-auto px-7 py-3 text-sm"
      >
        <Play className="h-4 w-4" fill="currentColor" /> Spelen
      </button>

      <div className="wa-panel px-5 py-7 sm:px-9 sm:py-9">
        <ChordSheetView sections={transposedSections} columns={1} />
      </div>

      {playMode && (
        <GuitarPlayMode
          title={song.title}
          artist={song.artist}
          sections={transposedSections}
          originalKey={song.original_key}
          transposeOffset={transposeOffset}
          capo={capo}
          preferFlat={preferFlat}
          onTransposeChange={setTransposeOffset}
          onExit={() => setPlayMode(false)}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="guitar-theme">
          <AlertDialogHeader>
            <AlertDialogTitle>Nummer verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{song.title}" wordt definitief verwijderd. Dit kan niet ongedaan
              worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteSong.mutate(song.id);
                navigate("/gitaar");
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
