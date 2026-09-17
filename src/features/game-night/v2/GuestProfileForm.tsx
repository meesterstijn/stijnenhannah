import { lazy, Suspense, useEffect, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import type { GameNightCharacterPart } from "@/lib/supabase";
import type {
  GuestOptions,
  GuestPlayer,
  GuestProfileInput,
} from "@/features/game-night/hooks/useGameNightGuest";
import type { GuestFace } from "@/features/game-night/lib/guestIdentity";
import {
  equipmentToSlotMap,
  resolveDraftLayers,
} from "@/features/game-night/lib/gameNightCharacter";
import type { PreparedFacePhoto } from "@/features/game-night/components/FacePhotoEditor";
import { GnV2Loading } from "./GnV2Loading";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

const FacePhotoEditor = lazy(() =>
  import("../components/FacePhotoEditor").then((module) => ({
    default: module.FacePhotoEditor,
  })),
);

export function GuestAvatar({
  name,
  face,
  body,
  photoPath,
  photoRevision,
  previewUrl,
}: {
  name: string;
  face: GuestFace | null;
  body: GameNightCharacterPart | null;
  photoPath?: string | null;
  photoRevision?: string | null;
  previewUrl?: string | null;
}) {
  const draft = equipmentToSlotMap([]);
  draft.base = body?.id ?? null;
  const layers = resolveDraftLayers(
    draft,
    new Map(body ? [[body.id, body]] : []),
    body?.body_shape ?? "medium",
    previewUrl ?? photoPath,
    photoRevision,
  );
  return (
    <CharacterVisual
      player={{ name, nickname: null, guest_face: face }}
      layers={layers.map((layer) =>
        previewUrl && layer.partId === "personal-face"
          ? { ...layer, partId: "local-face-preview", key: previewUrl }
          : layer,
      )}
      loading="eager"
    />
  );
}

export function GuestProfileForm({
  options,
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
  submitLabel = "Aan tafel!",
  cancelLabel = "Terug naar de lobby",
}: {
  options: GuestOptions;
  initial?: GuestPlayer | null;
  pending: boolean;
  error?: string | null;
  onSubmit: (profile: GuestProfileInput, photo?: PreparedFacePhoto) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [photo, setPhoto] = useState<PreparedFacePhoto>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState(false);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo.faceBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const [colorId, setColorId] = useState<string | null>(
    initial?.color_id ?? options.palette?.[0]?.id ?? null,
  );
  const [bodyId, setBodyId] = useState<string | null>(
    initial?.body?.id ?? options.bodies?.[0]?.id ?? null,
  );
  const body = options.bodies?.find((part) => part.id === bodyId) ?? null;
  const color =
    options.palette?.find((entry) => entry.id === colorId)?.hex ?? "#e8aa60";

  if (editingPhoto)
    return (
      <div className="gnv2-guest-photo-editor">
        <Suspense fallback={<GnV2Loading />}>
          <FacePhotoEditor
            player={{
              name: name || "Jij",
              nickname: null,
              face_asset_path: initial?.face_asset_path ?? null,
              face_crop: null,
            }}
            bodyPreviewPart={body}
            onCancel={() => setEditingPhoto(false)}
            onSave={async (prepared) => {
              setPhoto(prepared);
              setEditingPhoto(false);
            }}
          />
        </Suspense>
      </div>
    );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || pending) return;
        onSubmit(
          {
            p_name: name.trim(),
            p_color_id: colorId,
            p_base_part_id: body?.id ?? null,
            p_guest_face: null,
          },
          photo,
        );
      }}
    >
      <fieldset disabled={pending} className="gnv2-guest-editor">
        <legend className="sr-only">Jouw naam en avatar</legend>
        <div className="gnv2-guest-preview" style={{ borderColor: color }}>
          <GuestAvatar
            name={name || "Jij"}
            face={null}
            body={body}
            photoPath={initial?.face_asset_path}
            photoRevision={initial?.face_revision}
            previewUrl={previewUrl}
          />
        </div>
        <div className="gnv2-guest-fields">
          <label htmlFor="guest-name" className="gnv2-guest-label">
            Hoe heet je?
          </label>
          <input
            id="guest-name"
            className="gnv2-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Je naam of nickname"
            autoComplete="nickname"
            maxLength={40}
            required
          />
          <div>
            <p className="gnv2-guest-label">Jouw gezicht</p>
            <button
              type="button"
              className="gnv2-btn gnv2-btn-ghost w-full"
              onClick={() => setEditingPhoto(true)}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {photo || initial?.face_asset_path
                ? "Gezichtsfoto aanpassen"
                : "Foto maken of kiezen"}
            </button>
            <p className="gnv2-guest-footnote">
              Snijd je gezicht bij en plak het op je poppetje.
            </p>
          </div>
          {!!options.palette?.length && (
            <fieldset>
              <legend className="gnv2-guest-label">Jouw kleur</legend>
              <div className="gnv2-guest-colors">
                {options.palette.map((entry) => (
                  <label
                    key={entry.id}
                    className="gnv2-guest-color-choice"
                    style={{ backgroundColor: entry.hex }}
                  >
                    <input
                      type="radio"
                      name="guest-color"
                      value={entry.id}
                      checked={colorId === entry.id}
                      onChange={() => setColorId(entry.id)}
                    />
                    {colorId === entry.id && <Check aria-hidden="true" />}
                    <span className="sr-only">{entry.label ?? entry.hex}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
        {!!options.bodies?.length && (
          <fieldset className="gnv2-guest-outfits-field">
            <legend className="gnv2-guest-label">Kies je outfit</legend>
            <div className="gnv2-guest-outfits">
              {options.bodies.map((part) => (
                <label key={part.id} className="gnv2-guest-outfit-choice">
                  <input
                    type="radio"
                    name="guest-body"
                    value={part.id}
                    checked={bodyId === part.id}
                    onChange={() => setBodyId(part.id)}
                  />
                  <img src={part.asset_path} alt="" loading="lazy" />
                  <span>{part.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="gnv2-guest-form-actions">
          {error && (
            <p role="alert" className="gnv2-guest-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="gnv2-btn gnv2-btn-primary w-full"
          >
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {pending ? "Even opslaan…" : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="gnv2-btn gnv2-btn-ghost w-full"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
