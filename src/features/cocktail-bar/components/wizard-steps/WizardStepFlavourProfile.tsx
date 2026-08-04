import { Slider } from "@/components/ui/slider";
import { flavourBadgeLabel, type FlavourBadgeCode } from "@/features/cocktail-bar/lib/flavourBadges";
import type { VariantDraft } from "@/features/cocktail-bar/components/CocktailWizard";

const AXES: { code: FlavourBadgeCode; key: keyof Pick<VariantDraft, "sweetScore" | "sourScore" | "bitterScore" | "freshScore" | "strongScore"> }[] = [
  { code: "sweet", key: "sweetScore" },
  { code: "sour", key: "sourScore" },
  { code: "bitter", key: "bitterScore" },
  { code: "fresh", key: "freshScore" },
  { code: "strong", key: "strongScore" },
];

// Gedeeld tussen stap 3 (alcoholische variant) en stap 7 (alcoholvrije
// variant) — dezelfde 5 sliders, andere variant-state.
export function WizardStepFlavourProfile({ variant, onChange }: { variant: VariantDraft; onChange: (v: VariantDraft) => void }) {
  return (
    <div className="space-y-5">
      <p className="cb-muted text-xs uppercase tracking-wide">Smaakprofiel (0 = afwezig, 5 = zeer aanwezig)</p>
      {AXES.map((axis) => (
        <div key={axis.code} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span>{flavourBadgeLabel(axis.code)}</span>
            <span className="cb-muted tabular-nums">{variant[axis.key]}/5</span>
          </div>
          <Slider
            value={[variant[axis.key]]}
            min={0}
            max={5}
            step={1}
            onValueChange={([value]) => onChange({ ...variant, [axis.key]: value })}
          />
        </div>
      ))}
    </div>
  );
}
