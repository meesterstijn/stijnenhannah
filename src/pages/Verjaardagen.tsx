import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, X, Cake } from "lucide-react";

type Birthday = {
  id: string;
  name: string;
  day: number;
  month: number;
  year: number | null;
  notes: string;
};

type BirthdayWithNext = Birthday & { next: Date; daysUntil: number };

const MONTHS = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];

async function fetchBirthdays(): Promise<Birthday[]> {
  const { data, error } = await supabase
    .from("birthdays")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function sortedByNext(birthdays: Birthday[]): BirthdayWithNext[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return birthdays
    .map((b) => {
      const thisYear = today.getFullYear();
      let next = new Date(thisYear, b.month - 1, b.day);
      if (next < today) next = new Date(thisYear + 1, b.month - 1, b.day);
      const daysUntil = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...b, next, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

function daysLabel(days: number): { text: string; highlight: boolean } {
  if (days === 0) return { text: "Vandaag! 🎂", highlight: true };
  if (days === 1) return { text: "Morgen", highlight: true };
  if (days === 2) return { text: "Overmorgen", highlight: false };
  return { text: `Over ${days} dagen`, highlight: false };
}

function turningAge(year: number, nextDate: Date): number {
  return nextDate.getFullYear() - year;
}

export default function Verjaardagen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Birthday | null>(null);
  const [name, setName] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("1");
  const [year, setYear] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: birthdays = [], isLoading } = useQuery({
    queryKey: ["birthdays"],
    queryFn: fetchBirthdays,
  });

  const sorted = sortedByNext(birthdays);

  const saveBirthday = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        day: parseInt(day),
        month: parseInt(month),
        year: year ? parseInt(year) : null,
        notes,
        created_by: session?.user.id,
      };
      if (editing) {
        const { error } = await supabase.from("birthdays").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("birthdays").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthdays"] });
      setSaveError(null);
      setSheetOpen(false);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const deleteBirthday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("birthdays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthdays"] });
      setSheetOpen(false);
    },
  });

  function openNew() {
    setEditing(null);
    setName("");
    setDay("");
    setMonth("1");
    setYear("");
    setNotes("");
    setConfirmDelete(false);
    setSaveError(null);
    setSheetOpen(true);
  }

  function openEdit(b: Birthday) {
    setEditing(b);
    setName(b.name);
    setDay(String(b.day));
    setMonth(String(b.month));
    setYear(b.year ? String(b.year) : "");
    setNotes(b.notes);
    setConfirmDelete(false);
    setSaveError(null);
    setSheetOpen(true);
  }

  const canSave = name.trim() && day && parseInt(day) >= 1 && parseInt(day) <= 31;

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overzicht</p>
          <h1 className="font-serif text-3xl font-semibold mt-1">Verjaardagen</h1>
        </div>
        <Button onClick={openNew} className="rounded-xl gap-2 mb-1">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Toevoegen</span>
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && birthdays.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nog geen verjaardagen — voeg er een toe.
        </p>
      )}

      {sorted.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/50">
          {sorted.map((b) => {
            const { text, highlight } = daysLabel(b.daysUntil);
            const age = b.year ? turningAge(b.year, b.next) : null;
            return (
              <button
                key={b.id}
                onClick={() => openEdit(b)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-accent/30 transition-colors ${
                  b.daysUntil === 0 ? "bg-primary/5" : ""
                }`}
              >
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  b.daysUntil === 0 ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <Cake className="h-4.5 w-4.5 h-[18px] w-[18px]" strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{b.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {b.day} {MONTHS[b.month - 1]}{age ? ` · wordt ${age}` : ""}
                  </p>
                </div>
                <span className={`text-xs shrink-0 font-medium ${highlight ? "text-primary" : "text-muted-foreground"}`}>
                  {text}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sheet: add / edit */}
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); setConfirmDelete(false); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col [&>button.absolute]:hidden p-0"
          style={{ height: "85svh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
            <p className="flex-1 font-semibold text-base">
              {editing ? editing.name : "Nieuwe verjaardag"}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {editing && !confirmDelete && (
                <Button type="button" variant="ghost" size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {confirmDelete && (
                <>
                  <Button type="button" variant="ghost" size="sm" className="rounded-xl text-xs"
                    onClick={() => setConfirmDelete(false)}>Annuleer</Button>
                  <Button type="button" variant="destructive" size="sm" className="rounded-xl text-xs"
                    disabled={deleteBirthday.isPending}
                    onClick={() => deleteBirthday.mutate(editing!.id)}>
                    {deleteBirthday.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verwijder"}
                  </Button>
                </>
              )}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Naam</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Naam..."
                className="bg-card"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  placeholder="Dag"
                  className="bg-card w-24"
                />
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Year (optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Geboortejaar <span className="normal-case font-normal">(optioneel, voor leeftijd)</span>
              </label>
              <Input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="bijv. 1990"
                className="bg-card w-36"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cadeautips & ideeën</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Schrijf hier cadeautips of ideeën..."
                rows={6}
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}
          </div>

          <div className="px-5 pt-2 pb-6 shrink-0 border-t border-border/40">
            <Button
              className="w-full rounded-xl"
              disabled={!canSave || saveBirthday.isPending}
              onClick={() => saveBirthday.mutate()}
            >
              {saveBirthday.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editing ? "Opslaan" : "Toevoegen"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
