import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GameNightCheckpoint, GameNightPlayer } from "@/lib/supabase";
import { useCheckpointPhotos } from "@/features/game-night/hooks/useCheckpointPhotos";
import {
  PHOTO_TYPES,
  PHOTO_TYPE_LABELS,
  HIDDEN_INFO_TYPES,
} from "@/features/game-night/lib/checkpointPhotoTypes";
import { CheckpointPhotoThumbnail } from "@/features/game-night/components/CheckpointPhotoThumbnail";
import { CheckpointLightbox } from "@/features/game-night/components/CheckpointLightbox";

// Read-only spelstand-viewer (sectie 28) — foto's per type gegroepeerd, en
// voor cards/player extra onderverdeeld per speler zodat "wiens kaarten
// waren dit" in één oogopslag duidelijk is. `checkpoints` (aflopend
// gesorteerd, nieuwste eerst — zie useCheckpointsForSession) bepaalt de
// vorige/volgende-navigatie tussen spelstanden (sectie 30).
export function CheckpointViewer({
  checkpoint,
  checkpoints,
  attendees,
  onNavigateCheckpoint,
  onClose,
}: {
  checkpoint: GameNightCheckpoint;
  checkpoints: GameNightCheckpoint[];
  attendees: GameNightPlayer[];
  onNavigateCheckpoint: (checkpointId: string) => void;
  onClose: () => void;
}) {
  const { data: photos = [] } = useCheckpointPhotos(checkpoint.id);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const index = checkpoints.findIndex((c) => c.id === checkpoint.id);
  const hasOlder = index >= 0 && index < checkpoints.length - 1;
  const hasNewer = index > 0;

  if (lightboxId) {
    return (
      <CheckpointLightbox
        photos={photos}
        currentId={lightboxId}
        attendees={attendees}
        onNavigate={setLightboxId}
        onClose={() => setLightboxId(null)}
      />
    );
  }

  const formattedDate = new Date(checkpoint.created_at).toLocaleString(
    "nl-NL",
    { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" },
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="gnv2-dialog-eyebrow">Spelstand</p>
          <p className="gnv2-dialog-title text-lg">{checkpoint.title}</p>
          <p className="gnv2-dialog-faint text-xs">{formattedDate}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="gnv2-icon-btn"
          aria-label="Sluiten"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {checkpoint.notes && (
        <p className="gnv2-dialog-muted text-center text-sm italic">
          {checkpoint.notes}
        </p>
      )}

      <div className="gnv2-dialog-scroll min-h-0 flex-1">
        {photos.length === 0 && (
          <p className="gnv2-dialog-faint text-center text-sm">
            Geen foto&apos;s bij deze spelstand.
          </p>
        )}

        {PHOTO_TYPES.map((type) => {
          const typePhotos = photos.filter((p) => p.photo_type === type);
          if (typePhotos.length === 0) return null;

          if (HIDDEN_INFO_TYPES.has(type)) {
            const playerIds = [
              ...new Set(typePhotos.map((p) => p.player_id ?? "none")),
            ];
            return (
              <div key={type} className="mb-3 w-full max-w-sm">
                <p className="gnv2-dialog-eyebrow mb-1.5">
                  {PHOTO_TYPE_LABELS[type]}
                </p>
                {playerIds.map((playerId) => {
                  const playerPhotos = typePhotos.filter(
                    (p) => (p.player_id ?? "none") === playerId,
                  );
                  const playerName =
                    attendees.find((a) => a.id === playerId)?.name ??
                    "Geen specifieke speler";
                  return (
                    <div key={playerId} className="mb-2">
                      <p className="gnv2-dialog-muted mb-1 text-xs font-medium">
                        {playerName}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {playerPhotos.map((photo) => (
                          <CheckpointPhotoThumbnail
                            key={photo.id}
                            url={photo.url}
                            status="done"
                            caption={photo.caption}
                            onClick={() => setLightboxId(photo.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={type} className="mb-3 w-full max-w-sm">
              <p className="gnv2-dialog-eyebrow mb-1.5">
                {PHOTO_TYPE_LABELS[type]}
              </p>
              <div className="flex flex-wrap gap-2">
                {typePhotos.map((photo) => (
                  <CheckpointPhotoThumbnail
                    key={photo.id}
                    url={photo.url}
                    status="done"
                    caption={photo.caption}
                    onClick={() => setLightboxId(photo.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {checkpoints.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              hasOlder && onNavigateCheckpoint(checkpoints[index + 1].id)
            }
            disabled={!hasOlder}
            className="gnv2-btn gnv2-btn-ghost flex-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Vorige stand
          </button>
          <button
            type="button"
            onClick={() =>
              hasNewer && onNavigateCheckpoint(checkpoints[index - 1].id)
            }
            disabled={!hasNewer}
            className="gnv2-btn gnv2-btn-ghost flex-1"
          >
            Volgende stand
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
