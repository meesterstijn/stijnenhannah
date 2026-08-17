import { useState } from "react";
import { ChevronLeft, ChevronRight, EyeOff, X } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import type { CheckpointPhotoWithUrl } from "@/features/game-night/hooks/useCheckpointPhotos";
import {
  PHOTO_TYPE_LABELS,
  HIDDEN_INFO_TYPES,
} from "@/features/game-night/lib/checkpointPhotoTypes";

// Fullscreen foto-weergave (sectie 29) — groot genoeg om kaartdetails te
// reconstrueren, vorige/volgende binnen het checkpoint (sectie 30), en de
// "verborgen kaarten"-afscherming (sectie 34/57): cards/player-foto's
// starten dichtgeklapt, ook bij het doorbladeren naar een volgende foto
// (revealed reset bij elke navigatie). Pinch/zoom is bewust NIET zelf
// gebouwd — een gewone <img> op volledig formaat laat de browser zijn
// eigen, native pinch-zoom doen (sectie 29: "eenvoudig/native mogelijk").
export function CheckpointLightbox({
  photos,
  currentId,
  attendees,
  onNavigate,
  onClose,
}: {
  photos: CheckpointPhotoWithUrl[];
  currentId: string;
  attendees: GameNightPlayer[];
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const index = photos.findIndex((p) => p.id === currentId);
  const photo = photos[index];

  if (!photo) return null;

  const isHiddenType = HIDDEN_INFO_TYPES.has(photo.photo_type);
  const shouldHide = isHiddenType && !revealed;
  const player = attendees.find((a) => a.id === photo.player_id);

  function goTo(newIndex: number) {
    if (newIndex < 0 || newIndex >= photos.length) return;
    setRevealed(false);
    onNavigate(photos[newIndex].id);
  }

  return (
    <div
      className="gn-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="gn-lightbox-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="gn-eyebrow">
            {PHOTO_TYPE_LABELS[photo.photo_type]}
            {player ? ` · ${player.name}` : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="gn-topnav-icon-btn"
            aria-label="Sluiten"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="gn-lightbox-image-wrap">
          {shouldHide ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="gn-lightbox-hidden-warning"
            >
              <EyeOff className="h-6 w-6" />
              <span>Verborgen kaarten — tik om te bekijken</span>
            </button>
          ) : photo.url ? (
            <img src={photo.url} alt="" className="gn-lightbox-image" />
          ) : (
            <p className="gn-faint text-sm">Foto kan niet worden geladen.</p>
          )}
        </div>

        {photo.caption && !shouldHide && (
          <p className="gn-muted text-center text-sm">{photo.caption}</p>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index <= 0}
            className="gn-nowplaying-btn"
            aria-label="Vorige foto"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="gn-faint text-xs">
            {index + 1} / {photos.length}
          </p>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index >= photos.length - 1}
            className="gn-nowplaying-btn"
            aria-label="Volgende foto"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
