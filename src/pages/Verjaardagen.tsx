import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, X, Cake, Heart, Flower2, Download } from "lucide-react";

type EntryType = "verjaardag" | "trouwdag" | "sterfdag";

type Birthday = {
  id: string;
  name: string;
  day: number;
  month: number;
  year: number | null;
  notes: string;
  type: EntryType;
};

type BirthdayWithNext = Birthday & { next: Date; daysUntil: number };

const MONTHS = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];

const TYPE_CONFIG: Record<EntryType, {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconColor: string;
  todayEmoji: string;
  yearLabel: string;
  ageLabel: (age: number) => string;
}> = {
  verjaardag: {
    label: "Verjaardag",
    icon: Cake,
    iconColor: "text-primary",
    todayEmoji: "🎂",
    yearLabel: "Geboortejaar",
    ageLabel: (age) => `wordt ${age}`,
  },
  trouwdag: {
    label: "Trouwdag",
    icon: Heart,
    iconColor: "text-rose-400",
    todayEmoji: "💍",
    yearLabel: "Trouwjaar",
    ageLabel: (age) => `${age} jaar getrouwd`,
  },
  sterfdag: {
    label: "Sterfdag",
    icon: Flower2,
    iconColor: "text-muted-foreground",
    todayEmoji: "🕯️",
    yearLabel: "Sterfjaar",
    ageLabel: (age) => `${age} jaar geleden`,
  },
};

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

function daysLabel(days: number, type: EntryType): { text: string; highlight: boolean } {
  const emoji = TYPE_CONFIG[type].todayEmoji;
  if (days === 0) return { text: `Vandaag! ${emoji}`, highlight: true };
  if (days === 1) return { text: "Morgen", highlight: true };
  if (days === 2) return { text: "Overmorgen", highlight: false };
  return { text: `Over ${days} dagen`, highlight: false };
}

export default function Verjaardagen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Birthday | null>(null);
  const [type, setType] = useState<EntryType>("verjaardag");
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

  function handleExport() {
    const data = birthdays.map(({ id: _id, ...b }) => b);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verjaardagen-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const saveBirthday = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        day: parseInt(day),
        month: parseInt(month),
        year: year ? parseInt(year) : null,
        notes,
        type,
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
    setType("verjaardag");
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
    setType(b.type ?? "verjaardag");
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
  const currentConfig = TYPE_CONFIG[type];

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overzicht</p>
          <h1 className="font-serif text-3xl font-semibold mt-1">Kalender</h1>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={birthdays.length === 0} className="rounded-xl gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporteer</span>
          </Button>
          <Button onClick={openNew} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Toevoegen</span>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && birthdays.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nog geen items — voeg er een toe.
        </p>
      )}

      {sorted.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/50">
          {sorted.map((b) => {
            const entryType = (b.type ?? "verjaardag") as EntryType;
            const config = TYPE_CONFIG[entryType];
            const Icon = config.icon;
            const { text, highlight } = daysLabel(b.daysUntil, entryType);
            const age = b.year ? (b.next.getFullYear() - b.year) : null;
            return (
              <button
                key={b.id}
                onClick={() => openEdit(b)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-accent/30 transition-colors ${
                  b.daysUntil === 0 ? "bg-primary/5" : ""
                }`}
              >
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  b.daysUntil === 0 ? "bg-primary/10" : "bg-muted"
                }`}>
                  <Icon className={`h-[18px] w-[18px] ${b.daysUntil === 0 ? "text-primary" : config.iconColor}`} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm leading-tight">{b.name}</p>
                    <span className="text-xs text-muted-foreground/60 font-normal">{config.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {b.day} {MONTHS[b.month - 1]}{age ? ` · ${config.ageLabel(age)}` : ""}
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

      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); setConfirmDelete(false); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col [&>button.absolute]:hidden p-0"
          style={{ height: "85svh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
            <p className="flex-1 font-semibold text-base">
              {editing ? editing.name : `Nieuwe ${currentConfig.label.toLowerCase()}`}
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
            {/* Type toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
              <div className="flex gap-2">
                {(Object.entries(TYPE_CONFIG) as [EntryType, typeof TYPE_CONFIG[EntryType]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        type === key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.6} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

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

            {/* Year */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {currentConfig.yearLabel} <span className="normal-case font-normal">(optioneel)</span>
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
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notities</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Schrijf hier notities..."
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
