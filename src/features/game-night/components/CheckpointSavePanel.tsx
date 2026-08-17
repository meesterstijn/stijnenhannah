import { useRef, useState } from "react";
import { X } from "lucide-react";
import type {
  GameNightCheckpointPhotoType,
  GameNightPlayer,
} from "@/lib/supabase";
import {
  useCreateCheckpoint,
  useUpdateCheckpoint,
  useDeleteEmptyCheckpoint,
} from "@/features/game-night/hooks/useCheckpoints";
import {
  useCheckpointPhotos,
  useAddCheckpointPhoto,
  useDeleteCheckpointPhoto,
  useSwapPhotoSortOrder,
  type CheckpointPhotoWithUrl,
} from "@/features/game-night/hooks/useCheckpointPhotos";
import { optimizeCheckpointPhoto } from "@/features/game-night/lib/optimizeCheckpointPhoto";
import {
  PHOTO_TYPES,
  PHOTO_TYPE_LABELS,
  PHOTO_TYPE_ICONS,
} from "@/features/game-night/lib/checkpointPhotoTypes";
import { PhotoCaptureFlow } from "@/features/game-night/components/PhotoCaptureFlow";
import { CheckpointPhotoThumbnail } from "@/features/game-night/components/CheckpointPhotoThumbnail";
import { CheckpointLightbox } from "@/features/game-night/components/CheckpointLightbox";

type PendingUpload = {
  localId: string;
  previewUrl: string;
  photoType: GameNightCheckpointPhotoType;
  caption: string;
  playerId: string | null;
  file: File;
  status: "uploading" | "error";
};

// Volledige "Spelstand opslaan"-flow (Checkpoint Camera & Foto UX).
//
// Architectuurkeuze (sectie 14): het checkpoint-record wordt LAZY
// aangemaakt — pas bij de eerste daadwerkelijk bevestigde foto
// (ensureCheckpoint()), niet zodra dit paneel opent. Zo ontstaan er geen
// lege checkpoints door annuleren zonder iets te doen. Als de gebruiker
// annuleert NADAT er al een checkpoint bestaat maar zonder foto's/titel/
// notitie (bv. een foto toegevoegd en weer verwijderd), wordt dat lege
// checkpoint opgeruimd; zodra er wél foto's aan hangen, blijft het gewoon
// bestaan (geldige data, geen orphan-risico) — "SPELSTAND OPSLAAN" werkt
// dan alleen nog titel/notitie bij.
export function CheckpointSavePanel({
  gameSessionId,
  roundId,
  attendees,
  onClose,
  onSaved,
}: {
  gameSessionId: string;
  roundId?: string | null;
  attendees: GameNightPlayer[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const checkpointIdRef = useRef<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<GameNightCheckpointPhotoType | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const createCheckpoint = useCreateCheckpoint();
  const updateCheckpoint = useUpdateCheckpoint();
  const deleteEmptyCheckpoint = useDeleteEmptyCheckpoint();
  const addPhoto = useAddCheckpointPhoto();
  const deletePhoto = useDeleteCheckpointPhoto();
  const swapOrder = useSwapPhotoSortOrder();
  const { data: photos = [] } = useCheckpointPhotos(checkpointId ?? undefined);

  async function ensureCheckpoint(): Promise<string> {
    if (checkpointIdRef.current) return checkpointIdRef.current;
    const checkpoint = await createCheckpoint.mutateAsync({
      gameSessionId,
      title,
      notes,
      roundId,
    });
    checkpointIdRef.current = checkpoint.id;
    setCheckpointId(checkpoint.id);
    return checkpoint.id;
  }

  async function runUpload(pending: PendingUpload) {
    try {
      const id = await ensureCheckpoint();
      const optimized = await optimizeCheckpointPhoto(pending.file);
      await addPhoto.mutateAsync({
        checkpointId: id,
        photo: optimized,
        photoType: pending.photoType,
        caption: pending.caption,
        playerId: pending.playerId,
      });
      setPendingUploads((prev) =>
        prev.filter((p) => p.localId !== pending.localId),
      );
    } catch {
      setPendingUploads((prev) =>
        prev.map((p) =>
          p.localId === pending.localId ? { ...p, status: "error" } : p,
        ),
      );
    }
  }

  function handleConfirmPhoto(input: {
    file: File;
    caption: string;
    playerId: string | null;
  }) {
    const photoType = activeCategory;
    if (!photoType) return;
    setActiveCategory(null);
    const pending: PendingUpload = {
      localId: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(input.file),
      photoType,
      caption: input.caption,
      playerId: input.playerId,
      file: input.file,
      status: "uploading",
    };
    setPendingUploads((prev) => [...prev, pending]);
    runUpload(pending);
  }

  function handleRetry(localId: string) {
    const pending = pendingUploads.find((p) => p.localId === localId);
    if (!pending) return;
    setPendingUploads((prev) =>
      prev.map((p) =>
        p.localId === localId ? { ...p, status: "uploading" } : p,
      ),
    );
    runUpload({ ...pending, status: "uploading" });
  }

  function handleRemovePending(localId: string) {
    setPendingUploads((prev) => prev.filter((p) => p.localId !== localId));
  }

  async function handleMove(
    photo: CheckpointPhotoWithUrl,
    direction: "left" | "right",
  ) {
    if (!checkpointId) return;
    const sameType = photos.filter((p) => p.photo_type === photo.photo_type);
    const idx = sameType.findIndex((p) => p.id === photo.id);
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameType.length) return;
    const other = sameType[swapIdx];
    await swapOrder.mutateAsync({
      checkpointId,
      a: { id: photo.id, sort_order: photo.sort_order },
      b: { id: other.id, sort_order: other.sort_order },
    });
  }

  const totalPhotoCount = photos.length + pendingUploads.length;
  const isUploading = pendingUploads.some((p) => p.status === "uploading");
  const canSave =
    !isUploading &&
    (totalPhotoCount > 0 || title.trim().length > 0 || notes.trim().length > 0);

  async function handleSave() {
    if (checkpointId) {
      await updateCheckpoint.mutateAsync({
        checkpointId,
        gameSessionId,
        title,
        notes,
      });
    } else {
      await createCheckpoint.mutateAsync({
        gameSessionId,
        title,
        notes,
        roundId,
      });
    }
    setSaved(true);
    onSaved?.();
    setTimeout(onClose, 1100);
  }

  async function handleClose() {
    if (
      isUploading &&
      !window.confirm(
        "Er worden nog foto's opgeslagen. Toch sluiten? Al geüploade foto's blijven bewaard.",
      )
    ) {
      return;
    }
    if (checkpointId && photos.length === 0 && !title.trim() && !notes.trim()) {
      await deleteEmptyCheckpoint.mutateAsync({ checkpointId, gameSessionId });
    }
    onClose();
  }

  // ── Camera/galerij-flow voor de aangetikte categorie ────────────────────
  if (activeCategory) {
    return (
      <PhotoCaptureFlow
        photoType={activeCategory}
        attendees={attendees}
        onConfirm={handleConfirmPhoto}
        onCancel={() => setActiveCategory(null)}
      />
    );
  }

  // ── Fullscreen foto-viewer ───────────────────────────────────────────────
  if (lightboxPhotoId) {
    return (
      <CheckpointLightbox
        photos={photos}
        currentId={lightboxPhotoId}
        attendees={attendees}
        onNavigate={setLightboxPhotoId}
        onClose={() => setLightboxPhotoId(null)}
      />
    );
  }

  if (saved) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-1.5 text-center">
        <p
          className="gn-display text-xl font-semibold"
          style={{ color: "var(--gn-brass)" }}
        >
          Spelstand opgeslagen
        </p>
        <p className="gn-muted text-sm">
          {totalPhotoCount} {totalPhotoCount === 1 ? "foto" : "foto's"} ·{" "}
          {new Date().toLocaleTimeString("nl-NL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    );
  }

  const timePlaceholder = `Stand ${new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="gn-display text-lg font-semibold tracking-wide">
          Spelstand opslaan
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="gn-topnav-icon-btn"
          aria-label="Sluiten"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="gn-checkpoint-scroll flex min-h-0 flex-1 flex-col items-center gap-3">
        <div className="flex w-full max-w-sm flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={timePlaceholder}
            maxLength={60}
            className="w-full px-3 py-2.5 text-sm"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notitie (optioneel) — bv. 'We stoppen voor vandaag.'"
            rows={2}
            className="w-full resize-none px-3 py-2.5 text-sm"
          />
        </div>

        <div className="grid w-full max-w-sm grid-cols-3 gap-2">
          {PHOTO_TYPES.map((type) => {
            const Icon = PHOTO_TYPE_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveCategory(type)}
                className="gn-checkpoint-category-btn"
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: "var(--gn-brass)" }}
                  strokeWidth={1.7}
                />
                <span>{PHOTO_TYPE_LABELS[type]}</span>
              </button>
            );
          })}
        </div>

        {PHOTO_TYPES.map((type) => {
          const typePhotos = photos.filter((p) => p.photo_type === type);
          const typePending = pendingUploads.filter(
            (p) => p.photoType === type,
          );
          if (typePhotos.length === 0 && typePending.length === 0) {
            return null;
          }
          return (
            <div key={type} className="w-full max-w-sm">
              <p className="gn-eyebrow mb-1.5">
                {PHOTO_TYPE_LABELS[type]} ·{" "}
                {typePhotos.length + typePending.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {typePhotos.map((photo, i) => (
                  <CheckpointPhotoThumbnail
                    key={photo.id}
                    url={photo.url}
                    status="done"
                    caption={photo.caption}
                    onClick={() => setLightboxPhotoId(photo.id)}
                    onDelete={() => deletePhoto.mutate(photo)}
                    onMoveLeft={() => handleMove(photo, "left")}
                    onMoveRight={() => handleMove(photo, "right")}
                    canMoveLeft={i > 0}
                    canMoveRight={i < typePhotos.length - 1}
                  />
                ))}
                {typePending.map((p) => (
                  <CheckpointPhotoThumbnail
                    key={p.localId}
                    url={p.previewUrl}
                    status={p.status}
                    onDelete={() => handleRemovePending(p.localId)}
                    onRetry={() => handleRetry(p.localId)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full items-center justify-center px-6 py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="gn-display text-lg font-semibold tracking-wide">
          {isUploading ? "Foto's worden opgeslagen..." : "Spelstand opslaan"}
        </span>
      </button>
    </div>
  );
}
