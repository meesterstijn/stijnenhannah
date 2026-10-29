import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Target, type LucideIcon } from "lucide-react";
import heroTarget from "@/features/schietsport/assets/hero-target.svg";

// Presentationele bouwstenen voor alle Schietsport-schermen (designconcept 6
// "Stijlvol met Foto"). Geen data of businesslogica; de stijl zelf staat in
// schietsport.css (ss-*-klassen).

const heroStyle = {
  "--ss-hero-image": `url("${heroTarget}")`,
} as CSSProperties;

// Grote header van het dashboard. `children` komt onder de titel (bv. de
// statistiekkaarten), `actions` rechtsboven (bv. een periodekiezer).
export function SchietsportHero({
  actions,
  children,
}: {
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="ss-hero" style={heroStyle}>
      <div className="ss-hero-media" aria-hidden />
      <div className="relative space-y-6 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-[var(--ss-copper)]">
              <Target className="h-6 w-6" strokeWidth={1.6} />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Schietsport
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Focus. Analyse. Vooruitgang.
              </p>
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

// Compacte header voor de overige schermen, zelfde sfeer als de hero.
export function SchietsportPageHeader({
  icon: Icon,
  title,
  description,
  actions,
  hideOnMobile = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  // Op mobiel weglaten waar snelheid telt (invoerscherm): de bovenbalk zegt
  // al waar je bent.
  hideOnMobile?: boolean;
}) {
  return (
    <header
      className={`ss-hero ${hideOnMobile ? "hidden md:block" : ""}`}
      style={heroStyle}
    >
      <div className="ss-hero-media" aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-4 p-5 sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-[var(--ss-copper)]">
            <Icon className="h-5 w-5" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <p className="ss-eyebrow">Schietsport</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  detail,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  // Bv. "/300" — klein naast de waarde, zodat 50- en 300-schaal nooit
  // verward worden.
  suffix?: string;
  detail?: ReactNode;
  tone?: "default" | "copper" | "olive";
}) {
  const valueColor =
    tone === "copper"
      ? "text-[var(--ss-copper)]"
      : tone === "olive"
        ? "text-[var(--ss-olive)]"
        : "text-foreground";
  return (
    <div className="ss-card p-4 sm:p-5">
      <p className="ss-eyebrow">{label}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span
          className={`ss-number text-3xl font-semibold sm:text-4xl ${valueColor}`}
        >
          {value}
        </span>
        {suffix && (
          <span className="ss-number text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
      {detail && (
        <p className="mt-1.5 truncate text-xs text-muted-foreground">
          {detail}
        </p>
      )}
    </div>
  );
}

export function QuickAction({
  to,
  icon: Icon,
  title,
  detail,
  iconClassName = "text-foreground bg-white/5",
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  iconClassName?: string;
}) {
  return (
    <Link
      to={to}
      className="ss-card ss-card-interactive flex items-center gap-3 p-3.5 sm:flex-col sm:items-start sm:gap-3 sm:p-4"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
    </Link>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: { to: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ss-card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action && (
          <Link
            to={action.to}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function PanelEmpty({
  icon: Icon,
  text,
  action,
}: {
  icon: LucideIcon;
  text: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground">{text}</p>
      {action && (
        <Link
          to={action.to}
          className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-[var(--ss-copper)] hover:text-[var(--ss-copper)]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
