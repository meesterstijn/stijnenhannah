import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { GrowthLogPhoto } from "@/lib/supabase";
import type { LogEntry } from "../types";
import { formatMeasurement, formatFruitSize } from "../lib/growthStats";

type Props = {
  entries: LogEntry[];
  photos: GrowthLogPhoto[];
  onDeletePhoto?: (photo: GrowthLogPhoto) => void;
  /** When true, clicking a photo opens a full-screen lightbox */
  showLightbox?: boolean;
  /** Override the default "no photos yet" message */
  emptyMessage?: string;
  /** Oldest-first (asc, default) or newest-first (desc) */
  sortDir?: "asc" | "desc";
};

// Shows all growth photos chronologically based on their parent entry_date.
// Measurements (height, fruit size, notes) come from the linked LogEntry —
// they are never duplicated in the photos table.
export function GrowthPhotoTimeline({
  entries,
  photos,
  onDeletePhoto,
  showLightbox = false,
  emptyMessage,
  sortDir = "asc",
}: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Build a map from entry_id → photos
  const photosByEntry = new Map<string, GrowthLogPhoto[]>();
  for (const p of photos) {
    const list = photosByEntry.get(p.growth_log_entry_id) ?? [];
    list.push(p);
    photosByEntry.set(p.growth_log_entry_id, list);
  }

  // Only entries with at least one photo, sorted by date
  const entriesWithPhotos = [...entries]
    .filter((e) => (photosByEntry.get(e.id)?.length ?? 0) > 0)
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return sortDir === "asc" ? cmp : -cmp;
    });

  if (entriesWithPhotos.length === 0) {
    return (
      <p className="text-sm sv-muted">
        {emptyMessage ?? "Nog geen groeifoto's. Voeg een foto toe via het groeilogboek hierboven."}
      </p>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {entriesWithPhotos.map((entry) => {
          const entryPhotos = photosByEntry.get(entry.id) ?? [];
          const fruitLabel = formatFruitSize(entry.fruit_length_cm, entry.fruit_width_cm);

          return (
            <div key={entry.id} className="space-y-2">
              {/* Date + measurement chips */}
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-sm font-medium">
                  {new Date(entry.date).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.height_cm !== null && (
                    <span className="sv-badge-ok text-xs px-2 py-0.5 rounded-full">
                      📏 {formatMeasurement(entry.height_cm)} cm
                    </span>
                  )}
                  {fruitLabel && (
                    <span className="sv-badge-ok text-xs px-2 py-0.5 rounded-full">
                      🍅 {fruitLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Photos */}
              <div className="flex flex-wrap gap-2">
                {entryPhotos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    {showLightbox ? (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(photo.photo_url)}
                        className="focus:outline-none rounded-lg"
                        aria-label="Foto vergroten"
                      >
                        <img
                          src={photo.photo_url}
                          alt={`Groeifoto ${entry.date}`}
                          className="h-36 w-36 object-cover rounded-lg sv-icon-slot"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <img
                        src={photo.photo_url}
                        alt={`Groeifoto ${entry.date}`}
                        className="h-36 w-36 object-cover rounded-lg sv-icon-slot"
                        loading="lazy"
                      />
                    )}
                    {onDeletePhoto && (
                      <button
                        type="button"
                        onClick={() => onDeletePhoto(photo)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Foto verwijderen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Note from the linked entry */}
              {entry.notes && (
                <p className="text-sm sv-muted">{entry.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox — rendered as portal above all dialogs */}
      {showLightbox && lightboxUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[90vh] max-w-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              className="absolute top-4 right-4 bg-black/50 text-white rounded-full h-9 w-9 flex items-center justify-center"
              onClick={() => setLightboxUrl(null)}
              aria-label="Sluiten"
            >
              <X className="h-5 w-5" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
