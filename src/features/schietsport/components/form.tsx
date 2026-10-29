import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

// Formulieronderdelen in de Schietsport-stijl. Native <select> en
// <input type="date"> bewust: op een telefoon openen die de vertrouwde
// systeemkiezers. Portal-componenten (Sheet, AlertDialog) krijgen de
// themaklasse zelf, omdat ze buiten de layout renderen.

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-[var(--ss-copper)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.115_58/0.25)] disabled:opacity-50 sm:text-sm";

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="ss-eyebrow block">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input ref={ref} className={`${inputClass} ${className}`} {...props} />
));
TextInput.displayName = "TextInput";

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${inputClass} min-h-24 resize-y ${className}`}
      {...props}
    />
  );
}

export function NativeSelect({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${inputClass} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23a8a29a' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// Grote, goed aantikbare keuzeknoppen (afstand, invoermodus, ...).
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  options: { value: T; label: ReactNode; detail?: ReactNode }[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-2 text-center transition-colors ${
              size === "lg" ? "py-3" : "py-2.5"
            } ${
              active
                ? "bg-[oklch(0.7_0.115_58/0.18)] text-foreground shadow-[inset_0_0_0_1px_oklch(0.7_0.115_58/0.6)]"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            {option.detail && (
              <span className="mt-0.5 block text-[0.7rem] text-muted-foreground">
                {option.detail}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "ss-fab font-semibold",
  secondary:
    "border border-white/10 bg-white/5 text-foreground hover:bg-white/10",
  ghost: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
  danger:
    "border border-[oklch(0.65_0.18_28/0.4)] text-[oklch(0.75_0.15_28)] hover:bg-[oklch(0.65_0.18_28/0.12)]",
};

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="schietsport-theme rounded-2xl border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/10 bg-white/5 hover:bg-white/10">
            Annuleren
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Paneel voor aanmaken/bewerken: van onderen op mobiel, rechts op desktop.
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`schietsport-theme overflow-y-auto border-white/10 ${
          isMobile ? "max-h-[92dvh] rounded-t-3xl" : "w-full sm:max-w-md"
        }`}
      >
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
