import type { RefObject } from "react";
import { Camera, History, Images, Undo2, Volume2, VolumeX } from "lucide-react";
import { GnV2ActionMenu } from "@/features/game-night/v2/GnV2ActionMenu";

// Game Night V2.7D (sectie 2) — het "•••"-menu is nu een compact zwevend
// paneel rechtsboven i.p.v. een fullscreen sheet, en bevat alleen nog
// acties die ook echt bestaan: SPEELBORD-snelfoto (camera/galerij, zelfde
// checkpoint-architectuur als vanouds), checkpoints bekijken, geluid aan/
// uit, en de bestaande action-feed (WINs ongedaan maken). "Spel afsluiten"
// staat sinds V2.7D los ernaast in de toolbar (sectie 1: nooit onder ···
// verstopt) en hoort hier dus niet meer thuis.
export function ArenaMoreMenuSheet({
  open,
  triggerRef,
  soundEnabled,
  onToggleSound,
  onQuickPhoto,
  onViewCheckpoints,
  onUndoActions,
  onClose,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onQuickPhoto: (mode: "camera" | "gallery") => void;
  onViewCheckpoints: () => void;
  onUndoActions: () => void;
  onClose: () => void;
}) {
  return (
    <GnV2ActionMenu
      open={open}
      onClose={onClose}
      triggerRef={triggerRef}
      label="Acties"
    >
      <p className="gnv2-dialog-eyebrow gnv2-action-menu-eyebrow">Acties</p>

      <button
        type="button"
        onClick={() => {
          onClose();
          onQuickPhoto("camera");
        }}
        className="gnv2-action-menu-item"
        role="menuitem"
      >
        <Camera className="h-4 w-4" />
        Foto maken
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onQuickPhoto("gallery");
        }}
        className="gnv2-action-menu-item"
        role="menuitem"
      >
        <Images className="h-4 w-4" />
        Uit galerij kiezen
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onViewCheckpoints();
        }}
        className="gnv2-action-menu-item"
        role="menuitem"
      >
        <History className="h-4 w-4" />
        Checkpoints bekijken
      </button>

      <div className="gnv2-action-menu-divider" aria-hidden />

      <button
        type="button"
        onClick={onToggleSound}
        className="gnv2-action-menu-item"
        role="menuitem"
      >
        {soundEnabled ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
        Geluidseffecten {soundEnabled ? "aan" : "uit"}
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onUndoActions();
        }}
        className="gnv2-action-menu-item"
        role="menuitem"
      >
        <Undo2 className="h-4 w-4" />
        Actie ongedaan maken
      </button>
    </GnV2ActionMenu>
  );
}
