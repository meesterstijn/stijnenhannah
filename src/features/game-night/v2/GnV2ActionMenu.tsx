import { useEffect, useRef, type ReactNode, type RefObject } from "react";

// Game Night V2.7D (sectie 2/10) — compact zwevend actiemenu, geanckerd
// t.o.v. zijn eigen ouder (.gnv2-action-menu-anchor) i.p.v. een fullscreen
// backdrop-modal. Sluit op klik buiten het menu, op Escape, en negeert
// klikken op de trigger-knop zelf (anders vecht de eigen open/dicht-toggle
// van de trigger met de outside-click-listener om de state).
export function GnV2ActionMenu({
  open,
  onClose,
  triggerRef,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
  label: string;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="gnv2-action-menu"
      role="menu"
      aria-label={label}
    >
      {children}
    </div>
  );
}
