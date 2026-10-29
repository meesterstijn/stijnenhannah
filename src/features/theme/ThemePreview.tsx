import { useMemo, type CSSProperties } from "react";
import { composeTheme } from "./composer";
import type { ThemeSelection } from "./tokens";

// Miniatuur van het dashboard (begroeting, twee kaarten, brede kaart,
// navigatiebalk), getekend met exact dezelfde --ht-*-tokens en
// formules als de echte pagina (zie .ht-preview in theme.css). Een nieuwe
// preset krijgt zo automatisch een kloppende preview.
export function ThemePreview({
  selection,
  className = "",
}: {
  selection: ThemeSelection;
  className?: string;
}) {
  const style = useMemo(
    () => composeTheme(selection).vars as CSSProperties,
    [selection],
  );
  return (
    <div className={`ht-preview ${className}`} style={style} aria-hidden>
      <div className="ht-preview-veil" />
      <div className="ht-preview-body">
        <span className="ht-preview-title">Hej!</span>
        <div className="ht-preview-grid">
          <span className="ht-preview-card">
            <i className="ht-preview-icon" />
          </span>
          <span className="ht-preview-card ht-preview-card--alt">
            <i className="ht-preview-icon" />
          </span>
        </div>
        <span className="ht-preview-card ht-preview-card--wide">
          <i className="ht-preview-icon" />
          <b className="ht-preview-line" />
        </span>
      </div>
      <div className="ht-preview-nav">
        <i className="active" />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
