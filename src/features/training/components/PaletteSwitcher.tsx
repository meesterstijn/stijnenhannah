import { useMemo, useState, type CSSProperties } from "react";
import { Check, Palette as PaletteIcon, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_PALETTE,
  DEFAULT_PALETTE_ID,
  ROLE_LABELS,
  assignRoles,
  paletteTokens,
  parseHex,
  type Palette,
  type PaletteColors,
} from "@/features/training/domain/palette";
import {
  useProfile,
  useUpdateProfile,
} from "@/features/training/hooks/useTrainingData";
import { newId } from "@/features/training/lib/ids";
import { Segment, Sheet } from "./ui";

const MAX_PALETTES = 20;

// Actief palet en de CSS-variabelen ervoor. Het standaardpalet gebruikt de
// vaste waarden uit training.css (undefined = niets overschrijven).
export function useActivePalette(scheme: "light" | "dark") {
  const { settings } = useProfile();
  return useMemo(() => {
    const palette = settings.palettes.find((p) => p.id === settings.paletteId);
    if (!palette || palette.id === DEFAULT_PALETTE_ID)
      return { palette: DEFAULT_PALETTE, vars: undefined };
    return { palette, vars: paletteTokens(palette.colors, scheme) };
  }, [settings.palettes, settings.paletteId, scheme]);
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span
      className="flex shrink-0 overflow-hidden rounded-full border"
      style={{ borderColor: "var(--tr-border)" }}
      aria-hidden="true"
    >
      {colors.map((c, i) => (
        <span key={i} className="h-7 w-5" style={{ background: c }} />
      ))}
    </span>
  );
}

// Kleine proefweergave met de berekende rollen.
function Preview({
  colors,
  scheme,
}: {
  colors: string[];
  scheme: "light" | "dark";
}) {
  const vars = paletteTokens(colors, scheme) as CSSProperties;
  return (
    <div
      className="training-theme rounded-2xl p-3"
      data-tr-scheme={scheme}
      style={vars}
    >
      <div className="tr-card space-y-2 p-3">
        <div className="tr-label">Voorbeeld</div>
        <div className="font-bold">Bankdrukken (halterstang)</div>
        <div className="tr-muted text-sm">Vorige keer · 40 kg × 10</div>
        <div className="flex flex-wrap gap-1.5">
          <span className="tr-chip">Borst</span>
          <span className="tr-chip tr-chip-aqua">Record</span>
          <span className="tr-chip tr-chip-active">Actief</span>
        </div>
        <div className="tr-set-button min-h-[72px] py-2">
          <span className="tr-set-title text-base">SET 1 VOLTOOID</span>
          <span className="tr-set-hint">TIK OM 2:00 RUST TE STARTEN</span>
        </div>
        <span className="tr-btn tr-btn-secondary w-full">Secundaire knop</span>
      </div>
    </div>
  );
}

function PaletteForm({
  onSave,
  onCancel,
  scheme,
}: {
  onSave: (p: Palette) => void;
  onCancel: () => void;
  scheme: "light" | "dark";
}) {
  const [name, setName] = useState("");
  const [colors, setColors] = useState<string[]>([
    "#1F2A44",
    "#F7F4EF",
    "#E07A5F",
    "#3D405B",
    "#A8B0B8",
  ]);
  const [texts, setTexts] = useState<string[]>(colors);
  const valid =
    colors.every((c) => parseHex(c)) &&
    new Set(colors.map((c) => c.toUpperCase())).size === 5;
  const roles = valid ? assignRoles(colors) : null;

  const setColor = (i: number, value: string) => {
    setTexts((t) => t.map((x, j) => (j === i ? value : x)));
    const hex = parseHex(value);
    if (hex) setColors((c) => c.map((x, j) => (j === i ? hex : x)));
  };

  return (
    <div className="space-y-4">
      <label className="tr-field">
        <span>Naam</span>
        <input
          className="tr-input"
          value={name}
          maxLength={40}
          placeholder="Bijvoorbeeld Zonsondergang"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="space-y-2">
        <span className="tr-label">Vijf kleuren</span>
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={c.toLowerCase()}
              aria-label={`Kleur ${i + 1}`}
              className="h-11 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
              onChange={(e) => setColor(i, e.target.value)}
            />
            <input
              className="tr-input tr-num uppercase"
              value={texts[i]}
              maxLength={7}
              aria-label={`Hexcode kleur ${i + 1}`}
              onChange={(e) => setColor(i, e.target.value)}
            />
            {roles && (
              <span className="tr-chip w-28 shrink-0 justify-center">
                {
                  ROLE_LABELS[
                    (Object.keys(roles) as (keyof typeof roles)[]).find(
                      (k) => roles[k] === c,
                    ) ?? "neutral"
                  ]
                }
              </span>
            )}
          </div>
        ))}
        <p className="tr-muted text-xs">
          De app kiest zelf de rollen: de donkerste kleur wordt tekst, de
          lichtste achtergrond, de meest kleurrijke de hoofdactie, de volgende
          de secundaire kleur en de grijste de details. Waar nodig wordt een
          kleur iets lichter of donkerder gemaakt voor leesbaarheid.
        </p>
        {!valid && (
          <p className="tr-danger-text text-sm">
            Kies vijf verschillende geldige kleuren.
          </p>
        )}
      </div>
      {valid && <Preview colors={colors} scheme={scheme} />}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="tr-btn tr-btn-ghost"
          onClick={onCancel}
        >
          Annuleren
        </button>
        <button
          type="button"
          className="tr-btn tr-btn-primary"
          disabled={!valid}
          onClick={() =>
            onSave({
              id: newId(),
              name: name.trim() || "Mijn palet",
              colors: colors.map((c) => parseHex(c)!) as PaletteColors,
            })
          }
        >
          Opslaan en gebruiken
        </button>
      </div>
    </div>
  );
}

export function PaletteSwitcher() {
  const { settings } = useProfile();
  const scheme = settings.appearance === "dark" ? "dark" : "light";
  const activeId = settings.palettes.some((x) => x.id === settings.paletteId)
    ? settings.paletteId
    : DEFAULT_PALETTE_ID;
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const palettes: Palette[] = [DEFAULT_PALETTE, ...settings.palettes];

  const set = (patch: Partial<typeof settings>) =>
    update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  return (
    <>
      <button
        type="button"
        className="tr-icon-btn"
        aria-label="Stijl van Training"
        title="Stijl van Training"
        onClick={() => setOpen(true)}
      >
        <PaletteIcon className="h-5 w-5" />
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setAdding(false);
        }}
        title={adding ? "Nieuw kleurenpalet" : "Stijl van Training"}
      >
        {adding ? (
          <PaletteForm
            scheme={scheme}
            onCancel={() => setAdding(false)}
            onSave={async (palette) => {
              await update((p) => ({
                ...p,
                settings: {
                  ...p.settings,
                  palettes: [...p.settings.palettes, palette].slice(
                    -MAX_PALETTES,
                  ),
                  paletteId: palette.id,
                },
              }));
              setAdding(false);
            }}
          />
        ) : (
          <>
            <p className="tr-muted text-sm">
              Geldt alleen voor de trainingspagina's. De rest van Ons Huisje
              houdt zijn eigen thema.
            </p>
            <div className="space-y-1.5">
              <span className="tr-label">Weergave</span>
              <Segment
                label="Weergave"
                value={settings.appearance === "dark" ? "dark" : "light"}
                onChange={(appearance) => void set({ appearance })}
                options={[
                  { value: "light", label: "Licht" },
                  { value: "dark", label: "Donker" },
                ]}
              />
            </div>
            <ul className="space-y-2">
              {palettes.map((p) => {
                const active = p.id === activeId;
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="tr-card-flat flex flex-1 items-center gap-3 p-3 text-left"
                      aria-pressed={active}
                      style={
                        active
                          ? { outline: "2px solid var(--tr-grape)" }
                          : undefined
                      }
                      onClick={() => void set({ paletteId: p.id })}
                    >
                      <Swatches colors={p.colors} />
                      <span className="flex-1 font-medium">{p.name}</span>
                      {active && <Check className="tr-aqua-text h-5 w-5" />}
                    </button>
                    {p.id !== DEFAULT_PALETTE_ID &&
                      (confirmDelete === p.id ? (
                        <button
                          type="button"
                          className="tr-btn tr-btn-danger"
                          onClick={async () => {
                            await update((x) => ({
                              ...x,
                              settings: {
                                ...x.settings,
                                palettes: x.settings.palettes.filter(
                                  (q) => q.id !== p.id,
                                ),
                                paletteId:
                                  x.settings.paletteId === p.id
                                    ? DEFAULT_PALETTE_ID
                                    : x.settings.paletteId,
                              },
                            }));
                            setConfirmDelete(null);
                          }}
                        >
                          Verwijder
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tr-icon-btn"
                          aria-label={`${p.name} verwijderen`}
                          onClick={() => setConfirmDelete(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="tr-btn tr-btn-ghost tr-btn-block"
              disabled={settings.palettes.length >= MAX_PALETTES}
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4" /> Nieuw palet (5 kleuren)
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
