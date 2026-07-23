import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sprout,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  type Plant,
  type PlantInstance,
  type CultivationPlanItem,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fetchPlants } from "@/features/tuingids/lib/plantLogs";
import {
  fetchPlantInstances,
  resolveInstanceNames,
} from "@/features/tuingids/lib/plantInstances";
import { MONTH_OPTIONS } from "@/features/tuingids/lib/plantStatus";
import {
  fetchCultivationPlanWithItems,
  getTotalToGrow,
  litersPerPlant,
  totalLitersForItem,
  totalLitersForPlan,
  planProgress,
  PLAN_STATUS_LABELS,
  defaultPlanName,
  suggestPlanYear,
} from "@/features/tuingids/lib/cultivationPlans";
import {
  useCultivationPlans,
  useCultivationPlanItems,
} from "@/features/tuingids/hooks/useCultivationPlans";

// ─── Style helpers ────────────────────────────────────────────────────────────

function segBtn(active: boolean) {
  return `px-3 py-1 rounded-full transition-colors text-sm ${active ? "sv-badge-ok" : "sv-muted"}`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "sv-muted",
  active: "sv-badge-ok",
  completed: "sv-badge-overdue",
  archived: "sv-muted",
};

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  label,
  value,
  min = 0,
  onDecrement,
  onIncrement,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  onDecrement: () => void;
  onIncrement: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs sv-muted w-28 shrink-0">{label}</span>
      <button
        type="button"
        onClick={onDecrement}
        disabled={disabled || value <= min}
        className="sv-button sv-button-thin-border h-7 w-7 flex items-center justify-center text-base disabled:opacity-40"
      >
        −
      </button>
      <span className="text-sm font-medium w-6 text-center tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled}
        className="sv-button sv-button-thin-border h-7 w-7 flex items-center justify-center text-base"
      >
        +
      </button>
    </div>
  );
}

// ─── Small reusable components ────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  const color =
    percent >= 100 ? "bg-green-500" : percent >= 50 ? "bg-yellow-400" : "bg-blue-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden sv-inset">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="text-xs sv-muted w-8 text-right shrink-0">{percent}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] ?? "sv-muted"}`}>
      {PLAN_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── ConfirmDeleteDialog ──────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  title,
  body,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  title: string;
  body: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tuinieren-theme sv-dialog max-w-sm">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm sv-muted">{body}</p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="sv-button sv-button-ghost">
            Annuleer
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="sv-button bg-red-600 text-white hover:bg-red-700"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verwijderen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NewPlanDialog ────────────────────────────────────────────────────────────

function NewPlanDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (planId: string) => void;
}) {
  const defaultYear = suggestPlanYear();
  const [name, setName] = useState("");
  const [year, setYear] = useState(defaultYear);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { createPlan, isCreatingPlan } = useCultivationPlans();

  function reset() {
    setName("");
    setYear(defaultYear);
    setNotes("");
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (year < 2020) {
      setError("Kies een jaar vanaf 2020.");
      return;
    }
    try {
      const planName = name.trim() || defaultPlanName(year);
      const result = await createPlan({ name: planName, plan_year: year, notes: notes.trim() || null });
      reset();
      onCreated(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="tuinieren-theme sv-dialog max-w-md">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">Nieuw teeltplan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs sv-muted">Jaar</label>
            <Input
              type="number"
              min={2020}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs sv-muted">
              Naam <span className="opacity-60">(optioneel — standaard Teeltplan {year})</span>
            </label>
            <Input
              placeholder={defaultPlanName(year)}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs sv-muted">Notitie (optioneel)</label>
            <Textarea
              placeholder="Bijzonderheden over dit teeltplan..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-xs sv-destructive-text">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="sv-button sv-button-ghost">
            Annuleer
          </Button>
          <Button onClick={handleSave} disabled={isCreatingPlan} className="sv-button">
            {isCreatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CopyPlanDialog ───────────────────────────────────────────────────────────

function CopyPlanDialog({
  open,
  sourcePlanId,
  onClose,
  onCopied,
}: {
  open: boolean;
  sourcePlanId: string;
  onClose: () => void;
  onCopied: (planId: string) => void;
}) {
  const newYear = suggestPlanYear();
  const [year, setYear] = useState(newYear);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { copyPlan, isCopyingPlan } = useCultivationPlans();

  async function handleCopy() {
    setError(null);
    try {
      const result = await copyPlan({ sourcePlanId, newYear: year, newName: name.trim() || undefined });
      setName("");
      setYear(newYear);
      onCopied(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kopiëren mislukt");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tuinieren-theme sv-dialog max-w-md">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">Kopieer naar nieuw seizoen</DialogTitle>
        </DialogHeader>
        <p className="text-sm sv-muted">
          Alle plantsoorten, hoofdaantallen en reserveaantallen worden gekopieerd. Definitief geplante aantallen worden gereset naar 0.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs sv-muted">Nieuw jaar</label>
            <Input
              type="number"
              min={2020}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs sv-muted">Naam (optioneel)</label>
            <Input
              placeholder={defaultPlanName(year)}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="text-xs sv-destructive-text">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="sv-button sv-button-ghost">
            Annuleer
          </Button>
          <Button onClick={handleCopy} disabled={isCopyingPlan} className="sv-button">
            {isCopyingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Copy className="h-4 w-4" /> Kopiëren</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AddSpeciesDialog ─────────────────────────────────────────────────────────

function AddSpeciesDialog({
  open,
  planId,
  existingSpeciesIds,
  onClose,
}: {
  open: boolean;
  planId: string;
  existingSpeciesIds: Set<string>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Plant | null>(null);
  const [mainQty, setMainQty] = useState(1);
  const [backupQty, setBackupQty] = useState(0);
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { addItem, isAddingItem } = useCultivationPlans();

  const { data: plants = [] } = useQuery<Plant[]>({
    queryKey: ["plants"],
    queryFn: fetchPlants,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plants.filter((p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.species ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q),
    );
  }, [plants, search]);

  function reset() {
    setSearch("");
    setSelected(null);
    setMainQty(1);
    setBackupQty(0);
    setLocation("");
    setError(null);
  }

  async function handleAdd() {
    if (!selected) return;
    setError(null);
    if (existingSpeciesIds.has(selected.id)) {
      setError("Deze soort staat al in het plan. Pas het bestaande item aan.");
      return;
    }
    try {
      await addItem({
        planId,
        speciesId: selected.id,
        plannedQuantity: Math.max(1, mainQty),
        backupQuantity: Math.max(0, backupQty),
        plannedLocation: location.trim() || null,
      });
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toevoegen mislukt");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="tuinieren-theme sv-dialog max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">Plantsoort toevoegen</DialogTitle>
        </DialogHeader>

        {selected ? (
          <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
            {/* Selected species header */}
            <div className="sv-panel p-4 flex items-center gap-3">
              {selected.photo_url ? (
                <img src={selected.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover sv-icon-slot shrink-0" />
              ) : (
                <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
                  <Sprout className="h-5 w-5" strokeWidth={1.6} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="sv-heading text-lg truncate">{selected.name}</p>
                {selected.species && <p className="text-xs sv-muted italic truncate">{selected.species}</p>}
                {selected.pot_recommended_liters !== null ? (
                  <p className="text-xs sv-muted">Aanbevolen pot: {selected.pot_recommended_liters} L</p>
                ) : selected.pot_min_liters !== null ? (
                  <p className="text-xs sv-muted">Minimale pot: {selected.pot_min_liters} L</p>
                ) : (
                  <p className="text-xs sv-muted flex items-center gap-1">
                    <TriangleAlert className="h-3 w-3" /> Potinhoud ontbreekt
                  </p>
                )}
                {selected.sow_months.length > 0 && (
                  <p className="text-xs sv-muted capitalize">Zaaien: {selected.sow_months.join(", ")}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="ml-auto sv-muted text-xs underline shrink-0"
              >
                Wijzigen
              </button>
            </div>

            {/* Quantity controls */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sv-muted w-32 shrink-0">Hoofdplanten</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMainQty((q) => Math.max(1, q - 1))}
                    className="sv-button sv-button-thin-border h-8 w-8 flex items-center justify-center text-lg"
                  >
                    −
                  </button>
                  <Input
                    type="number"
                    min={1}
                    value={mainQty}
                    onChange={(e) => setMainQty(Math.max(1, Number(e.target.value)))}
                    className="text-center w-16"
                  />
                  <button
                    type="button"
                    onClick={() => setMainQty((q) => q + 1)}
                    className="sv-button sv-button-thin-border h-8 w-8 flex items-center justify-center text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sv-muted w-32 shrink-0">Reserveplanten</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBackupQty((q) => Math.max(0, q - 1))}
                    className="sv-button sv-button-thin-border h-8 w-8 flex items-center justify-center text-lg"
                  >
                    −
                  </button>
                  <Input
                    type="number"
                    min={0}
                    value={backupQty}
                    onChange={(e) => setBackupQty(Math.max(0, Number(e.target.value)))}
                    className="text-center w-16"
                  />
                  <button
                    type="button"
                    onClick={() => setBackupQty((q) => q + 1)}
                    className="sv-button sv-button-thin-border h-8 w-8 flex items-center justify-center text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
              {backupQty > 0 && (
                <p className="text-xs sv-muted pl-36">
                  Totaal opkweken: {mainQty + backupQty}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs sv-muted">Locatie (optioneel)</label>
              <Input
                placeholder="bijv. Kas, terras"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {existingSpeciesIds.has(selected.id) && (
              <p className="text-xs sv-destructive-text flex items-center gap-1">
                <TriangleAlert className="h-3 w-3" /> Deze soort staat al in het plan.
              </p>
            )}
            {error && <p className="text-xs sv-destructive-text">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sv-muted pointer-events-none" />
              <Input
                placeholder="Zoek op naam, soort of categorie..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-[32rem] overflow-y-auto space-y-1">
              {filtered.length === 0 ? (
                <p className="text-sm sv-muted text-center py-6">Geen resultaten.</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className={`w-full text-left sv-panel p-3 flex items-center gap-3 hover:-translate-y-0.5 transition-transform${
                      existingSpeciesIds.has(p.id) ? " opacity-50" : ""
                    }`}
                  >
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover sv-icon-slot shrink-0" />
                    ) : (
                      <div className="h-10 w-10 sv-icon-slot flex items-center justify-center shrink-0">
                        <Sprout className="h-4 w-4" strokeWidth={1.6} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="sv-heading text-base truncate">{p.name}</p>
                      <p className="text-xs sv-muted truncate">
                        {[p.species, p.category].filter(Boolean).join(" · ")}
                        {p.pot_recommended_liters ? ` · ${p.pot_recommended_liters} L` : ""}
                      </p>
                    </div>
                    {existingSpeciesIds.has(p.id) && (
                      <Check className="h-4 w-4 shrink-0 text-green-500" aria-label="Al toegevoegd" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="sv-button sv-button-ghost">
            Annuleer
          </Button>
          {selected && (
            <Button
              onClick={handleAdd}
              disabled={isAddingItem || existingSpeciesIds.has(selected.id)}
              className="sv-button"
            >
              {isAddingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Toevoegen</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EditItemDialog ───────────────────────────────────────────────────────────

function EditItemDialog({
  open,
  item,
  planId,
  onClose,
}: {
  open: boolean;
  item: CultivationPlanItem | null;
  planId: string;
  onClose: () => void;
}) {
  const [location, setLocation] = useState(item?.planned_location ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [backupQty, setBackupQty] = useState(item?.backup_quantity ?? 0);
  const [potOverride, setPotOverride] = useState<string>(
    item?.pot_liters_override != null ? String(item.pot_liters_override) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const { updateItem, isUpdatingItem } = useCultivationPlans();

  useMemo(() => {
    setLocation(item?.planned_location ?? "");
    setNotes(item?.notes ?? "");
    setBackupQty(item?.backup_quantity ?? 0);
    setPotOverride(item?.pot_liters_override != null ? String(item.pot_liters_override) : "");
    setError(null);
  }, [item]);

  async function handleSave() {
    if (!item) return;
    setError(null);
    if (backupQty < 0) {
      setError("Reserveaantal kan niet negatief zijn.");
      return;
    }
    const parsedOverride = potOverride.trim() ? Number(potOverride.trim()) : null;
    if (parsedOverride !== null && (isNaN(parsedOverride) || parsedOverride <= 0)) {
      setError("Voer een geldig getal in voor de potinhoud.");
      return;
    }
    try {
      await updateItem({
        planId,
        itemId: item.id,
        patch: {
          backup_quantity: backupQty,
          planned_location: location.trim() || null,
          notes: notes.trim() || null,
          pot_liters_override: parsedOverride,
        },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tuinieren-theme sv-dialog max-w-md">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">Item bewerken</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Backup quantity */}
          <div className="space-y-1">
            <label className="text-xs sv-muted">Reserveplanten</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBackupQty((q) => Math.max(0, q - 1))}
                className="sv-button sv-button-thin-border h-8 w-8 flex items-center justify-center text-lg"
              >
                −
              </button>
              <Input
                type="number"
                min={0}
                value={backupQty}
                onChange={(e) => setBackupQty(Math.max(0, Number(e.target.value)))}
                className="text-center w-20"
              />
              <button
                type="button"
                onClick={() => setBackupQty((q) => q + 1)}
                className="sv-button sv-button-thin-border h-8 w-8 flex items-center justify-center text-lg"
              >
                +
              </button>
            </div>
            <p className="text-xs sv-muted">Extra planten voor als hoofdplanten uitvallen of niet ontkiemen.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs sv-muted">Locatie</label>
            <Input
              placeholder="bijv. Kas, terras, zuidmuur"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs sv-muted">Notitie</label>
            <Textarea
              placeholder="Bijzonderheden..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs sv-muted">Handmatige potinhoud per plant (liters)</label>
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="Laat leeg voor standaard"
              value={potOverride}
              onChange={(e) => setPotOverride(e.target.value)}
            />
            <p className="text-xs sv-muted">Overschrijft de aanbevolen potinhoud van de soort.</p>
          </div>
          {error && <p className="text-xs sv-destructive-text">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="sv-button sv-button-ghost">
            Annuleer
          </Button>
          <Button onClick={handleSave} disabled={isUpdatingItem} className="sv-button">
            {isUpdatingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared form for PlantNowDialog and UseBackupDialog ───────────────────────

function PlantFormFields({
  customName,
  startedAt,
  location,
  potLiters,
  formError,
  onCustomNameChange,
  onStartedAtChange,
  onLocationChange,
  onPotLitersChange,
}: {
  customName: string;
  startedAt: string;
  location: string;
  potLiters: string;
  formError: string | null;
  onCustomNameChange: (v: string) => void;
  onStartedAtChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onPotLitersChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs sv-muted">Exemplaarnaam</label>
        <Input value={customName} onChange={(e) => onCustomNameChange(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs sv-muted">Startdatum seizoen</label>
          <Input type="date" value={startedAt} onChange={(e) => onStartedAtChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs sv-muted">Potinhoud (L)</label>
          <Input
            type="number"
            min={0}
            step={0.5}
            placeholder="—"
            value={potLiters}
            onChange={(e) => onPotLitersChange(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs sv-muted">Locatie</label>
        <Input placeholder="bijv. Kas" value={location} onChange={(e) => onLocationChange(e.target.value)} />
      </div>
      {formError && <p className="text-xs sv-destructive-text">{formError}</p>}
    </div>
  );
}

// ─── PlantNowDialog ───────────────────────────────────────────────────────────

function PlantNowDialog({
  open,
  planId,
  item,
  species,
  allInstances,
  onClose,
}: {
  open: boolean;
  planId: string;
  item: CultivationPlanItem | null;
  species: Plant | undefined;
  allInstances: PlantInstance[];
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultName = useMemo(() => {
    if (!species) return "";
    const existing = allInstances.filter((i) => i.species_id === species.id).map((i) => i.custom_name ?? "");
    return resolveInstanceNames(species.name, existing, 1)[0];
  }, [species, allInstances]);

  const defaultPot = useMemo(() => {
    if (!item || !species) return "";
    const liters = item.pot_liters_override ?? species.pot_recommended_liters ?? species.pot_min_liters ?? null;
    return liters != null ? String(liters) : "";
  }, [item, species]);

  const [customName, setCustomName] = useState(defaultName);
  const [startedAt, setStartedAt] = useState(today);
  const [location, setLocation] = useState(item?.planned_location ?? "");
  const [potLiters, setPotLiters] = useState(defaultPot);
  const [formError, setFormError] = useState<string | null>(null);

  useMemo(() => {
    setCustomName(defaultName);
    setStartedAt(today);
    setLocation(item?.planned_location ?? "");
    setPotLiters(defaultPot);
    setFormError(null);
  }, [item, defaultName, defaultPot, today]);

  const { plantNow, isPlanting } = useCultivationPlans();

  async function handlePlant() {
    if (!item || !species) return;
    setFormError(null);
    const parsedPot = potLiters.trim() ? Number(potLiters) : null;
    if (parsedPot !== null && (isNaN(parsedPot) || parsedPot <= 0)) {
      setFormError("Voer een geldige potinhoud in.");
      return;
    }
    try {
      await plantNow({
        planId,
        itemId: item.id,
        speciesId: species.id,
        plantName: species.name,
        customName: customName.trim() || defaultName,
        seasonStartedAt: startedAt,
        potSizeLiters: parsedPot,
        location: location.trim() || null,
      });
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Planten mislukt");
    }
  }

  if (!item || !species) return null;
  const remaining = item.planned_quantity - item.planted_quantity;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tuinieren-theme sv-dialog max-w-md">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">🌱 Plant nu</DialogTitle>
        </DialogHeader>

        <div className="sv-inset rounded-xl p-3 flex items-center gap-3">
          {species.photo_url ? (
            <img src={species.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover sv-icon-slot shrink-0" />
          ) : (
            <div className="h-10 w-10 sv-icon-slot flex items-center justify-center shrink-0">
              <Sprout className="h-4 w-4" strokeWidth={1.6} />
            </div>
          )}
          <div className="min-w-0">
            <p className="sv-heading text-base truncate">{species.name}</p>
            <p className="text-xs sv-muted">{remaining} hoofdplant{remaining !== 1 ? "en" : ""} nog te plaatsen</p>
          </div>
        </div>

        <PlantFormFields
          customName={customName}
          startedAt={startedAt}
          location={location}
          potLiters={potLiters}
          formError={formError}
          onCustomNameChange={setCustomName}
          onStartedAtChange={setStartedAt}
          onLocationChange={setLocation}
          onPotLitersChange={setPotLiters}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="sv-button sv-button-ghost">Annuleer</Button>
          <Button onClick={handlePlant} disabled={isPlanting} className="sv-button">
            {isPlanting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>🌱 Plant nu</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── UseBackupDialog ──────────────────────────────────────────────────────────

function UseBackupDialog({
  open,
  planId,
  item,
  species,
  allInstances,
  onClose,
}: {
  open: boolean;
  planId: string;
  item: CultivationPlanItem | null;
  species: Plant | undefined;
  allInstances: PlantInstance[];
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultName = useMemo(() => {
    if (!species) return "";
    const existing = allInstances.filter((i) => i.species_id === species.id).map((i) => i.custom_name ?? "");
    return resolveInstanceNames(species.name, existing, 1)[0];
  }, [species, allInstances]);

  const defaultPot = useMemo(() => {
    if (!item || !species) return "";
    const liters = item.pot_liters_override ?? species.pot_recommended_liters ?? species.pot_min_liters ?? null;
    return liters != null ? String(liters) : "";
  }, [item, species]);

  const [customName, setCustomName] = useState(defaultName);
  const [startedAt, setStartedAt] = useState(today);
  const [location, setLocation] = useState(item?.planned_location ?? "");
  const [potLiters, setPotLiters] = useState(defaultPot);
  const [formError, setFormError] = useState<string | null>(null);

  useMemo(() => {
    setCustomName(defaultName);
    setStartedAt(today);
    setLocation(item?.planned_location ?? "");
    setPotLiters(defaultPot);
    setFormError(null);
  }, [item, defaultName, defaultPot, today]);

  const { deployBackup, isDeployingBackup } = useCultivationPlans();

  async function handleDeploy() {
    if (!item || !species) return;
    setFormError(null);
    const parsedPot = potLiters.trim() ? Number(potLiters) : null;
    if (parsedPot !== null && (isNaN(parsedPot) || parsedPot <= 0)) {
      setFormError("Voer een geldige potinhoud in.");
      return;
    }
    try {
      await deployBackup({
        planId,
        itemId: item.id,
        speciesId: species.id,
        plantName: species.name,
        customName: customName.trim() || defaultName,
        seasonStartedAt: startedAt,
        potSizeLiters: parsedPot,
        location: location.trim() || null,
      });
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Reserve inzetten mislukt");
    }
  }

  if (!item || !species) return null;
  const available = item.backup_quantity ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tuinieren-theme sv-dialog max-w-md">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">Reserve inzetten</DialogTitle>
        </DialogHeader>

        <div className="sv-inset rounded-xl p-3 flex items-center gap-3">
          {species.photo_url ? (
            <img src={species.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover sv-icon-slot shrink-0" />
          ) : (
            <div className="h-10 w-10 sv-icon-slot flex items-center justify-center shrink-0">
              <Sprout className="h-4 w-4" strokeWidth={1.6} />
            </div>
          )}
          <div className="min-w-0">
            <p className="sv-heading text-base truncate">{species.name}</p>
            <p className="text-xs sv-muted">{available} reserveplant{available !== 1 ? "en" : ""} beschikbaar</p>
          </div>
        </div>

        <p className="text-sm sv-muted">
          Er wordt één plant-exemplaar aangemaakt en het reserveaantal wordt met één verlaagd.
        </p>

        <PlantFormFields
          customName={customName}
          startedAt={startedAt}
          location={location}
          potLiters={potLiters}
          formError={formError}
          onCustomNameChange={setCustomName}
          onStartedAtChange={setStartedAt}
          onLocationChange={setLocation}
          onPotLitersChange={setPotLiters}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="sv-button sv-button-ghost">Annuleer</Button>
          <Button onClick={handleDeploy} disabled={isDeployingBackup} className="sv-button">
            {isDeployingBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <>🌿 Reserve inzetten</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PlanListView ─────────────────────────────────────────────────────────────

function PlanListView() {
  const navigate = useNavigate();
  const { plans, plansLoading, setStatus, deletePlan, isDeletingPlan } = useCultivationPlans();
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [copyState, setCopyState] = useState<{ planId: string } | null>(null);
  const [deleteState, setDeleteState] = useState<{ planId: string; name: string } | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const itemsByPlan = useMemo(() => {
    const map = new Map<string, CultivationPlanItem[]>();
    for (const plan of plans) {
      const cached = queryClient.getQueryData<CultivationPlanItem[]>(["cultivation_plan_items", plan.id]);
      if (cached) map.set(plan.id, cached);
    }
    return map;
  }, [plans, queryClient]);

  const { data: plants = [] } = useQuery<Plant[]>({ queryKey: ["plants"], queryFn: fetchPlants });
  const speciesById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="sv-heading text-3xl">Teeltplanner</h1>
          <p className="text-sm sv-muted mt-1">Plan je tuinseizoen met soorten, aantallen en benodigdheden.</p>
        </div>
        <Button onClick={() => setNewPlanOpen(true)} className="sv-button flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nieuw teeltplan
        </Button>
      </div>

      {plansLoading ? (
        <div className="flex justify-center py-12 sv-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="sv-panel p-12 text-center">
          <Sprout className="h-10 w-10 mx-auto sv-muted" strokeWidth={1.4} />
          <p className="sv-heading text-2xl mt-4">Nog geen teeltplannen</p>
          <p className="text-sm sv-muted mt-1">Maak een plan voor je volgende tuinseizoen.</p>
          <Button onClick={() => setNewPlanOpen(true)} className="sv-button mt-6">
            <Plus className="h-4 w-4 mr-2" /> Nieuw teeltplan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const items = itemsByPlan.get(plan.id) ?? [];
            const totalMain = items.reduce((s, i) => s + i.planned_quantity, 0);
            const totalBackup = items.reduce((s, i) => s + (i.backup_quantity ?? 0), 0);
            const totalToGrow = totalMain + totalBackup;
            const totalPlanted = items.reduce((s, i) => s + i.planted_quantity, 0);
            const progress = planProgress(items);
            const totalLiters = totalLitersForPlan(items, speciesById);

            return (
              <div key={plan.id} className="sv-panel p-5 space-y-3 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="sv-heading text-xl truncate">{plan.name}</p>
                      <StatusBadge status={plan.status} />
                    </div>
                    <p className="text-xs sv-muted">{plan.plan_year}</p>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatusMenuOpen(statusMenuOpen === plan.id ? null : plan.id)}
                      className="sv-button sv-button-thin-border flex items-center gap-1 px-2 py-1 text-xs"
                    >
                      Status <ChevronDown className="h-3 w-3" />
                    </button>
                    {statusMenuOpen === plan.id && (
                      <div className="absolute right-0 top-full mt-1 z-20 sv-panel shadow-lg min-w-[140px] py-1">
                        {(["draft", "active", "completed", "archived"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => { setStatus(plan.id, s); setStatusMenuOpen(null); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:sv-inset ${plan.status === s ? "sv-badge-ok" : ""}`}
                          >
                            {PLAN_STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-0.5 text-sm">
                  <p className="sv-muted">{items.length} soort{items.length !== 1 ? "en" : ""}</p>
                  <p className="sv-muted">
                    {totalMain} hoofdplant{totalMain !== 1 ? "en" : ""}
                    {totalBackup > 0 && <> · {totalBackup} reserveplant{totalBackup !== 1 ? "en" : ""} · {totalToGrow} totaal opkweken</>}
                  </p>
                  <p className="sv-muted">{totalPlanted}/{totalMain} definitief geplant</p>
                  {totalLiters > 0 && <p className="sv-muted">~{totalLiters} L potgrond</p>}
                </div>

                {items.length > 0 && <ProgressBar percent={progress} />}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1 mt-auto">
                  <Button size="sm" onClick={() => navigate(`/tuingids/teeltplanner/${plan.id}`)} className="sv-button text-sm">
                    Openen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCopyState({ planId: plan.id })} className="sv-button sv-button-ghost text-sm">
                    <Copy className="h-3.5 w-3.5 mr-1" /> Kopiëren
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteState({ planId: plan.id, name: plan.name })} className="sv-button sv-button-ghost text-sm text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {statusMenuOpen && <div className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(null)} />}

      <NewPlanDialog
        open={newPlanOpen}
        onClose={() => setNewPlanOpen(false)}
        onCreated={(id) => { setNewPlanOpen(false); navigate(`/tuingids/teeltplanner/${id}`); }}
      />

      {copyState && (
        <CopyPlanDialog
          open={true}
          sourcePlanId={copyState.planId}
          onClose={() => setCopyState(null)}
          onCopied={(id) => { setCopyState(null); navigate(`/tuingids/teeltplanner/${id}`); }}
        />
      )}

      {deleteState && (
        <ConfirmDeleteDialog
          open={true}
          onClose={() => setDeleteState(null)}
          isPending={isDeletingPlan}
          title="Plan verwijderen"
          body={`Wil je "${deleteState.name}" definitief verwijderen? Bestaande geplante exemplaren blijven behouden.`}
          onConfirm={async () => { await deletePlan(deleteState.planId); setDeleteState(null); }}
        />
      )}
    </div>
  );
}

// ─── PlanDetailView ───────────────────────────────────────────────────────────

function PlanDetailView({ planId }: { planId: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overzicht" | "zaaikalender" | "benodigdheden">("overzicht");
  const [addSpeciesOpen, setAddSpeciesOpen] = useState(false);
  const [editItemState, setEditItemState] = useState<CultivationPlanItem | null>(null);
  const [plantNowState, setPlantNowState] = useState<CultivationPlanItem | null>(null);
  const [useBackupState, setUseBackupState] = useState<CultivationPlanItem | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState<CultivationPlanItem | null>(null);

  const { updatePlan, updateItem, removeItem, isUpdatingPlan, isRemovingItem } = useCultivationPlans();

  const { data: planWithItems, isLoading } = useQuery({
    queryKey: ["cultivation_plan_with_items", planId],
    queryFn: () => fetchCultivationPlanWithItems(planId),
  });

  const { items } = useCultivationPlanItems(planId);

  const { data: plants = [] } = useQuery<Plant[]>({ queryKey: ["plants"], queryFn: fetchPlants });
  const { data: allInstances = [] } = useQuery<PlantInstance[]>({
    queryKey: ["plant_instances", "all"],
    queryFn: fetchPlantInstances,
  });

  const speciesById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const existingSpeciesIds = useMemo(() => new Set(items.map((i) => i.species_id)), [items]);

  const plan = planWithItems ?? null;

  const totalMain = items.reduce((s, i) => s + i.planned_quantity, 0);
  const totalBackup = items.reduce((s, i) => s + (i.backup_quantity ?? 0), 0);
  const totalToGrow = totalMain + totalBackup;
  const totalPlanted = items.reduce((s, i) => s + i.planted_quantity, 0);
  const totalRemaining = totalMain - totalPlanted;
  const progress = planProgress(items);
  const totalLiters = totalLitersForPlan(items, speciesById);

  // Zaaikalender: group items by sow month in calendar order; use total to grow
  const zaaikalenderGroups = useMemo(() => {
    const withMonths: { month: string; item: CultivationPlanItem; species: Plant }[] = [];
    const noMonth: { item: CultivationPlanItem; species: Plant }[] = [];

    for (const item of items) {
      const species = speciesById.get(item.species_id);
      if (!species) continue;
      if (species.sow_months.length === 0) {
        noMonth.push({ item, species });
      } else {
        for (const m of species.sow_months) {
          withMonths.push({ month: m, item, species });
        }
      }
    }

    const grouped = new Map<string, { item: CultivationPlanItem; species: Plant }[]>();
    for (const m of MONTH_OPTIONS) {
      const rows = withMonths.filter((r) => r.month === m);
      if (rows.length > 0) grouped.set(m, rows.map((r) => ({ item: r.item, species: r.species })));
    }

    return { grouped, noMonth };
  }, [items, speciesById]);

  // Benodigdheden: pot grouping on planned_quantity (main plants) only
  const potGroups = useMemo(() => {
    const groups = new Map<number, number>();
    const noInfo: { item: CultivationPlanItem; species: Plant }[] = [];
    const needsSupport: { item: CultivationPlanItem; species: Plant }[] = [];
    const withBackup: { item: CultivationPlanItem; species: Plant }[] = [];

    for (const item of items) {
      const species = speciesById.get(item.species_id);
      if (!species) continue;
      const liters = litersPerPlant(item, species);
      if (liters === null) {
        noInfo.push({ item, species });
      } else {
        const roundedLiters = Math.round(liters);
        // Pots: based on planned_quantity (main plants) only
        groups.set(roundedLiters, (groups.get(roundedLiters) ?? 0) + item.planned_quantity);
      }
      const habit = (species.growth_habit ?? []).map((h) => h.toLowerCase());
      if (habit.some((h) => h.includes("klimmer") || h.includes("steun") || h.includes("rankend") || h.includes("sling"))) {
        needsSupport.push({ item, species });
      }
      if ((item.backup_quantity ?? 0) > 0) {
        withBackup.push({ item, species });
      }
    }

    return {
      groups: [...groups.entries()].sort((a, b) => b[0] - a[0]),
      noInfo,
      needsSupport,
      withBackup,
    };
  }, [items, speciesById]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 sv-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="sv-panel p-12 text-center">
        <p className="sv-heading text-2xl">Plan niet gevonden</p>
        <Button onClick={() => navigate("/tuingids/teeltplanner")} className="sv-button mt-4">
          Terug naar overzicht
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back + title */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate("/tuingids/teeltplanner")}
          className="sv-button sv-button-thin-border flex items-center gap-1 px-3 py-2 text-sm shrink-0 mt-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Overzicht</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="sv-heading text-3xl truncate">{plan.name}</h1>
            <StatusBadge status={plan.status} />
            <button
              type="button"
              onClick={() => { setEditName(plan.name); setEditNotes(plan.notes ?? ""); setEditNameOpen(true); }}
              className="sv-muted"
              aria-label="Plan bewerken"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm sv-muted">{plan.plan_year}</p>
          {plan.notes && <p className="text-sm sv-muted mt-0.5">{plan.notes}</p>}
        </div>
        <button
          type="button"
          onClick={() => setCopyOpen(true)}
          className="sv-button sv-button-thin-border flex items-center gap-1 px-3 py-2 text-sm shrink-0"
        >
          <Copy className="h-4 w-4" />
          <span className="hidden sm:inline">Kopiëren</span>
        </button>
      </div>

      {/* Stats summary */}
      <div className="sv-panel p-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Soorten", value: items.length },
            { label: "Hoofdplanten", value: totalMain },
            { label: "Reserveplanten", value: totalBackup },
            { label: "Totaal opkweken", value: totalToGrow },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="sv-heading text-3xl">{s.value}</p>
              <p className="text-xs sv-muted">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm sv-muted">
            {totalPlanted} van {totalMain} hoofdplanten definitief geplant
            {totalRemaining > 0 && <> · {totalRemaining} nog te plaatsen</>}
          </p>
        </div>
        {totalLiters > 0 && (
          <p className="text-sm sv-muted text-center">Geschatte potgrond (hoofdplanten): ~{totalLiters} L</p>
        )}
        {items.length > 0 && <ProgressBar percent={progress} />}
      </div>

      {/* Tabs */}
      <div className="flex sv-inset rounded-full p-1 gap-1 w-fit flex-wrap">
        {(["overzicht", "zaaikalender", "benodigdheden"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={segBtn(tab === t)}>
            {t === "overzicht" ? "Overzicht" : t === "zaaikalender" ? "Zaaikalender" : "Benodigdheden"}
          </button>
        ))}
      </div>

      {/* ── Overzicht tab ── */}
      {tab === "overzicht" && (
        <div className="space-y-4">
          <Button onClick={() => setAddSpeciesOpen(true)} className="sv-button flex items-center gap-2">
            <Plus className="h-4 w-4" /> Soort toevoegen
          </Button>

          {items.length === 0 ? (
            <div className="sv-panel p-10 text-center">
              <Sprout className="h-10 w-10 mx-auto sv-muted" strokeWidth={1.4} />
              <p className="sv-heading text-xl mt-4">Nog geen plantsoorten</p>
              <p className="text-sm sv-muted mt-1">Voeg planten uit je database toe aan dit plan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const species = speciesById.get(item.species_id);
                const lPerPlant = species ? litersPerPlant(item, species) : null;
                const totalL = species ? totalLitersForItem(item, species) : null;
                const backup = item.backup_quantity ?? 0;
                const totalGrow = getTotalToGrow(item);
                const remaining = item.planned_quantity - item.planted_quantity;
                const allPlanted = remaining <= 0;

                return (
                  <div key={item.id} className="sv-panel p-4 space-y-3">
                    {/* Species header */}
                    <div className="flex items-start gap-3">
                      {species?.photo_url ? (
                        <img src={species.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover sv-icon-slot shrink-0" />
                      ) : (
                        <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
                          <Sprout className="h-5 w-5" strokeWidth={1.6} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="sv-heading text-lg truncate">{species?.name ?? "Onbekende soort"}</p>
                        {species?.species && <p className="text-xs sv-muted italic">{species.species}</p>}

                        {/* Quantity stats */}
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                          <span className="sv-muted">Hoofdplanten: <strong>{item.planned_quantity}</strong></span>
                          {backup > 0 && (
                            <span className="sv-muted">Reserveplanten: <strong>{backup}</strong></span>
                          )}
                          {backup > 0 && (
                            <span className="sv-muted">Totaal opkweken: <strong>{totalGrow}</strong></span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                          <span className="sv-muted">Definitief geplant: <strong>{item.planted_quantity}</strong></span>
                          <span className="sv-muted">Nog te planten: <strong>{Math.max(0, remaining)}</strong></span>
                        </div>

                        {/* Pot info (based on main plants only) */}
                        {lPerPlant !== null ? (
                          <p className="text-xs sv-muted">
                            {item.pot_liters_override != null ? "Handmatige" : "Aanbevolen"} pot: {lPerPlant} L/plant
                            {totalL !== null && ` · Totaal definitief: ~${totalL} L`}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <TriangleAlert className="h-3 w-3" /> Potinhoud ontbreekt
                          </p>
                        )}

                        {species && species.sow_months.length > 0 && (
                          <p className="text-xs sv-muted capitalize">Zaaien: {species.sow_months.join(", ")}</p>
                        )}
                        {item.planned_location && <p className="text-xs sv-muted">📍 {item.planned_location}</p>}
                        {item.notes && <p className="text-xs sv-muted">{item.notes}</p>}
                      </div>
                    </div>

                    {/* Steppers */}
                    <div className="space-y-1.5 pt-1">
                      <Stepper
                        label="Hoofdplanten"
                        value={item.planned_quantity}
                        min={Math.max(1, item.planted_quantity)}
                        onDecrement={() =>
                          updateItem({
                            planId,
                            itemId: item.id,
                            patch: { planned_quantity: Math.max(item.planted_quantity, item.planned_quantity - 1) },
                          })
                        }
                        onIncrement={() =>
                          updateItem({ planId, itemId: item.id, patch: { planned_quantity: item.planned_quantity + 1 } })
                        }
                      />
                      <Stepper
                        label="Reserveplanten"
                        value={backup}
                        min={0}
                        onDecrement={() =>
                          updateItem({ planId, itemId: item.id, patch: { backup_quantity: Math.max(0, backup - 1) } })
                        }
                        onIncrement={() =>
                          updateItem({ planId, itemId: item.id, patch: { backup_quantity: backup + 1 } })
                        }
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditItemState(item)}
                        className="sv-button sv-button-thin-border flex items-center gap-1 px-2.5 py-1.5 text-xs"
                      >
                        <Pencil className="h-3 w-3" /> Bewerken
                      </button>

                      {allPlanted ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Check className="h-4 w-4" /> Alles geplant
                          {backup > 0 && <span className="text-xs sv-muted font-normal">· {backup} reserve{backup !== 1 ? "planten" : "plant"} gepland</span>}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPlantNowState(item)}
                          className="sv-button flex items-center gap-1 px-3 py-1.5 text-sm"
                        >
                          🌱 Plant nu
                        </button>
                      )}

                      {backup > 0 && (
                        <button
                          type="button"
                          onClick={() => setUseBackupState(item)}
                          className="sv-button sv-button-thin-border flex items-center gap-1 px-3 py-1.5 text-sm"
                        >
                          🌿 Reserve inzetten
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setRemoveConfirm(item)}
                        className="ml-auto sv-muted"
                        aria-label="Verwijder uit plan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Zaaikalender tab ── */}
      {tab === "zaaikalender" && (
        <div className="space-y-5">
          {zaaikalenderGroups.grouped.size === 0 && zaaikalenderGroups.noMonth.length === 0 ? (
            <p className="text-sm sv-muted">Voeg eerst plantsoorten toe aan het plan.</p>
          ) : (
            <>
              {[...zaaikalenderGroups.grouped.entries()].map(([month, rows]) => (
                <div key={month} className="space-y-2">
                  <p className="sv-heading text-xl capitalize">{month}</p>
                  <div className="space-y-1.5">
                    {rows.map(({ item, species }) => {
                      const backup = item.backup_quantity ?? 0;
                      const total = getTotalToGrow(item);
                      return (
                        <div key={item.id} className="sv-inset rounded-lg px-4 py-2.5 flex items-center gap-3">
                          {species.photo_url ? (
                            <img src={species.photo_url} alt="" className="h-8 w-8 rounded sv-icon-slot shrink-0 object-cover" />
                          ) : (
                            <Sprout className="h-4 w-4 sv-muted shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{species.name}</p>
                            {backup > 0 && (
                              <p className="text-xs sv-muted">{item.planned_quantity} hoofd + {backup} reserve</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">{total} opkweken</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {zaaikalenderGroups.noMonth.length > 0 && (
                <div className="space-y-2">
                  <p className="sv-heading text-xl sv-muted">Geen zaaimoment beschikbaar</p>
                  <div className="space-y-1.5">
                    {zaaikalenderGroups.noMonth.map(({ item, species }) => {
                      const backup = item.backup_quantity ?? 0;
                      const total = getTotalToGrow(item);
                      return (
                        <div key={item.id} className="sv-inset rounded-lg px-4 py-2.5 flex items-center gap-3">
                          <Sprout className="h-4 w-4 sv-muted shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{species.name}</p>
                            {backup > 0 && (
                              <p className="text-xs sv-muted">{item.planned_quantity} hoofd + {backup} reserve</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">{total} opkweken</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Benodigdheden tab ── */}
      {tab === "benodigdheden" && (
        <div className="space-y-6">
          {/* Potgrond — based on planned_quantity (main plants) only */}
          <div className="sv-panel p-5 space-y-3">
            <div className="flex items-baseline gap-2">
              <p className="sv-heading text-xl">Potgrond</p>
              <p className="text-xs sv-muted">(definitieve hoofdplanten)</p>
            </div>
            {totalLiters > 0 ? (
              <>
                <p className="text-2xl font-bold">~{totalLiters} L</p>
                <div className="space-y-1.5">
                  {items.map((item) => {
                    const species = speciesById.get(item.species_id);
                    if (!species) return null;
                    const t = totalLitersForItem(item, species);
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="sv-muted truncate">{species.name}</span>
                        {t !== null ? (
                          <span className="shrink-0">~{t} L</span>
                        ) : (
                          <span className="text-amber-600 text-xs flex items-center gap-1 shrink-0">
                            <TriangleAlert className="h-3 w-3" /> Potinhoud ontbreekt
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm sv-muted">Voeg potinhoud toe aan soorten om de benodigde potgrond te berekenen.</p>
            )}
          </div>

          {/* Potten — based on planned_quantity (main plants) only */}
          <div className="sv-panel p-5 space-y-3">
            <div className="flex items-baseline gap-2">
              <p className="sv-heading text-xl">Potten</p>
              <p className="text-xs sv-muted">(definitieve hoofdplanten)</p>
            </div>
            {potGroups.groups.length === 0 ? (
              <p className="text-sm sv-muted">Geen potinformatie beschikbaar.</p>
            ) : (
              <div className="space-y-1.5">
                {potGroups.groups.map(([liters, count]) => (
                  <div key={liters} className="flex items-center justify-between text-sm">
                    <span className="sv-muted">{liters} liter</span>
                    <span className="font-medium">{count} pot{count !== 1 ? "ten" : ""}</span>
                  </div>
                ))}
              </div>
            )}
            {potGroups.noInfo.length > 0 && (
              <div className="pt-2 space-y-1">
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <TriangleAlert className="h-3 w-3" /> Potinhoud ontbreekt voor:
                </p>
                {potGroups.noInfo.map(({ species }) => (
                  <p key={species.id} className="text-xs sv-muted pl-4">{species.name}</p>
                ))}
              </div>
            )}
          </div>

          {/* Reserveplanten opkweken */}
          {potGroups.withBackup.length > 0 && (
            <div className="sv-panel p-5 space-y-3">
              <div className="flex items-baseline gap-2">
                <p className="sv-heading text-xl">Reserveplanten opkweken</p>
              </div>
              <p className="text-xs sv-muted">
                Reserveplanten worden doorgaans gestart in zaaitrays of grondblokken. Definitieve potgrond is hier niet meegerekend.
              </p>
              <div className="space-y-1.5">
                {potGroups.withBackup.map(({ item, species }) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="sv-muted">{species.name}</span>
                    <span className="font-medium">{item.backup_quantity ?? 0} reserveplant{(item.backup_quantity ?? 0) !== 1 ? "en" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steunmateriaal */}
          {potGroups.needsSupport.length > 0 && (
            <div className="sv-panel p-5 space-y-3">
              <p className="sv-heading text-xl">Mogelijk steunmateriaal nodig</p>
              <div className="space-y-1.5">
                {potGroups.needsSupport.map(({ item, species }) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="sv-muted">{species.name}</span>
                    <span>{item.planned_quantity}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ── */}
      <AddSpeciesDialog
        open={addSpeciesOpen}
        planId={planId}
        existingSpeciesIds={existingSpeciesIds}
        onClose={() => setAddSpeciesOpen(false)}
      />

      <EditItemDialog
        open={!!editItemState}
        item={editItemState}
        planId={planId}
        onClose={() => setEditItemState(null)}
      />

      <PlantNowDialog
        open={!!plantNowState}
        planId={planId}
        item={plantNowState}
        species={plantNowState ? speciesById.get(plantNowState.species_id) : undefined}
        allInstances={allInstances}
        onClose={() => setPlantNowState(null)}
      />

      <UseBackupDialog
        open={!!useBackupState}
        planId={planId}
        item={useBackupState}
        species={useBackupState ? speciesById.get(useBackupState.species_id) : undefined}
        allInstances={allInstances}
        onClose={() => setUseBackupState(null)}
      />

      <CopyPlanDialog
        open={copyOpen}
        sourcePlanId={planId}
        onClose={() => setCopyOpen(false)}
        onCopied={(id) => { setCopyOpen(false); navigate(`/tuingids/teeltplanner/${id}`); }}
      />

      {/* Edit plan name/notes */}
      <Dialog open={editNameOpen} onOpenChange={(o) => !o && setEditNameOpen(false)}>
        <DialogContent className="tuinieren-theme sv-dialog max-w-md">
          <DialogHeader>
            <DialogTitle className="sv-heading text-2xl">Plan bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs sv-muted">Naam</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs sv-muted">Notitie</label>
              <Textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditNameOpen(false)} className="sv-button sv-button-ghost">
              Annuleer
            </Button>
            <Button
              disabled={isUpdatingPlan}
              onClick={async () => {
                await updatePlan(plan.id, {
                  name: editName.trim() || plan.name,
                  notes: editNotes.trim() || null,
                });
                setEditNameOpen(false);
              }}
              className="sv-button"
            >
              {isUpdatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {removeConfirm && (
        <ConfirmDeleteDialog
          open={true}
          onClose={() => setRemoveConfirm(null)}
          isPending={isRemovingItem}
          title="Soort verwijderen"
          body={`Wil je ${speciesById.get(removeConfirm.species_id)?.name ?? "deze soort"} uit het plan verwijderen?`}
          onConfirm={async () => {
            await removeItem({ planId, itemId: removeConfirm.id });
            setRemoveConfirm(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function TuingidsTeeltplanner() {
  const { planId } = useParams<{ planId?: string }>();
  return planId ? <PlanDetailView planId={planId} /> : <PlanListView />;
}
