import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
import type {
  GameNightCheckpointPhotoType,
  GameNightPlayer,
} from "@/lib/supabase";
import {
  PHOTO_TYPE_LABELS,
  PLAYER_SELECTABLE_TYPES,
} from "@/features/game-night/lib/checkpointPhotoTypes";

// Camera vs. galerij (sectie 8/9): twee gescheiden hidden file-inputs, één
// met capture="environment" (achtercamera-hint op mobiel), één zonder —
// exact hetzelfde bewezen patroon als
// src/features/tuingids/components/GrowthPhotoInput.tsx. Geen custom
// WebRTC-camera-overlay: normale browser file-input-flow, betrouwbaarheid
// boven een fancy camera-UI.
export function PhotoCaptureFlow({
  photoType,
  attendees,
  onConfirm,
  onCancel,
}: {
  photoType: GameNightCheckpointPhotoType;
  attendees: GameNightPlayer[];
  onConfirm: (input: {
    file: File;
    caption: string;
    playerId: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function handlePicked(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file) setSelectedFile(file);
  }

  function handleRetry() {
    setSelectedFile(null);
    setCaption("");
    setPlayerId(null);
  }

  function handleUse() {
    if (!selectedFile) return;
    onConfirm({ file: selectedFile, caption, playerId });
  }

  const showPlayerPicker = PLAYER_SELECTABLE_TYPES.has(photoType);

  // ── Stap 1: kiezen hoe de foto binnenkomt ────────────────────────────────
  if (!selectedFile) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handlePicked(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handlePicked(e.target.files);
            e.currentTarget.value = "";
          }}
        />

        <p className="gn-eyebrow">{PHOTO_TYPE_LABELS[photoType]}</p>

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center gap-2 px-6 py-3.5"
        >
          <Camera className="h-5 w-5" style={{ color: "var(--gn-brass)" }} />
          <span className="gn-display text-base font-semibold tracking-wide">
            Foto maken
          </span>
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="gn-plaque-action flex min-h-[56px] w-full max-w-xs items-center justify-center gap-2 px-6 py-3"
        >
          <ImageIcon className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
          <span className="gn-display text-sm font-semibold tracking-wide">
            Uit galerij kiezen
          </span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
        >
          Annuleren
        </button>
      </div>
    );
  }

  // ── Stap 2: preview + optionele speler/caption + bevestigen ─────────────
  return (
    <div className="gn-checkpoint-scroll flex h-full min-h-0 w-full flex-col items-center gap-2.5">
      <p className="gn-eyebrow">{PHOTO_TYPE_LABELS[photoType]}</p>

      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="max-h-36 w-auto rounded-lg object-contain"
        />
      )}

      {showPlayerPicker && attendees.length > 0 && (
        <div className="w-full max-w-xs">
          <p className="gn-faint mb-1 text-[11px] font-medium">Van wie?</p>
          <div className="flex flex-wrap gap-1.5">
            {attendees.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setPlayerId((current) => (current === p.id ? null : p.id))
                }
                className={`gn-chip min-h-[36px] ${playerId === p.id ? "gn-chip-felt" : ""}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Korte beschrijving (optioneel)"
        maxLength={80}
        className="w-full max-w-xs px-3 py-2.5 text-sm"
      />

      <button
        type="button"
        onClick={handleUse}
        className="gn-plaque-action gn-plaque-action-primary flex min-h-[56px] w-full max-w-xs items-center justify-center px-6 py-3"
      >
        <span className="gn-display text-base font-semibold tracking-wide">
          Gebruiken
        </span>
      </button>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleRetry}
          className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
        >
          Opnieuw
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
