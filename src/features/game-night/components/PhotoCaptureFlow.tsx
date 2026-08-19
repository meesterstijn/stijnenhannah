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
  autoTrigger,
  onConfirm,
  onCancel,
}: {
  photoType: GameNightCheckpointPhotoType;
  attendees: GameNightPlayer[];
  // Sectie 2 (V2.7D): laat "Foto maken"/"Uit galerij kiezen" in het
  // ···-menu direct de bijbehorende native picker openen i.p.v. eerst
  // deze twee-knoppen-stap te tonen — klikt éénmalig op de al-bestaande
  // hidden file-input, geen nieuwe camera-/uploadlogica.
  autoTrigger?: "camera" | "gallery";
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
    if (autoTrigger === "camera") cameraInputRef.current?.click();
    if (autoTrigger === "gallery") galleryInputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        <p className="gnv2-dialog-eyebrow">{PHOTO_TYPE_LABELS[photoType]}</p>

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="gnv2-capture-btn gnv2-capture-btn-camera"
        >
          <span className="gnv2-capture-icon">
            <Camera className="h-5 w-5" />
          </span>
          <span className="gnv2-capture-label">Foto maken</span>
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="gnv2-capture-btn gnv2-capture-btn-gallery"
        >
          <span className="gnv2-capture-icon">
            <ImageIcon className="h-5 w-5" />
          </span>
          <span className="gnv2-capture-label">Uit galerij kiezen</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="gnv2-dialog-cancel-link"
        >
          Annuleren
        </button>
      </div>
    );
  }

  // ── Stap 2: preview + optionele speler/caption + bevestigen ─────────────
  return (
    <div className="gnv2-dialog-scroll flex h-full min-h-0 w-full flex-col items-center gap-2.5">
      <p className="gnv2-dialog-eyebrow">{PHOTO_TYPE_LABELS[photoType]}</p>

      {previewUrl && (
        <img src={previewUrl} alt="" className="gnv2-capture-preview" />
      )}

      {showPlayerPicker && attendees.length > 0 && (
        <div className="w-full max-w-xs">
          <p className="gnv2-dialog-faint mb-1 text-[11px] font-medium">
            Van wie?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {attendees.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setPlayerId((current) => (current === p.id ? null : p.id))
                }
                className={`gnv2-chip-toggle min-h-[36px] ${playerId === p.id ? "gnv2-chip-toggle-selected" : ""}`}
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
        className="gnv2-input max-w-xs"
      />

      <button
        type="button"
        onClick={handleUse}
        className="gnv2-btn gnv2-btn-primary w-full max-w-xs"
      >
        Gebruiken
      </button>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleRetry}
          className="gnv2-dialog-cancel-link"
        >
          Opnieuw
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="gnv2-dialog-cancel-link"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
