import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";

type ModernPageHeaderBack = { to: string } | { onClick: () => void };

type ModernPageHeaderProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: ModernPageHeaderBack;
};

// Gedeelde, presentationele paginaheader voor de negen content-pagina's die
// visueel op Home aansluiten (icoon + eyebrow + titel + beschrijving,
// primaire acties rechts / eronder). Bewust NIET gebruikt door site-layout's
// eigen <header> — die wordt door meer routes gedeeld dan alleen deze negen
// pagina's, dus een wijziging daar zou buiten-scope pagina's meeraken.
export function ModernPageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  back,
}: ModernPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {back &&
          ("to" in back ? (
            <Link
              to={back.to}
              className="mt-2.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={back.onClick}
              className="mt-2.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ))}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="font-serif text-2xl font-semibold mt-1 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
