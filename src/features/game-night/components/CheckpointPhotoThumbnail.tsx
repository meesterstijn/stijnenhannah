import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";

export type ThumbnailStatus = "uploading" | "error" | "done";

// Compacte thumbnail met duidelijke uploadstatus (sectie 15) en
// touch-vriendelijke bediening (sectie 21: geen 16px-icoontje voor
// verwijderen) — reorder via grote links/rechts-knoppen i.p.v. drag-and-
// drop (sectie 20, touch-first).
export function CheckpointPhotoThumbnail({
  url,
  status,
  caption,
  onClick,
  onDelete,
  onRetry,
  onMoveLeft,
  onMoveRight,
  canMoveLeft,
  canMoveRight,
}: {
  url: string | null;
  status: ThumbnailStatus;
  caption?: string | null;
  onClick?: () => void;
  // Weglaten (bv. in de read-only viewer) verbergt de hele bedieningsrij
  // (verwijderen/herschikken) — de thumbnail blijft dan alleen aantikbaar
  // voor de lightbox.
  onDelete?: () => void;
  onRetry?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
}) {
  return (
    <div className="gnv2-thumb">
      <button
        type="button"
        onClick={status === "done" ? onClick : undefined}
        className="gnv2-thumb-img"
        disabled={status !== "done"}
      >
        {url ? (
          <img src={url} alt="" loading="lazy" />
        ) : (
          <div className="gnv2-thumb-placeholder" />
        )}

        {status === "uploading" && (
          <div className="gnv2-thumb-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}

        {status === "error" && (
          <div className="gnv2-thumb-overlay gnv2-thumb-overlay-error">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.();
              }}
              className="flex min-h-[36px] items-center gap-1 rounded-md bg-white/90 px-2 text-[11px] font-semibold text-red-700"
            >
              <RotateCcw className="h-3 w-3" /> Opnieuw proberen
            </button>
          </div>
        )}
      </button>

      {caption && (
        <p className="gnv2-dialog-faint mt-1 truncate text-center text-[10px]">
          {caption}
        </p>
      )}

      {status === "done" && onDelete && (
        <div className="mt-1 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={!canMoveLeft}
            aria-label="Naar links verplaatsen"
            className="gnv2-thumb-btn"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Foto verwijderen"
            className="gnv2-thumb-btn gnv2-thumb-btn-delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={!canMoveRight}
            aria-label="Naar rechts verplaatsen"
            className="gnv2-thumb-btn"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
