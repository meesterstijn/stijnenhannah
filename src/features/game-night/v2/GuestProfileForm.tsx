import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { GameNightCharacterPart } from "@/lib/supabase";
import type {
  GuestOptions,
  GuestPlayer,
  GuestProfileInput,
} from "@/features/game-night/hooks/useGameNightGuest";
import {
  GUEST_FACES,
  type GuestFace,
} from "@/features/game-night/lib/guestIdentity";
import {
  equipmentToSlotMap,
  resolveDraftLayers,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

export function GuestAvatar({
  name,
  face,
  body,
}: {
  name: string;
  face: GuestFace | null;
  body: GameNightCharacterPart | null;
}) {
  const draft = equipmentToSlotMap([]);
  draft.base = body?.id ?? null;
  const layers = resolveDraftLayers(
    draft,
    new Map(body ? [[body.id, body]] : []),
    body?.body_shape ?? "medium",
  );
  return (
    <CharacterVisual
      player={{ name, nickname: null, guest_face: face }}
      layers={face ? layers : []}
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
  onSubmit: (profile: GuestProfileInput) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [face, setFace] = useState<GuestFace>(initial?.guest_face ?? "smile");
  const [colorId, setColorId] = useState<string | null>(
    initial?.color_id ?? options.palette?.[0]?.id ?? null,
  );
  const [bodyId, setBodyId] = useState<string | null>(
    initial?.body?.id ?? options.bodies?.[0]?.id ?? null,
  );
  const body = options.bodies?.find((part) => part.id === bodyId) ?? null;
  const color =
    options.palette?.find((entry) => entry.id === colorId)?.hex ?? "#e8aa60";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || pending) return;
        onSubmit({
          p_name: name.trim(),
          p_color_id: colorId,
          p_base_part_id: body?.id ?? null,
          p_guest_face: face,
        });
      }}
    >
      <fieldset disabled={pending} className="gnv2-guest-editor">
        <legend className="sr-only">Jouw naam en avatar</legend>
        <div className="gnv2-guest-preview" style={{ borderColor: color }}>
          <GuestAvatar name={name || "Jij"} face={face} body={body} />
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
          <fieldset>
            <legend className="gnv2-guest-label">Kies je gezicht</legend>
            <div className="gnv2-guest-faces">
              {Object.entries(GUEST_FACES).map(([id, item]) => (
                <label key={id} className="gnv2-guest-face-choice">
                  <input
                    type="radio"
                    name="guest-face"
                    value={id}
                    checked={face === id}
                    onChange={() => setFace(id as GuestFace)}
                  />
                  <span aria-hidden="true">{item.emoji}</span>
                  <span className="sr-only">{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
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
