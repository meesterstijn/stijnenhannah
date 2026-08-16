import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGuitarAlbums } from "@/features/guitar/hooks/useGuitarAlbums";
import {
  useGuitarSong,
  useSaveGuitarSong,
} from "@/features/guitar/hooks/useGuitarSongs";
import {
  KEY_ROOT_OPTIONS,
  parseChord,
  transposeChord,
} from "@/features/guitar/lib/transpose";

const NO_ALBUM = "none";

function keyStringToForm(key: string | undefined): {
  root: string;
  minor: boolean;
} {
  const parsed = key ? parseChord(key) : null;
  if (!parsed) return { root: "A", minor: false };
  const root = transposeChord(parsed.rootLetter + parsed.rootAccidental, 0);
  return { root, minor: parsed.modifiers === "m" };
}

export default function GitaarSongEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillAlbumId = searchParams.get("album");

  const { data: existingSong, isLoading: songLoading } = useGuitarSong(id);
  const { data: albums = [] } = useGuitarAlbums();
  const saveSong = useSaveGuitarSong();

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [albumId, setAlbumId] = useState<string>(prefillAlbumId ?? NO_ALBUM);
  const [keyRoot, setKeyRoot] = useState("A");
  const [keyMinor, setKeyMinor] = useState(false);
  const [bpm, setBpm] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit || !existingSong || initialized) return;
    setTitle(existingSong.title);
    setArtist(existingSong.artist);
    setAlbumId(existingSong.album_id ?? NO_ALBUM);
    const parsedKey = keyStringToForm(existingSong.original_key);
    setKeyRoot(parsedKey.root);
    setKeyMinor(parsedKey.minor);
    setBpm(existingSong.bpm ? String(existingSong.bpm) : "");
    setSourceUrl(existingSong.source_url ?? "");
    setContent(existingSong.content);
    setInitialized(true);
  }, [isEdit, existingSong, initialized]);

  const canSave = title.trim() !== "" && artist.trim() !== "";

  async function handleSave() {
    setError(null);
    try {
      const saved = await saveSong.mutateAsync({
        id,
        input: {
          title: title.trim(),
          artist: artist.trim(),
          album_id: albumId === NO_ALBUM ? null : albumId,
          original_key: keyRoot + (keyMinor ? "m" : ""),
          bpm: bpm.trim() ? Number(bpm) : null,
          source_url: sourceUrl.trim() || null,
          content,
        },
      });
      navigate(`/gitaar/nummers/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    }
  }

  if (isEdit && songLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin wa-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-7 max-w-2xl">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="wa-muted text-xs inline-flex items-center gap-1 hover:text-[var(--wa-text)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug
      </button>

      <div>
        <p className="wa-eyebrow mb-1.5">Gitaar</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {isEdit ? "Nummer bewerken" : "Nummer toevoegen"}
        </h1>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="wa-eyebrow">Titel</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel van het nummer"
          />
        </div>
        <div className="space-y-1.5">
          <label className="wa-eyebrow">Artiest</label>
          <Input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artiest"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="wa-eyebrow">Album</label>
          <Select value={albumId} onValueChange={setAlbumId}>
            <SelectTrigger className="!bg-[var(--wa-surface)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="guitar-theme">
              <SelectItem value={NO_ALBUM}>Geen album</SelectItem>
              {albums.map((album) => (
                <SelectItem key={album.id} value={album.id}>
                  {album.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="wa-eyebrow">Oorspronkelijke key</label>
          <div className="flex gap-2">
            <Select value={keyRoot} onValueChange={setKeyRoot}>
              <SelectTrigger className="!bg-[var(--wa-surface)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="guitar-theme">
                {KEY_ROOT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setKeyMinor((m) => !m)}
              className={`wa-chip shrink-0 h-9 px-3.5 ${keyMinor ? "active" : ""}`}
            >
              mineur
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="wa-eyebrow">
            BPM <span className="normal-case font-normal">(optioneel)</span>
          </label>
          <Input
            type="number"
            min={20}
            max={400}
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            placeholder="Bijv. 84"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="wa-eyebrow">
          Bron-URL <span className="normal-case font-normal">(optioneel)</span>
        </label>
        <Input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://…"
          type="url"
        />
      </div>

      <div className="space-y-1.5">
        <label className="wa-eyebrow">Akkoordtekst</label>
        <p className="wa-muted text-xs leading-relaxed">
          Zet een akkoord tussen vierkante haken direct voor het woord waar het
          bij hoort, bv. <code className="wa-chord">[E]</code>We have come.
          Begin een sectie met <code className="wa-chord">#</code>, bv.{" "}
          <code className="wa-chord"># Chorus</code>.
        </p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          placeholder={"# Verse 1\n[A]Genadig licht dat [E]schijnt in mij"}
          className="w-full font-mono text-sm leading-relaxed resize-y px-3.5 py-3 rounded-xl"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || saveSong.isPending}
        className="wa-button px-6 py-3 text-sm disabled:opacity-50 disabled:pointer-events-none"
      >
        {saveSong.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isEdit ? (
          "Opslaan"
        ) : (
          "Nummer toevoegen"
        )}
      </button>
    </div>
  );
}
