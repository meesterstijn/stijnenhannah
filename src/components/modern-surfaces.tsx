import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Gedeelde, presentationele bouwstenen voor de negen contentpagina's die
// visueel bij Home willen aansluiten (rustige, gelaagde cards + secties +
// lege staten) zonder Home's eigen glazen/foto-behandeling over te nemen —
// die leest niet op een lichte, tekstrijke pagina (zie styles.css §body).
// Puur presentatie, geen businesslogica. Niet gebruikt door site-layout.tsx
// of enige andere pagina buiten deze negen — dus geen risico voor die
// pagina's ongeacht wat hier verandert.

// Losse schaduw/radius-basis, herbruikbaar op oppervlakken die zelf al een
// andere achtergrond hebben (bv. Weer's gradient "huidige conditie"-kaart)
// en dus niet de bg-card van cardSurface() kunnen gebruiken.
export const MODERN_CARD_SHADOW_CLASS =
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-12px_rgba(15,23,42,0.12)]";

export function cardSurface(
  opts: {
    interactive?: boolean;
    padding?: "sm" | "md" | "lg" | "none";
    dashed?: boolean;
  } = {},
): string {
  const { interactive = false, padding = "md", dashed = false } = opts;
  const paddingClass =
    padding === "none"
      ? ""
      : padding === "sm"
        ? "p-4"
        : padding === "lg"
          ? "p-6 sm:p-7"
          : "p-5";
  const base = `rounded-2xl border ${dashed ? "border-dashed" : ""} border-border/60 bg-card ${MODERN_CARD_SHADOW_CLASS}`;
  const interactiveClass = interactive
    ? "transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_16px_36px_-14px_rgba(15,23,42,0.18)]"
    : "";
  return [base, paddingClass, interactiveClass].filter(Boolean).join(" ");
}

// Voor rijen/subtiele items die geen volle kaart nodig hebben (bv. binnen
// een divide-y lijst) maar wel de rustige, iets vollere "papieren" surface
// van de contentpagina's t.o.v. de standaard bg-card moeten voelen.
export const MODERN_FIELD_CLASS =
  "w-full rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50";

export function ModernSection({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 ${className}`}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {title}
            </p>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function ModernEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div
      className={`${cardSurface({ padding: "lg", dashed: true })} text-center`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <p className="font-serif text-lg font-semibold mt-4">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}
