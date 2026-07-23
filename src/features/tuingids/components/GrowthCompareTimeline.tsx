import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { GrowthLogPhoto } from "@/lib/supabase";
import type { LogEntry } from "../types";
import { formatMeasurement, formatFruitSize } from "../lib/growthStats";

type Props = {
  entries: LogEntry[];
  photos: GrowthLogPhoto[];
};

export function GrowthCompareTimeline({ entries, photos }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Map entry_id → photos[], built once
  const photosByEntry = useMemo(() => {
    const map = new Map<string, GrowthLogPhoto[]>();
    for (const p of photos) {
      const list = map.get(p.growth_log_entry_id) ?? [];
      list.push(p);
      map.set(p.growth_log_entry_id, list);
    }
    return map;
  }, [photos]);

  // Chronological order — oldest first for the comparison view
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );

  // Pre-compute height delta from the previous entry that has height_cm
  const heightDeltas = useMemo(() => {
    const map = new Map<string, number | null>();
    let prevH: number | null = null;
    for (const e of sorted) {
      if (e.height_cm !== null) {
        map.set(e.id, prevH !== null ? e.height_cm - prevH : null);
        prevH = e.height_cm;
      } else {
        map.set(e.id, null);
      }
    }
    return map;
  }, [sorted]);

  // Summary stats
  const summary = useMemo(() => {
    const withH = sorted.filter((e) => e.height_cm !== null);
    const withFL = sorted.filter((e) => e.fruit_length_cm !== null);
    return {
      firstHeight: withH.length > 0 ? (withH[0].height_cm as number) : null,
      lastHeight: withH.length > 1 ? (withH[withH.length - 1].height_cm as number) : null,
      firstFruitL: withFL.length > 0 ? (withFL[0].fruit_length_cm as number) : null,
      lastFruitL: withFL.length > 1 ? (withFL[withFL.length - 1].fruit_length_cm as number) : null,
      totalEntries: sorted.length,
      totalPhotos: photos.length,
    };
  }, [sorted, photos]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm sv-muted">
        Nog geen groeiregistraties. Voeg een meting toe via het groeilogboek hierboven.
      </p>
    );
  }

  const heightDelta =
    summary.firstHeight !== null && summary.lastHeight !== null
      ? summary.lastHeight - summary.firstHeight
      : null;
  const fruitDelta =
    summary.firstFruitL !== null && summary.lastFruitL !== null
      ? summary.lastFruitL - summary.firstFruitL
      : null;

  return (
    <div className="space-y-5">
      {/* ── Summary ── */}
      <div className="grid grid-cols-2 gap-2">
        {summary.firstHeight !== null && (
          <div className="sv-panel p-3 space-y-0.5">
            <p className="text-[10px] sv-muted uppercase tracking-wide font-medium">Totale groei</p>
            <p className="text-sm font-semibold">
              {formatMeasurement(summary.firstHeight)}
              {summary.lastHeight !== null && ` → ${formatMeasurement(summary.lastHeight)}`} cm
            </p>
            {heightDelta !== null && (
              <p className="text-xs sv-muted">
                {heightDelta >= 0 ? "+" : ""}{formatMeasurement(heightDelta)} cm
              </p>
            )}
          </div>
        )}
        {summary.firstFruitL !== null && (
          <div className="sv-panel p-3 space-y-0.5">
            <p className="text-[10px] sv-muted uppercase tracking-wide font-medium">Vrucht</p>
            <p className="text-sm font-semibold">
              {formatMeasurement(summary.firstFruitL)}
              {summary.lastFruitL !== null && ` → ${formatMeasurement(summary.lastFruitL)}`} cm
            </p>
            {fruitDelta !== null && (
              <p className="text-xs sv-muted">
                {fruitDelta >= 0 ? "+" : ""}{formatMeasurement(fruitDelta)} cm
              </p>
            )}
          </div>
        )}
        <div className="sv-panel p-3 space-y-0.5">
          <p className="text-[10px] sv-muted uppercase tracking-wide font-medium">Registraties</p>
          <p className="text-sm font-semibold">{summary.totalEntries}</p>
        </div>
        <div className="sv-panel p-3 space-y-0.5">
          <p className="text-[10px] sv-muted uppercase tracking-wide font-medium">Foto's</p>
          <p className="text-sm font-semibold">{summary.totalPhotos}</p>
        </div>
      </div>

      {/* ── Entry cards ── */}
      <div className="space-y-1">
        {sorted.map((entry, i) => {
          const entryPhotos = photosByEntry.get(entry.id) ?? [];
          const delta = heightDeltas.get(entry.id) ?? null;
          const fruitLabel = formatFruitSize(entry.fruit_length_cm, entry.fruit_width_cm);
          const isLast = i === sorted.length - 1;

          return (
            <div key={entry.id}>
              <div className="sv-panel p-4 space-y-3">
                {/* Date + height delta */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {new Date(entry.date).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {delta !== null && (
                    <span className="shrink-0 sv-badge-ok text-xs px-2 py-0.5 rounded-full">
                      {delta >= 0 ? "+" : ""}{formatMeasurement(delta)} cm
                    </span>
                  )}
                </div>

                {/* Measurement badges */}
                {(entry.height_cm !== null || fruitLabel) && (
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
                )}

                {/* Photo gallery */}
                {entryPhotos.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-2">
                      {entryPhotos.slice(0, 3).map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setLightboxUrl(photo.photo_url)}
                          className="focus:outline-none rounded-lg"
                          aria-label="Foto vergroten"
                        >
                          <img
                            src={photo.photo_url}
                            alt=""
                            className="h-20 w-20 object-cover rounded-lg sv-icon-slot"
                            loading="lazy"
                          />
                        </button>
                      ))}
                      {entryPhotos.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(entryPhotos[3].photo_url)}
                          className="h-20 w-20 rounded-lg sv-inset flex items-center justify-center text-xs sv-muted focus:outline-none"
                        >
                          +{entryPhotos.length - 3}
                        </button>
                      )}
                    </div>
                    {entryPhotos.length > 1 && (
                      <p className="text-[10px] sv-muted">
                        📷 {entryPhotos.length} foto's
                      </p>
                    )}
                  </div>
                )}

                {/* Notes */}
                {entry.notes && (
                  <p className="text-sm sv-muted">{entry.notes}</p>
                )}
              </div>

              {/* Arrow separator between cards */}
              {!isLast && (
                <div className="flex justify-center py-0.5 sv-muted text-base select-none" aria-hidden>
                  ↓
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Lightbox (rendered as portal above all dialogs) ── */}
      {lightboxUrl &&
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
    </div>
  );
}
