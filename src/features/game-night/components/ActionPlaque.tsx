import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

// Fysieke plaquette-knop (section 8) — geen standaard webknop, zie
// .gn-plaque-action(-primary) in styles.css voor de messing rand/inner
// shadow/pressed-state. Neemt óf `to` (navigeert, Link) óf `onClick`
// (blijft op dezelfde tabletop-scène, bv. de Start Game Night-flow) — de
// visuele plaque is in beide gevallen identiek.
export function ActionPlaque({
  to,
  onClick,
  icon: Icon,
  title,
  subtitle,
  primary = false,
}: {
  to?: string;
  onClick?: () => void;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  const className = `gn-plaque-action ${primary ? "gn-plaque-action-primary" : ""} w-full px-6 py-3.5 sm:px-7 sm:py-4`;
  const content = (
    <>
      <Icon
        className="mb-1.5 h-5 w-5"
        style={{ color: "var(--gn-brass)" }}
        strokeWidth={1.7}
      />
      <span className="gn-display text-lg font-semibold tracking-wide sm:text-xl">
        {title}
      </span>
      <span className="gn-muted mt-1 text-xs sm:text-sm">{subtitle}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
