import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateR6Match } from "@/features/rainbow-six-siege/hooks/useR6SessionDetail";
import { useStartR6Round } from "@/features/rainbow-six-siege/hooks/useR6Events";
import { useR6SessionMedia } from "@/features/rainbow-six-siege/hooks/useR6SessionMedia";
import { pickerOptions } from "@/features/rainbow-six-siege/lib/reference";
import { buildR6MatchPlayerInput, emptyR6MatchPlayerFormState } from "@/features/rainbow-six-siege/lib/matchForm";
import type { R6Map, R6Match, R6MatchResult, R6Player } from "@/features/rainbow-six-siege/types";

const NONE = "none";

const RESULT_OPTIONS: { value: R6MatchResult; label: string; selectedClass: string }[] = [
  { value: "win", label: "Gewonnen", selectedClass: "border-emerald-500 bg-emerald-500/20 text-emerald-400" },
  { value: "loss", label: "Verloren", selectedClass: "border-rose-500 bg-rose-500/20 text-rose-400" },
  { value: "draw", label: "Gelijkspel", selectedClass: "border-zinc-500 bg-zinc-500/20 text-zinc-300" },
];

// Het enige moment tijdens het spelen waarop er wél iets ingevuld wordt —
// bewust tot het minimum beperkt (map, resultaat, MVP, optioneel foto/
// opmerking) zodat "Game afronden" zelf ook nog steeds binnen een paar
// tikken klaar is. Kills/deaths/headshots e.d. horen hier expliciet niet
// meer thuis — die komen al binnen via de losse tik-gebeurtenissen
// (r6_events) tijdens het spelen zelf.
export function R6EndGameSheet({
  open,
  onOpenChange,
  sessionId,
  currentMatch,
  roster,
  maps,
  onEnded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  currentMatch: R6Match;
  roster: R6Player[];
  maps: R6Map[];
  onEnded: (endedGameNumber: number) => void;
}) {
  const updateMatch = useUpdateR6Match(sessionId);
  const startNextGame = useStartR6Round(sessionId);
  const { uploadMedia, isUploading } = useR6SessionMedia(sessionId);

  const [mapId, setMapId] = useState("");
  const [result, setResult] = useState<R6MatchResult | null>(null);
  const [mvpPlayerId, setMvpPlayerId] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMapId("");
    setResult(null);
    setMvpPlayerId("");
    setNote("");
    setPhoto(null);
    setError(null);
  }, [open, currentMatch.id]);

  const pickerMaps = pickerOptions(maps, [mapId]);
  const pending = isSaving || updateMatch.isPending || startNextGame.isPending || isUploading;

  async function handleSubmit() {
    if (!result) {
      setError("Kies eerst gewonnen, verloren of gelijkspel.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await updateMatch.mutateAsync({
        match_id: currentMatch.id,
        session_id: sessionId,
        map_id: mapId || null,
        result,
        challenge_id: null,
        challenge_completed: false,
        chaos_rule: null,
        funniest_moment: null,
        notes: note.trim() || null,
        mvp_player_id: mvpPlayerId || null,
        mvp_reason: null,
        players: roster.map((p) => buildR6MatchPlayerInput(emptyR6MatchPlayerFormState(p.id))),
      });
      if (photo) {
        await uploadMedia({ file: photo, caption: null, matchId: currentMatch.id });
      }
      await startNextGame.mutateAsync();
      onEnded(currentMatch.match_number);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt. Probeer opnieuw.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl text-zinc-100">Game {currentMatch.match_number} afronden</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-300">Map</label>
            <Select value={mapId || NONE} onValueChange={(v) => setMapId(v === NONE ? "" : v)}>
              <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectValue placeholder="Onbekend" />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectItem value={NONE} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                  Onbekend
                </SelectItem>
                {pickerMaps.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-300">Resultaat</label>
            <div className="grid grid-cols-3 gap-2">
              {RESULT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setResult(opt.value)}
                  className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${
                    result === opt.value ? opt.selectedClass : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-300">MVP (optioneel)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMvpPlayerId("")}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  mvpPlayerId === "" ? "border-amber-500 bg-amber-500/20 text-amber-400" : "border-zinc-700 bg-zinc-900 text-zinc-400"
                }`}
              >
                Geen
              </button>
              {roster.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMvpPlayerId(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    mvpPlayerId === p.id ? "border-amber-500 bg-amber-500/20 text-amber-400" : "border-zinc-700 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-300">Foto (optioneel)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {photo ? photo.name : "Foto toevoegen"}
            </Button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-300">Opmerking (optioneel)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bv. Bro sprong per ongeluk van het dak."
              className="min-h-9 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>

        <SheetFooter className="mt-6">
          <Button type="button" className="bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Opslaan &amp; volgende game starten
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
