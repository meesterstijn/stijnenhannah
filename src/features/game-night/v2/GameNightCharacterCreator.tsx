import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { GameNightCharacterSlot } from "@/lib/supabase";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";
import {
  useCharacterEquipmentForPlayers,
  useCharacterParts,
  useEquipCharacterPart,
  useMyCharacterUnlocks,
  useUnequipCharacterPart,
} from "@/features/game-night/hooks/useCharacterCatalog";
import { resolvePlayerColorHex } from "@/features/game-night/lib/playerIdentity";
import {
  CHARACTER_SLOTS,
  CHARACTER_SLOT_LABELS,
  LOCKED_SLOT,
  buildInitialDraft,
  canEquipPart,
  derivePartTileStatus,
  diffCharacterSlots,
  equipmentToSlotMap,
  groupPartsBySlot,
  hasUnsavedCharacterChanges,
  resolveDraftLayers,
  type CharacterSlotMap,
} from "@/features/game-night/lib/gameNightCharacter";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";
import { CharacterPartTile } from "@/features/game-night/v2/CharacterPartTile";

type SaveState = "idle" | "saving" | "success" | "partial-error";

// Game Night V2.9C (sectie 2/3/4/5/9/17) — de volledige mobiele Character
// Creator, een eigen route (/game-night/me/character) i.p.v. een subview
// in GameNightMe.tsx: dit is qua interactie/lay-out een echt eigen scherm
// (groot live character + horizontale categorie-tabs + grid), geen klein
// stukje van een bestaande pagina. Zelfde GNV2-wereld (GnV2Scene), iets
// speelser (spelerkleur als accent) maar géén nieuwe visuele taal.
//
// GEEN tweede character-renderer (sectie 4/18): de live preview gebruikt
// exact CharacterVisual, met dezelfde resolveDraftLayers-lagen als straks
// Lobby/Arena via resolvePlayerCharacter tonen.
export default function GameNightCharacterCreator() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: analyticsData, isLoading: analyticsLoading } =
    useGameNightAnalytics();
  const { data: palette = [] } = useGameNightColorPalette();
  const { data: parts = [], isLoading: partsLoading } = useCharacterParts();
  const { data: unlocks = [] } = useMyCharacterUnlocks();

  const myPlayer = analyticsData?.players.find(
    (p) => p.auth_user_id === session?.user.id,
  );

  const equipmentQuery = useCharacterEquipmentForPlayers(
    myPlayer ? [myPlayer.id] : [],
  );
  const equipmentData = equipmentQuery.data;
  const equipment = useMemo(() => equipmentData ?? [], [equipmentData]);

  const equipMutation = useEquipCharacterPart();
  const unequipMutation = useUnequipCharacterPart();

  const [activeSlot, setActiveSlot] = useState<GameNightCharacterSlot>("base");
  const [draft, setDraft] = useState<CharacterSlotMap | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [failedSlots, setFailedSlots] = useState<GameNightCharacterSlot[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Puur UI: heeft de speler al zelf iets aangetikt in DEZE sessie? Los van
  // `dirty` (dat vergelijkt tegen de echte server-staat en is dus al true
  // zodra de stille starter-base-default in de draft zit, sectie 9) — de
  // grote preview moet desondanks het VERTROUWDE legacy character blijven
  // tonen totdat de speler zelf iets kiest (sectie 13), ook al is er dan
  // strikt genomen al een opslaanbare wijziging.
  const [hasInteracted, setHasInteracted] = useState(false);
  const initializedRef = useRef(false);

  // Ongeïnjecteerde, echte server-staat — de bron van waarheid voor de
  // diff bij Opslaan (nooit de starter-base-default hier meetellen als
  // "toch al saved", anders zou die default nooit daadwerkelijk equipped
  // raken).
  const savedMap = useMemo(() => equipmentToSlotMap(equipment), [equipment]);

  // Sectie 5/9: pas initialiseren zodra we de ECHTE opgeslagen equipment
  // kennen (isLoading===false) — anders zou een speler met wél al
  // opgeslagen onderdelen eventjes de starter-default in beeld krijgen
  // vóórdat de echte data binnen is.
  useEffect(() => {
    if (initializedRef.current) return;
    if (!myPlayer || parts.length === 0) return;
    if (equipmentQuery.isLoading) return;
    initializedRef.current = true;
    setDraft(buildInitialDraft(equipment, parts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlayer, parts, equipmentQuery.isLoading]);

  const partsById = useMemo(
    () => new Map(parts.map((p) => [p.id, p])),
    [parts],
  );
  const partsBySlot = useMemo(() => groupPartsBySlot(parts), [parts]);

  const colorHex = myPlayer ? resolvePlayerColorHex(myPlayer, palette) : null;
  const dirty = draft ? hasUnsavedCharacterChanges(savedMap, draft) : false;

  const previewLayers = draft ? resolveDraftLayers(draft, partsById) : [];
  // Sectie 13: alleen tonen als de speler ECHT nog geen modulaire equipment
  // heeft opgeslagen (anders zou een speler die eerder al heeft opgeslagen
  // bij een volgend bezoek weer even zijn oude legacy character zien i.p.v.
  // zijn echte huidige samengestelde character) én nog niets heeft
  // aangetikt in deze sessie (de stille starter-base-default in `draft`,
  // sectie 9, telt hier bewust niet mee als "al gewijzigd").
  const savedHasAnyEquipment = CHARACTER_SLOTS.some(
    (slot) => savedMap[slot] !== null,
  );
  const showLegacyPreview =
    !savedHasAnyEquipment && !hasInteracted && !!myPlayer?.character_id;

  function handleBack() {
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    navigate("/game-night/me");
  }

  function selectPart(slot: GameNightCharacterSlot, partId: string) {
    if (!draft) return;
    const part = partsById.get(partId);
    if (!canEquipPart(part, slot, unlocks)) return;
    setDraft({ ...draft, [slot]: partId });
    setHasInteracted(true);
    if (saveState !== "idle") setSaveState("idle");
  }

  function deselectPart(slot: GameNightCharacterSlot) {
    if (!draft || slot === LOCKED_SLOT) return;
    setDraft({ ...draft, [slot]: null });
    setHasInteracted(true);
    if (saveState !== "idle") setSaveState("idle");
  }

  // Sectie 8/24: server-side gecontroleerd, één RPC-call per gewijzigde
  // slot (geen nieuwe atomische SQL — zie het opleverrapport voor de
  // afweging). Na afloop ALTIJD herladen vanaf de server en de draft
  // daarop resynchroniseren, ongeacht gedeeltelijke mislukking — nooit een
  // UI die "alles opgeslagen" claimt terwijl dat niet zo is, en nooit een
  // draft die blijft hangen op een staat die de server niet heeft.
  async function handleSave() {
    if (!draft || !myPlayer) return;
    const changes = diffCharacterSlots(savedMap, draft);
    if (changes.length === 0) return;

    setSaveState("saving");
    setFailedSlots([]);

    const results = await Promise.allSettled(
      changes.map((change) =>
        change.action === "equip"
          ? equipMutation.mutateAsync({
              slot: change.slot,
              partId: change.partId,
            })
          : unequipMutation.mutateAsync(change.slot),
      ),
    );

    const failed = changes
      .filter((_, i) => results[i].status === "rejected")
      .map((c) => c.slot);

    const refetched = await equipmentQuery.refetch();
    setDraft(buildInitialDraft(refetched.data ?? [], parts));

    if (failed.length > 0) {
      setFailedSlots(failed);
      setSaveState("partial-error");
    } else {
      setSaveState("success");
      setTimeout(
        () => setSaveState((cur) => (cur === "success" ? "idle" : cur)),
        2500,
      );
    }
  }

  const loading =
    analyticsLoading || partsLoading || equipmentQuery.isLoading || !draft;

  if (loading) {
    return (
      <GnV2Scene className="gnv2-creator-scene">
        <div className="gnv2-loading">
          <div className="gnv2-loading-pulse" aria-hidden />
        </div>
      </GnV2Scene>
    );
  }

  if (!myPlayer) {
    return (
      <GnV2Scene className="gnv2-creator-scene">
        <div className="gnv2-creator-empty">
          <p>Dit account is nog niet gekoppeld aan een spelersprofiel.</p>
          <button
            type="button"
            onClick={() => navigate("/game-night/me")}
            className="gnv2-btn gnv2-btn-ghost"
          >
            Terug
          </button>
        </div>
      </GnV2Scene>
    );
  }

  const activeParts = partsBySlot.get(activeSlot) ?? [];

  return (
    <GnV2Scene
      className="gnv2-creator-scene"
      style={{
        ["--gnv2-ring" as string]: colorHex ?? "var(--gnv2-accent-warm)",
      }}
    >
      <header className="gnv2-topbar gnv2-topbar-compact">
        <button
          type="button"
          onClick={handleBack}
          className="gnv2-nav-btn"
          aria-label="Terug naar profiel"
          title="Terug"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <div className="gnv2-identity gnv2-identity-center">
          <p className="gnv2-identity-eyebrow">Game Night</p>
          <p className="gnv2-identity-date">Mijn character</p>
        </div>
        <div className="gnv2-topbar-spacer" aria-hidden />
      </header>

      <div className="gnv2-creator-preview" aria-live="off">
        <div className="gnv2-creator-preview-frame">
          <CharacterVisual
            player={myPlayer}
            characterId={showLegacyPreview ? myPlayer.character_id : null}
            layers={showLegacyPreview ? undefined : previewLayers}
            loading="eager"
          />
        </div>
        {showLegacyPreview && (
          <p className="gnv2-creator-legacy-note">
            Dit is je huidige character — kies hieronder onderdelen om je eigen
            versie samen te stellen.
          </p>
        )}
      </div>

      <div
        className="gnv2-creator-tabs"
        role="tablist"
        aria-label="Character-categorieën"
      >
        {CHARACTER_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            role="tab"
            aria-selected={activeSlot === slot}
            onClick={() => setActiveSlot(slot)}
            className={`gnv2-creator-tab ${activeSlot === slot ? "gnv2-creator-tab-active" : ""}`}
          >
            {CHARACTER_SLOT_LABELS[slot]}
          </button>
        ))}
      </div>

      <div className="gnv2-creator-grid-wrap">
        {activeParts.length === 0 ? (
          <p className="gnv2-creator-empty-slot">
            Nog geen {CHARACTER_SLOT_LABELS[activeSlot].toLowerCase()}
            -onderdelen beschikbaar.
          </p>
        ) : (
          <div
            className="gnv2-creator-grid"
            role="radiogroup"
            aria-label={CHARACTER_SLOT_LABELS[activeSlot]}
          >
            {activeSlot !== LOCKED_SLOT && (
              <CharacterPartTileNone
                active={!draft[activeSlot]}
                onSelect={() => deselectPart(activeSlot)}
              />
            )}
            {activeParts.map((part) => {
              const status = derivePartTileStatus(
                part,
                activeSlot,
                draft[activeSlot],
                unlocks,
              );
              return (
                <CharacterPartTile
                  key={part.id}
                  part={part}
                  status={status}
                  colorHex={colorHex}
                  onSelect={() => selectPart(activeSlot, part.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="gnv2-creator-footer">
        <div aria-live="polite" className="gnv2-creator-status">
          {saveState === "success" && <p>Character opgeslagen</p>}
          {saveState === "partial-error" && (
            <p className="gnv2-creator-status-error">
              Niet alles is opgeslagen (
              {failedSlots.map((s) => CHARACTER_SLOT_LABELS[s]).join(", ")}) —
              probeer het opnieuw.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saveState === "saving"}
          className="gnv2-btn gnv2-btn-primary gnv2-creator-save"
        >
          {saveState === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Opslaan...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Opslaan
            </>
          )}
        </button>
      </div>

      {confirmLeave && (
        <div
          className="gnv2-sheet-backdrop"
          onClick={() => setConfirmLeave(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Niet-opgeslagen wijzigingen"
        >
          <div className="gnv2-sheet-card" onClick={(e) => e.stopPropagation()}>
            <p className="gnv2-dialog-title text-lg">
              Niet-opgeslagen wijzigingen
            </p>
            <p className="gnv2-dialog-muted text-sm">
              Je hebt je character aangepast maar nog niet opgeslagen. Toch
              teruggaan?
            </p>
            <div className="flex w-full gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="gnv2-btn gnv2-btn-ghost flex-1"
              >
                Blijven
              </button>
              <button
                type="button"
                onClick={() => navigate("/game-night/me")}
                className="gnv2-btn-danger-ghost flex-1"
              >
                Weggooien
              </button>
            </div>
          </div>
        </div>
      )}
    </GnV2Scene>
  );
}

// Klein hulpje: een "Geen"-tegel om een optionele slot bewust leeg te
// maken — geen aparte CharacterPartTile-variant nodig, dit is geen echt
// catalogus-onderdeel.
function CharacterPartTileNone({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`gnv2-part-tile gnv2-part-tile-none ${active ? "gnv2-part-tile-equipped" : ""}`}
    >
      <span className="gnv2-part-tile-preview">
        <span className="gnv2-part-tile-none-label">Geen</span>
      </span>
      <span className="gnv2-part-tile-label">Geen</span>
    </button>
  );
}
