import { useState } from "react";
import { Loader2, Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateR6ScoreRule,
  useDeleteR6ScoreRule,
  useR6ScoreRules,
  useUpdateR6ScoreRule,
} from "@/features/rainbow-six-siege/hooks/useR6Reference";
import { TILE_COLOR_TOKENS, tileColorClasses } from "@/features/rainbow-six-siege/lib/actionColors";
import type { R6ScoreRule } from "@/features/rainbow-six-siege/types";

function NewQuickActionForm({ nextSortOrder }: { nextSortOrder: number }) {
  const createRule = useCreateR6ScoreRule();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [points, setPoints] = useState("1");
  const [color, setColor] = useState("zinc");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Vul een naam in.");
      return;
    }
    const parsedPoints = parseInt(points, 10);
    if (!Number.isFinite(parsedPoints)) {
      setError("Vul een geldige puntenwaarde in.");
      return;
    }
    try {
      await createRule.mutateAsync({ name: trimmedName, points: parsedPoints, icon: icon.trim() || null, color, sortOrder: nextSortOrder });
      setName("");
      setIcon("");
      setPoints("1");
      setColor("zinc");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toevoegen mislukt. Probeer opnieuw.");
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-3">
      <p className="text-sm font-medium text-zinc-300">Nieuwe actietegel</p>
      <div className="grid grid-cols-[3rem_1fr_5rem] gap-2">
        <Input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🎯"
          className="border-zinc-700 bg-zinc-900 px-1 text-center text-lg text-zinc-100 placeholder:text-zinc-600"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Naam (bv. Plant)"
          className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
        />
        <Input
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className="border-zinc-700 bg-zinc-900 text-zinc-100"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={color} onValueChange={setColor}>
          <SelectTrigger className={`h-8 w-28 border ${tileColorClasses(color)}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            {TILE_COLOR_TOKENS.map((token) => (
              <SelectItem key={token} value={token} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                {token}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          className="ml-auto bg-amber-500 text-zinc-950 hover:bg-amber-400"
          onClick={handleAdd}
          disabled={createRule.isPending}
        >
          {createRule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Toevoegen
        </Button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function QuickActionRow({ rule }: { rule: R6ScoreRule }) {
  const updateRule = useUpdateR6ScoreRule();
  const deleteRule = useDeleteR6ScoreRule();
  const [name, setName] = useState(rule.name);
  const [icon, setIcon] = useState(rule.icon ?? "");
  const [points, setPoints] = useState(String(rule.points));
  const [sortOrder, setSortOrder] = useState(String(rule.sort_order));
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete() {
    setDeleteError(null);
    deleteRule.mutate(rule.id, {
      onError: (err) => setDeleteError(err instanceof Error ? err.message : "Verwijderen mislukt."),
    });
  }

  function saveName() {
    if (name.trim() && name !== rule.name) updateRule.mutate({ id: rule.id, patch: { name: name.trim() } });
  }
  function saveIcon() {
    if (icon !== (rule.icon ?? "")) updateRule.mutate({ id: rule.id, patch: { icon: icon.trim() || null } });
  }
  function savePoints() {
    const parsed = parseInt(points, 10);
    if (Number.isFinite(parsed) && parsed !== rule.points) updateRule.mutate({ id: rule.id, patch: { points: parsed } });
  }
  function saveSortOrder() {
    const parsed = parseInt(sortOrder, 10);
    if (Number.isFinite(parsed) && parsed !== rule.sort_order) updateRule.mutate({ id: rule.id, patch: { sort_order: parsed } });
  }

  return (
    <div className={`space-y-2 rounded-2xl border p-3 ${rule.is_active ? "border-zinc-800 bg-zinc-900/60" : "border-zinc-800 bg-zinc-950/40 opacity-60"}`}>
      <div className="grid grid-cols-[3rem_1fr_5rem] gap-2">
        <Input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          onBlur={saveIcon}
          className="border-zinc-700 bg-zinc-900 px-1 text-center text-lg text-zinc-100"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="border-zinc-700 bg-zinc-900 text-zinc-100"
        />
        <Input
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          onBlur={savePoints}
          className="border-zinc-700 bg-zinc-900 text-zinc-100"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={rule.color ?? "zinc"} onValueChange={(v) => updateRule.mutate({ id: rule.id, patch: { color: v } })}>
          <SelectTrigger className={`h-8 w-28 border ${tileColorClasses(rule.color)}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            {TILE_COLOR_TOKENS.map((token) => (
              <SelectItem key={token} value={token} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                {token}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          Volgorde
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            onBlur={saveSortOrder}
            className="h-8 w-16 border-zinc-700 bg-zinc-900 text-zinc-100"
          />
        </label>

        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-300">
          <Checkbox
            checked={rule.is_active}
            onCheckedChange={(c) => updateRule.mutate({ id: rule.id, patch: { is_active: c === true } })}
          />
          Actief
        </label>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
          onClick={handleDelete}
          disabled={deleteRule.isPending}
          aria-label={`${rule.name} verwijderen`}
        >
          {deleteRule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
      {deleteError && <p className="text-xs text-rose-400">{deleteError}</p>}
    </div>
  );
}

export function R6QuickActionSettings() {
  const [open, setOpen] = useState(false);
  const { rules } = useR6ScoreRules();
  const quickActions = rules.filter((r) => r.is_quick_action).sort((a, b) => a.sort_order - b.sort_order);
  const nextSortOrder = rules.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-4 w-4" /> Actietegels beheren
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-serif text-xl text-zinc-100">Actietegels beheren</SheetTitle>
          </SheetHeader>
          <p className="mt-2 text-xs text-zinc-400">
            Naam, puntenwaarde, icoon, kleur en volgorde zijn direct aanpasbaar. Zet een tegel op "inactief" om 'm van het live
            dashboard te verbergen zonder de geschiedenis van al getikte gebeurtenissen te verliezen.
          </p>
          <div className="mt-4">
            <NewQuickActionForm nextSortOrder={nextSortOrder} />
          </div>
          <div className="mt-4 space-y-3">
            {quickActions.map((rule) => (
              <QuickActionRow key={rule.id} rule={rule} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
