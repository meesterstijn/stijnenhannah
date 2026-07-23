import { X } from "lucide-react";
import type { GrowthLogPhoto } from "@/lib/supabase";
import type { LogEntry } from "../types";
import { formatMeasurement, formatFruitSize } from "../lib/growthStats";

type Props = {
  entries: LogEntry[];
  photos: GrowthLogPhoto[];
  onDeletePhoto?: (photo: GrowthLogPhoto) => void;
};

// Shows all growth photos chronologically based on their parent entry_date.
// Measurements (height, fruit size, notes) come from the linked LogEntry —
// they are never duplicated in the photos table.
export function GrowthPhotoTimeline({ entries, photos, onDeletePhoto }: Props) {
  // Build a map from entry_id → photos
  const photosByEntry = new Map<string, GrowthLogPhoto[]>();
  for (const p of photos) {
    const list = photosByEntry.get(p.growth_log_entry_id) ?? [];
    list.push(p);
    photosByEntry.set(p.growth_log_entry_id, list);
  }

  // Only entries with at least one photo, sorted ascending (oldest first)
  const entriesWithPhotos = [...entries]
    .filter((e) => (photosByEntry.get(e.id)?.length ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entriesWithPhotos.length === 0) {
    return (
      <p className="text-sm sv-muted">
        Nog geen groeifoto's. Voeg een foto toe via het groeilogboek hierboven.
      </p>
    );
  }

  return (
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
                  <img
                    src={photo.photo_url}
                    alt={`Groeifoto ${entry.date}`}
                    className="h-36 w-36 object-cover rounded-lg sv-icon-slot"
                    loading="lazy"
                  />
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
  );
}
