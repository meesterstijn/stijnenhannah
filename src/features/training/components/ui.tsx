import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

// Kleine, eigen bouwstenen. Bewust geen portals: alles rendert binnen
// .training-theme, zodat de tokens (licht/donker) overal gelden.

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="tr-sheet-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="tr-sheet outline-none"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="tr-h2 text-lg">
            {title}
          </h2>
          <button
            type="button"
            className="tr-icon-btn -mr-2"
            onClick={onClose}
            aria-label="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && (
          <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {description && (
          <span className="tr-muted block text-sm">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className="tr-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="sr-only">{label}</span>
      </button>
    </label>
  );
}

export function Segment<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="tr-segment" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="tr-h1">{title}</h1>
        {subtitle && <p className="tr-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="tr-card flex flex-col items-center gap-2 px-5 py-10 text-center">
      <p className="tr-h2">{title}</p>
      {children && <div className="tr-muted max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="tr-card-flat px-3 py-3">
      <div className="tr-label">{label}</div>
      <div className="tr-num mt-1 text-xl font-bold">{value}</div>
      {hint && <div className="tr-muted mt-0.5 text-xs">{hint}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="tr-muted py-16 text-center text-sm">Laden…</div>;
}

// Invoer met komma of punt; leeg = null.
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = "any",
  min = 0,
  integer = false,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  step?: string;
  min?: number;
  integer?: boolean;
  placeholder?: string;
}) {
  const format = (v: number | null) =>
    v === null || Number.isNaN(v) ? "" : String(v).replace(".", ",");
  // Eigen tekst, zodat "42," tijdens het typen niet meteen "42" wordt.
  const [text, setText] = useState(() => format(value));
  useEffect(() => {
    setText((current) => {
      const parsed =
        current.trim() === "" ? null : Number(current.replace(",", "."));
      return parsed === value ? current : format(value);
    });
  }, [value]);
  return (
    <label className="tr-field">
      <span>{label}</span>
      <div className="relative">
        <input
          className="tr-input tr-num pr-12"
          inputMode={integer ? "numeric" : "decimal"}
          type="text"
          step={step}
          min={min}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            const raw = e.target.value.trim().replace(",", ".");
            if (!(integer ? /^\d*$/ : /^\d*\.?\d{0,2}$/).test(raw)) return;
            setText(e.target.value.trim());
            if (raw === "" || raw === ".") return onChange(null);
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
        {suffix && (
          <span className="tr-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}
