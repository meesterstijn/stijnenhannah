import { useState } from "react";
import { Check, Palette, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ORIGINAL_SELECTION,
  matchingPreset,
  presetSelection,
} from "./composer";
import { THEME_STYLES } from "./presets";
import { ThemePreview } from "./ThemePreview";
import { useTheme } from "./ThemeProvider";
import {
  CATEGORY_LABELS,
  ORIGINAL,
  THEME_CATEGORIES,
  type ThemeChoice,
  type ThemeSelection,
} from "./tokens";

const STYLES = Object.values(THEME_STYLES);

function sameSelection(a: ThemeSelection, b: ThemeSelection) {
  return THEME_CATEGORIES.every((c) => a[c] === b[c]);
}

// Paletknop + instellingenpaneel. De knop neemt de kleur van zijn omgeving
// over (currentColor), zodat hij in elke bestaande bovenbalk past.
export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Thema kiezen"
          title="Thema kiezen"
          className={`inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        >
          <Palette className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="ht-switcher flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="px-5 pb-3 pt-5 text-left">
          <SheetTitle className="text-xl">Thema</SheetTitle>
          <SheetDescription>
            Wissel direct van stijl, of stel je eigen combinatie samen.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="themes" className="flex-1 px-5 pb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="themes">Thema's</TabsTrigger>
            <TabsTrigger value="custom">Zelf samenstellen</TabsTrigger>
          </TabsList>
          <TabsContent value="themes" className="mt-4">
            <ThemesTab />
          </TabsContent>
          <TabsContent value="custom" className="mt-4">
            <CustomTab />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ThemesTab() {
  const { selection, applyPreset, applySelection, customPresets } = useTheme();
  const active = matchingPreset(selection);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <PresetCard
          name="Origineel"
          subtitle="Zoals de site altijd was"
          selection={ORIGINAL_SELECTION}
          active={active === ORIGINAL}
          onSelect={() => applyPreset(ORIGINAL)}
        />
        {STYLES.map((style) => (
          <PresetCard
            key={style.id}
            name={style.name}
            subtitle={`Stijl ${style.number}`}
            selection={presetSelection(style.id)}
            active={active === style.id}
            onSelect={() => applyPreset(style.id)}
          />
        ))}
      </div>
      {active === null && (
        <p className="text-sm text-muted-foreground">
          Je gebruikt nu een eigen combinatie.
        </p>
      )}
      {customPresets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Mijn combinaties
          </p>
          <div className="grid grid-cols-2 gap-3">
            {customPresets.map((preset) => (
              <PresetCard
                key={preset.id}
                name={preset.name}
                subtitle="Eigen combinatie"
                selection={preset.selection}
                active={sameSelection(selection, preset.selection)}
                onSelect={() => applySelection(preset.selection)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PresetCard({
  name,
  subtitle,
  selection,
  active,
  onSelect,
}: {
  name: string;
  subtitle: string;
  selection: ThemeSelection;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`group relative flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-foreground/30"
      }`}
    >
      <ThemePreview selection={selection} />
      <span className="min-w-0 px-0.5">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      </span>
      {active && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="sr-only">Actief</span>
        </span>
      )}
    </button>
  );
}

function CustomTab() {
  const {
    selection,
    setCategory,
    applyPreset,
    applySelection,
    customPresets,
    saveCustomPreset,
    deleteCustomPreset,
  } = useTheme();
  const [name, setName] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    saveCustomPreset(name);
    setName("");
  }

  return (
    <div className="space-y-5">
      <ThemePreview selection={selection} className="ht-preview--large" />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        {THEME_CATEGORIES.map((category) => (
          <label key={category} className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </span>
            <select
              value={selection[category]}
              onChange={(e) =>
                setCategory(category, e.target.value as ThemeChoice)
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={ORIGINAL}>Origineel</option>
              {STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.number}. {style.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => applyPreset(ORIGINAL)}
      >
        <RotateCcw />
        Herstellen naar standaardthema
      </Button>

      <form onSubmit={handleSave} className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Mijn combinatie opslaan
        </p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam, bv. Avondrust"
            maxLength={40}
            aria-label="Naam van je combinatie"
          />
          <Button type="submit" disabled={!name.trim()} className="shrink-0">
            <Save />
            Opslaan
          </Button>
        </div>
      </form>

      {customPresets.length > 0 && (
        <ul className="space-y-2">
          {customPresets.map((preset) => {
            const active = sameSelection(selection, preset.selection);
            return (
              <li
                key={preset.id}
                className={`flex items-center gap-3 rounded-xl border p-2 ${active ? "border-primary" : "border-border"}`}
              >
                <button
                  type="button"
                  onClick={() => applySelection(preset.selection)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ThemePreview
                    selection={preset.selection}
                    className="ht-preview--thumb"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {preset.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {active ? "Actief" : "Kies deze combinatie"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteCustomPreset(preset.id)}
                  aria-label={`${preset.name} verwijderen`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
