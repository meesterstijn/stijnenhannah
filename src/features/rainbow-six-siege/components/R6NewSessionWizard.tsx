import { useEffect, useRef, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateR6Session } from "@/features/rainbow-six-siege/hooks/useR6Sessions";

const TOTAL_STEPS = 4;

function uniqueValidNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function R6NewSessionWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sessionId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Operation LANstorm");
  const [players, setPlayers] = useState<string[]>(["", ""]);
  const createSession = useCreateR6Session();
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  const today = new Date();
  const validNames = uniqueValidNames(players);
  const canProceedFromPlayers = validNames.length >= 2;

  // Stap 2 (datum) en stap 4 (bevestiging) hebben geen invoerveld — zonder
  // dit zou Enter daar niets doen, want een tekstinvoer die net van de
  // vorige stap verdween laat de focus niet vanzelf op iets bruikbaars
  // achter (meestal valt 'm terug op de hele pagina). Door de primaire knop
  // van elke stap zelf te focussen, activeert Enter altijd óf het
  // tekstveld waar de gebruiker in typt (stap 1/3, normaal formuliergedrag)
  // óf — als er niets te typen valt — direct de knop zelf. Een
  // uitgeschakelde knop (stap 3 zonder geldige spelers) is niet
  // focusbaar, dus Enter doet dan vanzelf niets.
  useEffect(() => {
    primaryButtonRef.current?.focus();
  }, [step]);

  function reset() {
    setStep(1);
    setName("Operation LANstorm");
    setPlayers(["", ""]);
    createSession.reset();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function updatePlayer(index: number, value: string) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPlayerField() {
    setPlayers((prev) => [...prev, ""]);
  }

  function removePlayerField(index: number) {
    setPlayers((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleStart() {
    // Bewust een vers `new Date()` hier, niet de `today` uit de render-scope
    // hierboven (die dient alleen om de datum in stap 2/4 te tonen) — anders
    // is started_at het moment waarop de wizard geopend werd, niet het
    // moment van daadwerkelijk starten, en telt Looptijd meteen de tijd mee
    // die je in de wizard doorbracht in plaats van bij 0 te beginnen.
    const sessionId = await createSession.mutateAsync({
      name: name.trim() || "Operation LANstorm",
      startedAt: new Date().toISOString(),
      playerNames: validNames,
    });
    onCreated(sessionId);
    handleOpenChange(false);
  }

  // De ENE plek die bepaalt wat "verdergaan" op de huidige stap betekent —
  // gebruikt door zowel een echte <form onSubmit> (dus Enter in een
  // invoerveld) als de primaire knop zelf (via type="submit", geen eigen
  // onClick meer). Dezelfde voorwaarden als de knoppen altijd al hadden
  // (canProceedFromPlayers / isPending) gelden hier ook — Enter kan dus
  // nooit verder komen dan een muisklik op een (visueel) uitgeschakelde knop.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < TOTAL_STEPS) {
      if (step === 3 && !canProceedFromPlayers) return;
      setStep((s) => s + 1);
      return;
    }
    if (createSession.isPending) return;
    await handleStart();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="r6-theme border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-zinc-100">Nieuwe LAN starten</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Stap {step} van {TOTAL_STEPS}
          </DialogDescription>
        </DialogHeader>

        {/* Een echte <form> zodat Enter in een invoerveld (bv. LAN-naam)
            hetzelfde doet als klikken op de primaire knop van de huidige
            stap — browserstandaard gedrag, geen losse onKeyDown nodig. De
            primaire knop is nu type="submit" i.p.v. een eigen onClick, dus
            klik én Enter lopen allebei door exact dezelfde handleSubmit. */}
        <form onSubmit={handleSubmit} className="contents">
        {step === 1 && (
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">LAN-naam</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Operation LANstorm"
              className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Datum</label>
            <p className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
              {today.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}{" "}
              <span className="text-zinc-500">(automatisch vandaag)</span>
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Spelers (minimaal twee)</label>
            <div className="space-y-2">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={p}
                    onChange={(e) => updatePlayer(i, e.target.value)}
                    placeholder={i === 0 ? "Speler 1 (links)" : i === 1 ? "Speler 2 (rechts)" : `Speler ${i + 1}`}
                    className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-zinc-500 hover:text-rose-400"
                    onClick={() => removePlayerField(i)}
                    disabled={players.length <= 2}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={addPlayerField}
            >
              <Plus className="h-4 w-4" /> Speler toevoegen
            </Button>
            {!canProceedFromPlayers && <p className="text-xs text-rose-400">Vul minimaal twee unieke spelernamen in.</p>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <p className="text-zinc-300">
              <span className="text-zinc-500">Naam:</span> {name.trim() || "Operation LANstorm"}
            </p>
            <p className="text-zinc-300">
              <span className="text-zinc-500">Datum:</span>{" "}
              {today.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <div className="text-zinc-300">
              <span className="text-zinc-500">Spelers:</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {validNames.map((n) => (
                  <span key={n} className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-xs">
                    {n}
                  </span>
                ))}
              </div>
            </div>
            {createSession.isError && (
              <p className="text-xs text-rose-400">Er ging iets mis bij het starten van de LAN. Probeer opnieuw.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setStep((s) => s - 1)}
              disabled={createSession.isPending}
            >
              Terug
            </Button>
          )}
          {step < TOTAL_STEPS && (
            <Button
              ref={primaryButtonRef}
              type="submit"
              className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
              disabled={step === 3 && !canProceedFromPlayers}
            >
              Volgende
            </Button>
          )}
          {step === TOTAL_STEPS && (
            <Button
              ref={primaryButtonRef}
              type="submit"
              className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
              disabled={createSession.isPending}
            >
              {createSession.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Start LAN
            </Button>
          )}
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
