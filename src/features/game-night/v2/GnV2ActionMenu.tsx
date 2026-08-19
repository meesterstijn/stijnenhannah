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
  // `onClose` is doorgaans een inline arrow function bij de caller (nieuwe
  // referentie op elke render van GameNightV2Arena, bv. door een toast/
  // query-refetch terwijl het menu open staat). Via een ref opgeslagen i.p.v.
  // in de effect-dependency-array voorkomt dat de listeners hieronder bij
  // elke parent-render worden afgebroken en opnieuw aangesloten — puur
  // robuustheid, niet de hoofdoorzaak van de klik-bug (zie styles.css).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // pointerdown (niet click) zodat we VÓÓR een eventuele click op een
    // menu-item kunnen bepalen of dit een outside-click is — een klik
    // BINNEN het menu (of op de ···-trigger zelf) sluit hier nooit, zodat
    // de click/Enter/Space van dat item daarna gewoon nog kan vuren.
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onCloseRef.current();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, triggerRef]);

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
