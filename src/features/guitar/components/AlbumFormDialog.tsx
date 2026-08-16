import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GuitarAlbum } from "@/lib/supabase";
import {
  useSaveGuitarAlbum,
  useSetGuitarAlbumCover,
} from "@/features/guitar/hooks/useGuitarAlbums";
import {
  getAlbumCoverUrl,
  uploadAlbumCover,
} from "@/features/guitar/lib/albumCoverStorage";
import { optimizeGrowthPhoto } from "@/features/tuingids/lib/optimizeGrowthPhoto";

export function AlbumFormDialog({
  open,
  onOpenChange,
  album,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  album?: GuitarAlbum;
  onSaved?: (album: GuitarAlbum) => void;
}) {
  const saveAlbum = useSaveGuitarAlbum();
  const setCover = useSetGuitarAlbumCover();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(album?.title ?? "");
    setArtist(album?.artist ?? "");
    setDescription(album?.description ?? "");
    setCoverFile(null);
    setCoverPreview(
      album?.cover_storage_path
        ? getAlbumCoverUrl(album.cover_storage_path)
        : null,
    );
    setError(null);
  }, [open, album]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  const isSaving = saveAlbum.isPending || setCover.isPending;
  const canSave = title.trim() !== "" && artist.trim() !== "";

  async function handleSave() {
    setError(null);
    try {
      const saved = await saveAlbum.mutateAsync({
        id: album?.id,
        input: {
          title: title.trim(),
          artist: artist.trim(),
          description: description.trim() || null,
        },
      });
      if (coverFile) {
        const optimized = await optimizeGrowthPhoto(coverFile);
        const { storagePath } = await uploadAlbumCover(saved.id, optimized);
        await setCover.mutateAsync({ id: saved.id, storagePath });
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="guitar-theme max-w-md">
        <DialogHeader>
          <DialogTitle>{album ? "Album bewerken" : "Nieuw album"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="wa-cover w-28 h-28 mx-auto flex items-center justify-center overflow-hidden"
            style={{
              background: "var(--wa-surface-strong)",
              border: "1px solid var(--wa-border)",
            }}
          >
            {coverPreview ? (
              <img
                src={coverPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 wa-muted">
                <ImagePlus className="h-5 w-5" strokeWidth={1.6} />
                <span className="text-[11px]">Cover</span>
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="space-y-1.5">
            <label className="wa-eyebrow">Albumnaam</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv. Ochtendlicht"
            />
          </div>

          <div className="space-y-1.5">
            <label className="wa-eyebrow">Artiest</label>
            <Input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Bijv. Stille Aarde"
            />
          </div>

          <div className="space-y-1.5">
            <label className="wa-eyebrow">
              Beschrijving{" "}
              <span className="normal-case font-normal">(optioneel)</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Korte omschrijving…"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="button"
            className="wa-button w-full h-11 text-sm disabled:opacity-50 disabled:pointer-events-none"
            disabled={!canSave || isSaving}
            onClick={handleSave}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : album ? (
              "Opslaan"
            ) : (
              "Album maken"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
