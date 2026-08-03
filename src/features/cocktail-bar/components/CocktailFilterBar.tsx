import type { CocktailBaseCategory, CocktailFiltersState } from "@/features/cocktail-bar/hooks/useCocktailFilters";
import { flavourBadgeLabel, type FlavourBadgeCode } from "@/features/cocktail-bar/lib/flavourBadges";

// Vaste, bewust geordende categorieën i.p.v. dynamisch afgeleid uit de data
// — precies de indeling die is gevraagd: basisdrank (incl. Alcoholvrij als
// gelijkwaardige categorie) eerst, dan een visuele scheiding, dan smaak.
// Geen sterktefilter en geen los "alleen alcoholvrij"-vinkje meer.
const BASE_CATEGORY_OPTIONS: { value: CocktailBaseCategory; label: string }[] = [
  { value: "vodka", label: "Vodka" },
  { value: "rum", label: "Rum" },
  { value: "whisky", label: "Whisky" },
  { value: "alcohol_free", label: "Alcoholvrij" },
];
const FLAVOUR_OPTIONS: FlavourBadgeCode[] = ["sweet", "sour", "bitter", "fresh", "strong"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cb-badge shrink-0 whitespace-nowrap transition-colors ${
        active ? "bg-[var(--cb-amber)] text-[oklch(0.16_0.02_60)]" : "hover:bg-[oklch(0.75_0.15_60_/_0.2)]"
      }`}
    >
      {children}
    </button>
  );
}

export function CocktailFilterBar({
  filters,
  onChange,
}: {
  filters: CocktailFiltersState;
  onChange: (filters: CocktailFiltersState) => void;
}) {
  function patch(partial: Partial<CocktailFiltersState>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {BASE_CATEGORY_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            active={filters.baseCategory === opt.value}
            onClick={() => patch({ baseCategory: filters.baseCategory === opt.value ? null : opt.value })}
          >
            {opt.label}
          </Chip>
        ))}
      </div>

      <span className="mx-1 h-5 w-px shrink-0 bg-[var(--cb-border)]" aria-hidden="true" />

      <div className="flex flex-wrap gap-1.5">
        {FLAVOUR_OPTIONS.map((code) => (
          <Chip key={code} active={filters.flavour === code} onClick={() => patch({ flavour: filters.flavour === code ? null : code })}>
            {flavourBadgeLabel(code)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
