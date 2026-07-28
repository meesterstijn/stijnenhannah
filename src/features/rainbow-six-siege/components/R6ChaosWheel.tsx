import { useEffect, useRef, useState } from "react";
import { Dices, Loader2, Plus, Settings2, Shuffle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useAcceptR6ChaosEffect,
  useCreateR6ChaosEffect,
  useDeleteR6ChaosEffect,
  useR6ChaosEffects,
  useUpdateR6ChaosEffect,
} from "@/features/rainbow-six-siege/hooks/useR6ChaosEffects";
import type { R6ChaosEffect } from "@/features/rainbow-six-siege/types";

const SPIN_DURATION_MS = 1200;
const SPIN_TICK_MS = 80;

function ChaosEffectRow({ effect }: { effect: R6ChaosEffect }) {
  const updateEffect = useUpdateR6ChaosEffect();
  const deleteEffect = useDeleteR6ChaosEffect();
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? "");
  const [category, setCategory] = useState(effect.category ?? "");
  const [sortOrder, setSortOrder] = useState(String(effect.sort_order));
  const [error, setError] = useState<string | null>(null);

  function saveName() {
    if (name.trim() && name !== effect.name) updateEffect.mutate({ id: effect.id, patch: { name: name.trim() } });
  }
  function saveDescription() {
    if (description !== (effect.description ?? "")) updateEffect.mutate({ id: effect.id, patch: { description: description.trim() || null } });
  }
  function saveCategory() {
    if (category !== (effect.category ?? "")) updateEffect.mutate({ id: effect.id, patch: { category: category.trim() || null } });
  }
  function saveSortOrder() {
    const parsed = parseInt(sortOrder, 10);
    if (Number.isFinite(parsed) && parsed !== effect.sort_order) updateEffect.mutate({ id: effect.id, patch: { sort_order: parsed } });
  }
  function handleDelete() {
    setError(null);
    deleteEffect.mutate(effect.id, { onError: (err) => setError(err instanceof Error ? err.message : "Verwijderen mislukt.") });
  }

  return (
    <div className={`space-y-2 rounded-2xl border p-3 ${effect.is_active ? "border-zinc-800 bg-zinc-900/60" : "border-zinc-800 bg-zinc-950/40 opacity-60"}`}>
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
        <Input
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          onBlur={saveSortOrder}
          type="number"
          className="border-zinc-700 bg-zinc-900 text-zinc-100"
        />
      </div>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={saveDescription}
        placeholder="Omschrijving (optioneel)"
        className="min-h-9 border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-500"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={saveCategory}
          placeholder="Categorie (optioneel)"
          className="h-8 w-40 border-zinc-700 bg-zinc-900 text-xs text-zinc-100 placeholder:text-zinc-500"
        />
        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-300">
          <Checkbox checked={effect.is_active} onCheckedChange={(c) => updateEffect.mutate({ id: effect.id, patch: { is_active: c === true } })} />
          Actief
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
          onClick={handleDelete}
          disabled={deleteEffect.isPending}
          aria-label={`${effect.name} verwijderen`}
        >
          {deleteEffect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function NewChaosEffectForm({ nextSortOrder }: { nextSortOrder: number }) {
  const createEffect = useCreateR6ChaosEffect();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vul een naam in.");
      return;
    }
    try {
      await createEffect.mutateAsync({ name: trimmed, description: null, category: null, sortOrder: nextSortOrder });
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toevoegen mislukt.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nieuwe chaosregel (bv. Alleen sluipschutters)"
        className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
      />
      <Button type="button" className="shrink-0 bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={handleAdd} disabled={createEffect.isPending}>
        {createEffect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export function R6ChaosWheel({
  matchNumber,
  onAccept,
  isSaving,
}: {
  matchNumber: number;
  onAccept: (chaosEffectId: string) => void;
  isSaving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [cyclingName, setCyclingName] = useState("");
  const [landedEffect, setLandedEffect] = useState<R6ChaosEffect | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: chaosEffects = [] } = useR6ChaosEffects();
  const activeEffects = chaosEffects.filter((e) => e.is_active);
  const nextSortOrder = chaosEffects.reduce((max, e) => Math.max(max, e.sort_order), 0) + 1;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function reset() {
    setSpinning(false);
    setLandedEffect(null);
    setCyclingName("");
    setManaging(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    setOpen(next);
  }

  function spin() {
    if (activeEffects.length === 0) return;
    setLandedEffect(null);
    setSpinning(true);
    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      setCyclingName(activeEffects[Math.floor(Math.random() * activeEffects.length)].name);
      elapsed += SPIN_TICK_MS;
      if (elapsed >= SPIN_DURATION_MS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        const chosen = activeEffects[Math.floor(Math.random() * activeEffects.length)];
        setLandedEffect(chosen);
        setSpinning(false);
      }
    }, SPIN_TICK_MS);
  }

  function handleAccept() {
    if (!landedEffect) return;
    onAccept(landedEffect.id);
    handleOpenChange(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        onClick={() => setOpen(true)}
      >
        <Dices className="h-4 w-4" /> Chaos Wheel
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="r6-theme w-full overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-serif text-xl text-zinc-100">Chaos Wheel — Game {matchNumber}</SheetTitle>
          </SheetHeader>

          {!managing ? (
            <div className="mt-4 space-y-4">
              <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
                {landedEffect ? (
                  <>
                    <p className="text-xs text-zinc-500">Actieve chaosregel</p>
                    <p className="mt-1 font-serif text-2xl font-bold text-amber-400">{landedEffect.name}</p>
                    {landedEffect.description && <p className="mt-1 text-xs text-zinc-400">{landedEffect.description}</p>}
                  </>
                ) : (
                  <p className={`font-serif text-xl font-semibold ${spinning ? "text-amber-400" : "text-zinc-500"}`}>
                    {spinning ? cyclingName : "Geen regel gekozen"}
                  </p>
                )}
              </div>

              {activeEffects.length === 0 ? (
                <p className="text-xs text-zinc-500">Geen actieve chaosregels ingesteld — voeg er hieronder een toe.</p>
              ) : !landedEffect ? (
                <Button
                  type="button"
                  className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"
                  onClick={spin}
                  disabled={spinning}
                >
                  {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                  Draai het wiel
                </Button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={spin}
                  >
                    Opnieuw
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={() => handleOpenChange(false)}
                  >
                    Annuleren
                  </Button>
                  <Button type="button" className="bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={handleAccept} disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Accepteren
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => setManaging(true)}
              >
                <Settings2 className="h-4 w-4" /> Chaosregels beheren
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <Button type="button" variant="outline" size="sm" className="border-zinc-700 bg-transparent text-zinc-300" onClick={() => setManaging(false)}>
                Terug naar wheel
              </Button>
              <NewChaosEffectForm nextSortOrder={nextSortOrder} />
              <div className="space-y-3">
                {chaosEffects
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((effect) => (
                    <ChaosEffectRow key={effect.id} effect={effect} />
                  ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
