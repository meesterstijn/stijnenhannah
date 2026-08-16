import { useEffect, useMemo, useState } from "react";
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
  netSemitones,
  parseChord,
  transposeChord,
} from "@/features/guitar/lib/transpose";
import {
  parseChordSheet,
  transposeSections,
} from "@/features/guitar/lib/chordSheet";
import { VisualChordEditor } from "@/features/guitar/components/VisualChordEditor";
import { ChordSheetView } from "@/features/guitar/components/ChordSheetView";
import { KeyCapoBar } from "@/features/guitar/components/KeyCapoBar";

const NO_ALBUM = "none";

type EditorMode = "visueel" | "bron";
type ViewMode = "bewerken" | "preview";

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg p-0.5 gap-0.5"
      style={{ background: "var(--wa-surface-strong)" }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
            value === opt.value ? "" : "wa-muted hover:text-[var(--wa-text)]"
          }`}
          style={
            value === opt.value
              ? {
                  background: "var(--wa-surface)",
                  color: "var(--wa-text)",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
                }
              : undefined
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
  const [editorMode, setEditorMode] = useState<EditorMode>("visueel");
  const [viewMode, setViewMode] = useState<ViewMode>("bewerken");
  // Preview-only transpose/capo — puur weergave, wordt nooit opgeslagen
  // (section 22: `content` blijft altijd de originele akkoordvorm).
  const [previewTranspose, setPreviewTranspose] = useState(0);
  const [previewCapo, setPreviewCapo] = useState(0);
  const [baseline, setBaseline] = useState<string | null>(null);

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
  const composedOriginalKey = keyRoot + (keyMinor ? "m" : "");
  const preferFlat = composedOriginalKey.includes("b");

  // Geen autosave (section 26) — alles blijft lokale formstate tot expliciet
  // op "Opslaan" gedrukt wordt. `baseline` legt de staat vast zodra het
  // formulier klaar is met laden (nieuw nummer: direct; bewerken: nadat de
  // bestaande song is ingevuld), zodat "niet-opgeslagen wijzigingen" precies
  // betekent "wijkt af van wat er daadwerkelijk staat/stond".
  const snapshot = JSON.stringify({
    title,
    artist,
    albumId,
    keyRoot,
    keyMinor,
    bpm,
    sourceUrl,
    content,
  });
  useEffect(() => {
    if (initialized && baseline === null) setBaseline(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, baseline]);
  const dirty = baseline !== null && baseline !== snapshot;

  // Alleen browserniveau (tabblad sluiten/verversen) — in-app navigatie
  // blokkeren zou react-router's data router (useBlocker) vereisen, en deze
  // app gebruikt bewust de declaratieve <Routes>-vorm (zie App.tsx); dat
  // patroon bestaat nergens anders in de codebase, dus hier niet losstaand
  // geïntroduceerd.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const parsedSections = useMemo(() => parseChordSheet(content), [content]);
  const previewSections = useMemo(
    () =>
      transposeSections(
        parsedSections,
        netSemitones(previewTranspose, previewCapo),
        { preferFlat },
      ),
    [parsedSections, previewTranspose, previewCapo, preferFlat],
  );

  async function handleSave() {
    setError(null);
    try {
      const saved = await saveSong.mutateAsync({
        id,
        input: {
          title: title.trim(),
          artist: artist.trim(),
          album_id: albumId === NO_ALBUM ? null : albumId,
          original_key: composedOriginalKey,
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
    <div className="space-y-7 max-w-3xl">
      <button
        type="button"
        onClick={() => {
          if (
            dirty &&
            !window.confirm(
              "Niet-opgeslagen wijzigingen gaan verloren. Toch teruggaan?",
            )
          )
            return;
          navigate(-1);
        }}
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

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="wa-eyebrow">Akkoorden</label>
          <div className="flex items-center gap-2">
            {viewMode === "bewerken" && (
              <SegmentedToggle
                value={editorMode}
                onChange={setEditorMode}
                options={[
                  { value: "visueel", label: "Visueel" },
                  { value: "bron", label: "Bron" },
                ]}
              />
            )}
            <SegmentedToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "bewerken", label: "Bewerken" },
                { value: "preview", label: "Preview" },
              ]}
            />
          </div>
        </div>

        {viewMode === "preview" ? (
          <div className="space-y-4">
            <KeyCapoBar
              originalKey={composedOriginalKey}
              transposeOffset={previewTranspose}
              capo={previewCapo}
              onTransposeChange={setPreviewTranspose}
              onCapoChange={setPreviewCapo}
              preferFlat={preferFlat}
            />
            <div className="wa-panel px-5 py-7 sm:px-9 sm:py-9">
              <ChordSheetView sections={previewSections} columns={1} />
            </div>
          </div>
        ) : editorMode === "visueel" ? (
          <div className="wa-panel px-4 py-5 sm:px-6 sm:py-6">
            <VisualChordEditor
              value={content}
              onChange={setContent}
              originalKey={composedOriginalKey}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="wa-muted text-xs leading-relaxed">
              Zet een akkoord tussen vierkante haken direct voor het woord waar
              het bij hoort, bv. <code className="wa-chord">[E]</code>We have
              come. Begin een sectie met <code className="wa-chord">#</code>,
              bv. <code className="wa-chord"># Chorus</code>.
            </p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder={"# Verse 1\n[A]Genadig licht dat [E]schijnt in mij"}
              className="w-full font-mono text-sm leading-relaxed resize-y px-3.5 py-3 rounded-xl"
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
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
        {dirty && (
          <span className="wa-muted text-xs">Niet-opgeslagen wijzigingen</span>
        )}
      </div>
    </div>
  );
}
