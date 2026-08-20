import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type {
  GameNightBodyShape,
  GameNightCharacterPart,
  GameNightPlayer,
} from "@/lib/supabase";
import {
  CHARACTER_STARTER_MANIFEST,
  starterManifestBySlot,
} from "@/features/game-night/lib/characterStarterManifest";
import {
  useAllCharacterPartsForQa,
  useCharacterEquipmentForPlayers,
} from "@/features/game-night/hooks/useCharacterCatalog";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useSignedFaceUrl } from "@/features/game-night/hooks/useSignedFaceUrl";
import {
  characterVisualPropsFor,
  CHARACTER_SLOTS,
  CHARACTER_SLOT_LABELS,
  DEFAULT_BODY_SHAPE,
  groupPartsBySlot,
  personalFaceLayer,
  resolveBodyShapeAssetPath,
  resolveDraftLayers,
  resolvePlayerCharacter,
  type CharacterSlotMap,
  type ResolvedCharacterLayer,
} from "@/features/game-night/lib/gameNightCharacter";
import {
  applyHeadSafetyMask,
  BODY_REFERENCE,
  CHARACTER_CANVAS,
  compositeOntoCanonicalCanvas,
  computeHeadCropSourceRect,
  drawRegionToCanvas,
  FACE_ANCHOR,
  HEAD_CROP,
  HEAD_SAFETY_MASK,
  loadImageFromUrl,
  mapRectIntoRegion,
  NECK_CUTOFF,
} from "@/features/game-night/lib/gameNightFaceCanvas";
import { removeSelfieBackground } from "@/features/game-night/lib/gameNightFaceSegmentation";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

const QA_PLAYER: GameNightPlayer = {
  id: "qa-preview",
  name: "QA Preview",
  avatar_url: null,
  color: null,
  sort_order: 0,
  archived_at: null,
  nickname: null,
  auth_user_id: null,
  color_id: null,
  character_id: null,
  body_shape: null,
  face_original_path: null,
  face_asset_path: null,
  face_crop: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function manifestEntryToLayer(
  entry: (typeof CHARACTER_STARTER_MANIFEST)[number],
): ResolvedCharacterLayer {
  return {
    slot: entry.slot,
    partId: entry.key,
    key: entry.key,
    assetPath: entry.asset_path,
    layerOrder: entry.layer_order,
  };
}

function byKey(key: string): ResolvedCharacterLayer {
  const entry = CHARACTER_STARTER_MANIFEST.find((e) => e.key === key);
  if (!entry) throw new Error(`Onbekende starter-key in QA-grid: ${key}`);
  return manifestEntryToLayer(entry);
}

// Drie combinaties uit de V2.9D-opdracht (sectie 17) — puur de bestaande
// starter-keys, geen verzonnen data.
const QA_COMBOS: { label: string; layers: ResolvedCharacterLayer[] }[] = [
  {
    label: "Basis 1 + Neutraal + Kort haar + Casual outfit",
    layers: [
      byKey("base-default-01"),
      byKey("face-neutral-01"),
      byKey("hair-short-01"),
      byKey("outfit-casual-01"),
    ],
  },
  {
    label:
      "Basis 1 + Glimlach + Kort haar (donker) + Casual outfit (donker) + Pet",
    layers: [
      byKey("base-default-01"),
      byKey("face-smile-01"),
      byKey("hair-short-02"),
      byKey("outfit-casual-02"),
      byKey("headwear-cap-01"),
    ],
  },
  {
    label: "Basis 2 + alle overige slots (volledige stapel)",
    layers: [
      byKey("base-default-02"),
      byKey("face-neutral-01"),
      byKey("hair-short-01"),
      byKey("outfit-casual-01"),
      byKey("headwear-beanie-01"),
      byKey("accessory-glasses-01"),
      byKey("effect-glow-01"),
      byKey("badge-star-01"),
    ],
  },
];

// ── Handgetekende Photoshop-assets — data-driven QA-sectie ────────────────
//
// Vervangt de vroegere, hardcoded V2.9E-sectie (die rechtstreeks naar
// specifieke keys uit de inmiddels afgekeurde/verwijderde automatische
// extractie-batch verwees, zie 20260917000000_game_night_character_v2_
// deactivate_extracted_batch.sql). Deze sectie leest in plaats daarvan
// rechtstreeks de LIVE catalogus (useAllCharacterPartsForQa — ook
// inactieve rijen, i.t.t. de speler-facing useCharacterParts()) en heeft
// dus GEEN per-asset codewijziging meer nodig zodra nieuwe handgetekende
// PNG's + catalogus-rijen worden toegevoegd: gewoon opnieuw laden.
const V2_SLOTS = CHARACTER_SLOTS.filter(
  (slot) => !["face", "outfit", "accessory", "effect", "badge"].includes(slot),
);

function partLayer(
  part: GameNightCharacterPart,
  bodyShape: GameNightBodyShape = DEFAULT_BODY_SHAPE,
): ResolvedCharacterLayer {
  return {
    slot: part.slot,
    partId: part.id,
    key: part.key,
    assetPath: resolveBodyShapeAssetPath(part, bodyShape),
    layerOrder: part.layer_order,
  };
}

function compositeOnBase(
  part: GameNightCharacterPart,
  base: GameNightCharacterPart,
): ResolvedCharacterLayer[] {
  const bodyShape = base.body_shape ?? DEFAULT_BODY_SHAPE;
  return [partLayer(base), partLayer(part, bodyShape)].sort(
    (a, b) => a.layerOrder - b.layerOrder,
  );
}

// Eén gedeeltelijk-automatische "hoe ziet een volledig aangeklede
// character eruit"-preview — pakt per slot simpelweg de eerste actieve rij
// (op sort_order), puur als sanity-check, geen curated outfit. Gebruikt
// resolveDraftLayers (dezelfde functie als de echte Creator) zodat
// pose/prop-koppeling (bv. een mok die automatisch de bijpassende hand-laag
// kiest) ook hier correct werkt, i.p.v. dat apart te herbouwen.
function buildFullPreviewLayers(
  allParts: GameNightCharacterPart[],
  base: GameNightCharacterPart | undefined,
): ResolvedCharacterLayer[] {
  if (!base) return [];
  const bySlot = groupPartsBySlot(allParts);
  const draft = Object.fromEntries(
    CHARACTER_SLOTS.map((slot) => [slot, null]),
  ) as CharacterSlotMap;
  draft.base = base.id;
  for (const slot of V2_SLOTS) {
    if (slot === "base") continue;
    const first = (bySlot.get(slot) ?? []).find((p) => p.active);
    if (first) draft[slot] = first.id;
  }
  const partsById = new Map(allParts.map((p) => [p.id, p]));
  return resolveDraftLayers(
    draft,
    partsById,
    base.body_shape ?? DEFAULT_BODY_SHAPE,
  );
}

// Laadt een asset EXTRA (los van de zichtbare CharacterVisual-preview, puur
// voor validatie) om zijn werkelijke pixelafmetingen te checken tegen de
// canonieke standaard — een asset die wél laadt maar het verkeerde formaat
// heeft, is voor de rendering onopvallend fout (object-fit:contain verbergt
// het verschil visueel), dus dat moet deze QA-pagina expliciet uitspreken.
// `expectedSize` default 512 (de nieuwe canonieke Photoshop-/face-standaard,
// zie CHARACTER_CANVAS in gameNightFaceCanvas.ts) — expliciet parametriseerbaar
// zodat legacy 128×128-assets (indien die ooit weer terugkomen) hier ook
// nog correct gevalideerd kunnen worden zonder deze component te wijzigen.
function AssetDimensionCheck({
  assetPath,
  expectedSize = CHARACTER_CANVAS.width,
}: {
  assetPath: string;
  expectedSize?: number;
}) {
  const [status, setStatus] = useState<
    "loading" | "ok" | "wrong-size" | "missing"
  >("loading");
  return (
    <>
      <img
        src={assetPath}
        alt=""
        aria-hidden
        className="hidden"
        onLoad={(e) => {
          const img = e.currentTarget;
          setStatus(
            img.naturalWidth === expectedSize &&
              img.naturalHeight === expectedSize
              ? "ok"
              : "wrong-size",
          );
        }}
        onError={() => setStatus("missing")}
      />
      {status === "ok" && (
        <p className="text-[9px] text-emerald-500">
          {expectedSize}×{expectedSize} ✓
        </p>
      )}
      {status === "wrong-size" && (
        <p className="text-[9px] text-amber-500">
          ⚠ niet {expectedSize}×{expectedSize}
        </p>
      )}
      {status === "missing" && (
        <p className="gn-faint text-[9px]">bestand ontbreekt</p>
      )}
    </>
  );
}

// Checkerboard-achtergrond (opdracht sectie 17) — het klassieke
// transparantie-preview-patroon, zodat een per ongeluk toch ondoorzichtige
// achtergrond in face.png meteen visueel opvalt (i.t.t. de effen
// `bg-black/30` die elders in deze pagina volstaat voor gewone,
// altijd-ondoorzichtige catalogus-onderdelen).
const CHECKERBOARD_BG_STYLE = {
  backgroundImage:
    "conic-gradient(#8a8a8a 90deg, #bdbdbd 90deg 180deg, #8a8a8a 180deg 270deg, #bdbdbd 270deg)",
  backgroundSize: "16px 16px",
};

// Laadt een asset via een <canvas> (niet alleen <img>) om daadwerkelijk de
// pixel-alfawaarden te kunnen inspecteren — AssetDimensionCheck controleert
// alleen breedte/hoogte, niet of er ook echt transparantie IN zit. Sampled
// de 4 hoeken (die bij een correcte face-export altijd buiten het hoofd
// vallen, zie CHARACTER_CANVAS/FACE_ANCHOR) — bij een per ongeluk volledig
// ondoorzichtige 512x512-foto (de oude V1-bug uit het vorige rapport) zijn
// die hoeken juist NIET transparant, en dat is precies wat dit moet
// signaleren.
function TransparencyCheck({ assetPath }: { assetPath: string }) {
  const [status, setStatus] = useState<
    "loading" | "transparent" | "opaque" | "error"
  >("loading");
  return (
    <>
      <img
        src={assetPath}
        alt=""
        aria-hidden
        className="hidden"
        crossOrigin="anonymous"
        onLoad={(e) => {
          try {
            const img = e.currentTarget;
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx || canvas.width === 0 || canvas.height === 0) {
              setStatus("error");
              return;
            }
            ctx.drawImage(img, 0, 0);
            const w = canvas.width;
            const h = canvas.height;
            const corners = [
              ctx.getImageData(0, 0, 1, 1).data,
              ctx.getImageData(w - 1, 0, 1, 1).data,
              ctx.getImageData(0, h - 1, 1, 1).data,
              ctx.getImageData(w - 1, h - 1, 1, 1).data,
            ];
            const allCornersTransparent = corners.every((c) => c[3] < 10);
            setStatus(allCornersTransparent ? "transparent" : "opaque");
          } catch {
            // Meestal een CORS/"tainted canvas"-beperking — geen crash,
            // gewoon "kon niet gecontroleerd worden" tonen.
            setStatus("error");
          }
        }}
        onError={() => setStatus("error")}
      />
      {status === "transparent" && (
        <span className="text-[10px] text-emerald-500">
          ✓ alpha aanwezig, hoeken transparant
        </span>
      )}
      {status === "opaque" && (
        <span className="text-[10px] font-semibold text-amber-500">
          ⚠ hoeken NIET transparant — ondoorzichtige achtergrond
        </span>
      )}
      {status === "error" && (
        <span className="gn-faint text-[10px]">
          kon transparantie niet controleren
        </span>
      )}
    </>
  );
}

// Personal Face QA (opdracht sectie 14) — canonieke guide-overlay
// (centerline/top-head/kin/body-bbox), percentage-gepositioneerd binnen een
// vierkant element — exact dezelfde aanpak als FaceCropper.tsx, zodat wat
// hier te zien is 1-op-1 overeenkomt met wat de cropper tijdens het maken
// van de foto toonde.
function FaceGuideOverlay() {
  const topPct = (FACE_ANCHOR.topY / CHARACTER_CANVAS.height) * 100;
  const chinPct = (FACE_ANCHOR.chinY / CHARACTER_CANVAS.height) * 100;
  const centerPct = (FACE_ANCHOR.centerX / CHARACTER_CANVAS.width) * 100;
  const bodyLeftPct = (BODY_REFERENCE.leftX / CHARACTER_CANVAS.width) * 100;
  const bodyRightPct = (BODY_REFERENCE.rightX / CHARACTER_CANVAS.width) * 100;
  const bodyTopPct = (BODY_REFERENCE.topY / CHARACTER_CANVAS.height) * 100;
  const bodyBottomPct =
    (BODY_REFERENCE.bottomY / CHARACTER_CANVAS.height) * 100;
  // Nek-cutoff fade-zone (opdracht sectie 19: "toon indien mogelijk visueel
  // de cutoff/fade-zone in debugmodus") — de exacte band, in canonieke
  // Y-coördinaten, waarbinnen renderCanonicalFaceCanvas de alfa geleidelijk
  // naar 0 laat lopen (zie applyNeckCutoffFade/NECK_CUTOFF in
  // gameNightFaceCanvas.ts). Alfa is HARD 0 vanaf de onderkant van deze band.
  const neckSolidUntilPct =
    ((FACE_ANCHOR.chinY + NECK_CUTOFF.allowancePx) / CHARACTER_CANVAS.height) *
    100;
  const neckFadeEndPct =
    ((FACE_ANCHOR.chinY + NECK_CUTOFF.allowancePx + NECK_CUTOFF.fadePx) /
      CHARACTER_CANVAS.height) *
    100;
  // Head safety mask — maximum head-zone (opdracht: "toon in debugmodus de
  // maximum head-zone subtiel als lijn"). SVG met viewBox 0..512 zodat de
  // keyframes (canonieke pixels) er 1-op-1 in overnemen, geen percentage-
  // omrekening nodig — puur ter visualisatie, dezelfde HEAD_SAFETY_MASK-
  // data als de daadwerkelijke maskerfunctie (applyHeadSafetyMask) gebruikt.
  const leftBoundaryPoints = HEAD_SAFETY_MASK.keyframes
    .map((k) => `${FACE_ANCHOR.centerX - k.halfWidth},${k.y}`)
    .join(" ");
  const rightBoundaryPoints = HEAD_SAFETY_MASK.keyframes
    .map((k) => `${FACE_ANCHOR.centerX + k.halfWidth},${k.y}`)
    .join(" ");
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* BODY_REFERENCE-bbox (documentatie, niet afgedwongen) */}
      <div
        className="absolute border border-dashed border-sky-400/70"
        style={{
          left: `${bodyLeftPct}%`,
          right: `${100 - bodyRightPct}%`,
          top: `${bodyTopPct}%`,
          bottom: `${100 - bodyBottomPct}%`,
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${CHARACTER_CANVAS.width} ${CHARACTER_CANVAS.height}`}
        preserveAspectRatio="none"
      >
        <polyline
          points={leftBoundaryPoints}
          fill="none"
          stroke="rgb(232 121 249 / 0.65)"
          strokeWidth={2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={rightBoundaryPoints}
          fill="none"
          stroke="rgb(232 121 249 / 0.65)"
          strokeWidth={2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        className="absolute inset-x-0 border-y border-dashed border-amber-400/70 bg-amber-400/10"
        style={{
          top: `${neckSolidUntilPct}%`,
          height: `${neckFadeEndPct - neckSolidUntilPct}%`,
        }}
      />
      <p
        className="absolute left-1.5 text-[9px] font-semibold text-amber-300"
        style={{ top: `${neckFadeEndPct}%` }}
      >
        nek-cutoff fade-zone
      </p>
      <div
        className="absolute inset-x-0 border-t-2 border-emerald-400"
        style={{ top: `${topPct}%` }}
      />
      <div
        className="absolute inset-x-0 border-t-2 border-emerald-400"
        style={{ top: `${chinPct}%` }}
      />
      <div
        className="absolute inset-y-0 border-l-2 border-emerald-400/70"
        style={{ left: `${centerPct}%` }}
      />
    </div>
  );
}

// Processing-QA (opdracht sectie 19: "Processing: head-crop vóór
// segmentation; segmentation-resultaat") — herbouwt op verzoek (knop, niet
// automatisch — MediaPipe opnieuw draaien is relatief zwaar) exact dezelfde
// head-crop/segmentatiestappen als de echte flow (GameNightFaceSetup.tsx),
// via dezelfde geëxporteerde helpers uit gameNightFaceCanvas.ts/
// gameNightFaceSegmentation.ts — GEEN tweede, losse implementatie van die
// pipeline. Werkt uitsluitend voor spelers met zowel face_original_path als
// face_crop (nodig om het oorspronkelijke hoofdgebied te reconstrueren).
function FaceProcessingDebugPanel({ player }: { player: GameNightPlayer }) {
  const signedOriginal = useSignedFaceUrl(player.face_original_path);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "error" | "no-data"
  >("idle");
  const [headCropUrl, setHeadCropUrl] = useState<string | null>(null);
  const [segmentedUrl, setSegmentedUrl] = useState<string | null>(null);
  const [afterSafetyMaskUrl, setAfterSafetyMaskUrl] = useState<string | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function generate() {
    if (!signedOriginal.data || !player.face_crop) {
      setStatus("no-data");
      return;
    }
    setStatus("loading");
    setErrorMsg(null);
    try {
      const image = await loadImageFromUrl(signedOriginal.data);
      const cropRect = {
        sourceX: player.face_crop.sourceX,
        sourceY: player.face_crop.sourceY,
        sourceWidth: player.face_crop.sourceWidth,
        sourceHeight: player.face_crop.sourceHeight,
      };
      const headRegion = computeHeadCropSourceRect(
        cropRect,
        image.naturalWidth,
        image.naturalHeight,
      );
      const { canvas: headCanvas, scale } = drawRegionToCanvas(
        image,
        headRegion,
        HEAD_CROP.maxOutputSidePx,
      );
      setHeadCropUrl(headCanvas.toDataURL("image/png"));
      const { canvas: segmentedCanvas } =
        await removeSelfieBackground(headCanvas);
      setSegmentedUrl(segmentedCanvas.toDataURL("image/png"));

      // "Resultaat ná safety mask" (opdracht sectie 19) — exact dezelfde
      // canonieke plaatsing + applyHeadSafetyMask als renderCanonicalFaceCanvas
      // zelf gebruikt (geen tweede implementatie), maar bewust ZONDER de
      // nek-cutoff-fade erna, zodat het effect van het safety mask op
      // zichzelf zichtbaar is — de definitieve face.png (met neck-fade erbij)
      // staat al hierboven in de Output-sectie.
      const cropInHeadSpace = mapRectIntoRegion(cropRect, headRegion, scale);
      const canonicalCanvas = compositeOntoCanonicalCanvas(
        segmentedCanvas,
        cropInHeadSpace,
      );
      const canonicalCtx = canonicalCanvas.getContext("2d");
      if (canonicalCtx) {
        applyHeadSafetyMask(
          canonicalCtx,
          CHARACTER_CANVAS.width,
          CHARACTER_CANVAS.height,
        );
        setAfterSafetyMaskUrl(canonicalCanvas.toDataURL("image/png"));
      }
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Onbekende fout");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={status === "loading" || !signedOriginal.data}
        className="gnv2-btn gnv2-btn-ghost px-3 py-1.5 text-xs"
      >
        {status === "loading" ? "Bezig…" : "Genereer processing-preview"}
      </button>
      {status === "no-data" && (
        <p className="gn-faint text-[10px]">
          Geen face_original_path/face_crop beschikbaar voor deze speler.
        </p>
      )}
      {status === "error" && (
        <p className="text-[10px] text-red-400">{errorMsg}</p>
      )}
      {(signedOriginal.data ||
        headCropUrl ||
        segmentedUrl ||
        afterSafetyMaskUrl) && (
        <div className="flex flex-wrap gap-4">
          {signedOriginal.data && (
            <div className="w-28 text-center">
              <p className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
                Input (origineel)
              </p>
              <img
                src={signedOriginal.data}
                alt=""
                className="mx-auto aspect-square w-28 rounded-lg object-cover"
              />
            </div>
          )}
          {headCropUrl && (
            <div className="w-28 text-center">
              <p className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
                Head-crop (vóór segmentation)
              </p>
              <img
                src={headCropUrl}
                alt=""
                className="mx-auto aspect-square w-28 rounded-lg object-cover"
              />
            </div>
          )}
          {segmentedUrl && (
            <div className="w-28 text-center">
              <p className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
                Segmentation-resultaat (vóór safety mask)
              </p>
              <div
                className="mx-auto aspect-square w-28 overflow-hidden rounded-lg"
                style={CHECKERBOARD_BG_STYLE}
              >
                <img
                  src={segmentedUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}
          {afterSafetyMaskUrl && (
            <div className="w-28 text-center">
              <p className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
                Ná safety mask (vóór neck-fade)
              </p>
              <div
                className="relative mx-auto aspect-square w-28 overflow-hidden rounded-lg"
                style={CHECKERBOARD_BG_STYLE}
              >
                <img
                  src={afterSafetyMaskUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <FaceGuideOverlay />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Composite-QA (opdracht sectie 19: "volledige character composite") — de
// ECHTE, opgeslagen equipment van de geselecteerde speler (i.t.t. de
// hiernaast al bestaande "Face + body"-panelen, die uitsluitend base+face
// tonen) via resolvePlayerCharacter() — dezelfde functie als
// GameNightMe.tsx/Lobby/Arena, geen aparte resolutielogica.
function FullCharacterCompositePreview({
  player,
}: {
  player: GameNightPlayer;
}) {
  const { data: allParts = [] } = useAllCharacterPartsForQa();
  const { data: equipment = [] } = useCharacterEquipmentForPlayers([player.id]);
  const partsById = useMemo(
    () => new Map(allParts.map((p) => [p.id, p])),
    [allParts],
  );
  const resolved = resolvePlayerCharacter(player, equipment, partsById);
  const visualProps = characterVisualPropsFor(resolved);
  return (
    <div className="w-32 text-center">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
        Volledige character (opgeslagen equipment)
      </p>
      <div className="mx-auto flex aspect-square w-32 items-center justify-center overflow-hidden rounded-xl bg-black/30">
        <CharacterVisual
          player={player}
          characterId={visualProps.characterId}
          layers={visualProps.layers}
        />
      </div>
    </div>
  );
}

// Personal Face QA — toont voor één gekozen speler (dropdown eronder) diens
// opgeslagen face-layer los, op de man-/vrouw-base, de canonieke guides
// erover (om te vergelijken met de Photoshop-test), de werkelijke
// pixelafmetingen, en storage/database-status. Puur leesbaar/diagnostisch —
// geen enkele schrijfactie hier (die staat in GameNightFaceSetup.tsx).
function PersonalFaceQaSection({
  players,
  maleBase,
  femaleBase,
}: {
  players: GameNightPlayer[];
  maleBase: GameNightCharacterPart | undefined;
  femaleBase: GameNightCharacterPart | undefined;
}) {
  const playersWithFace = players.filter((p) => p.face_asset_path);
  const [selectedId, setSelectedId] = useState<string | null>(
    playersWithFace[0]?.id ?? null,
  );
  const selected =
    playersWithFace.find((p) => p.id === selectedId) ?? playersWithFace[0];

  // game-night-player-faces is een PRIVÉ bucket (20260918000000) —
  // face_asset_path is dus een kaal storage-pad, geen bruikbare URL. De
  // CharacterVisual-previews hieronder lossen dat zelf al intern op (zie
  // CharacterVisual.tsx), maar de losse dimensie-/transparantiecontroles
  // hebben zelf ook een echte URL nodig.
  const signedFace = useSignedFaceUrl(selected?.face_asset_path);

  return (
    <div className="gn-panel-elevated space-y-4 px-5 py-4">
      <div>
        <p className="gn-eyebrow mb-1">Personal Face QA</p>
        <p className="gn-faint text-xs">
          Vergelijk dit met je Photoshop-test: de groene lijnen zijn de
          canonical guides (X256/Y50/Y320), de blauwe stippellijn is de
          BODY_REFERENCE-bbox (X68–422/Y264–480, documentatie). De geblokte
          achtergrond maakt een per ongeluk ondoorzichtige face-export direct
          zichtbaar.
        </p>
      </div>

      {playersWithFace.length === 0 ? (
        <p className="gn-faint text-xs">
          Nog geen enkele speler heeft een face-layer ingesteld.
        </p>
      ) : (
        <>
          <select
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="gnv2-input max-w-xs"
          >
            {playersWithFace.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname ?? p.name}
              </option>
            ))}
          </select>

          {selected && (
            <div className="flex flex-wrap gap-6">
              {/* 1: los, met canonieke guides erover, op een geblokte
                  achtergrond zodat een niet-transparante rand/hoek meteen
                  opvalt (opdracht sectie 17). */}
              <div className="w-32 text-center">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
                  Face los + guides
                </p>
                <div
                  className="relative mx-auto aspect-square w-32 overflow-hidden rounded-xl"
                  style={CHECKERBOARD_BG_STYLE}
                >
                  <CharacterVisual
                    player={selected}
                    characterId={null}
                    layers={[personalFaceLayer(selected)].filter(
                      (l) => l !== null,
                    )}
                  />
                  <FaceGuideOverlay />
                </div>
              </div>

              {/* 2: body los (man + vrouw) */}
              {maleBase && (
                <div className="w-32 text-center">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
                    Body los (man)
                  </p>
                  <div className="mx-auto flex aspect-square w-32 items-center justify-center overflow-hidden rounded-xl bg-black/30">
                    <CharacterVisual
                      player={QA_PLAYER}
                      layers={[partLayer(maleBase)]}
                    />
                  </div>
                </div>
              )}
              {femaleBase && (
                <div className="w-32 text-center">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
                    Body los (vrouw)
                  </p>
                  <div className="mx-auto flex aspect-square w-32 items-center justify-center overflow-hidden rounded-xl bg-black/30">
                    <CharacterVisual
                      player={QA_PLAYER}
                      layers={[partLayer(femaleBase)]}
                    />
                  </div>
                </div>
              )}

              {/* 3: face + body samengesteld (man + vrouw) — face-layer_order
                  (40) ligt boven base (20), dezelfde stacking als de echte
                  compositie via resolvePlayerCharacter(). */}
              {maleBase && (
                <div className="w-32 text-center">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
                    Face + body (man)
                  </p>
                  <div className="relative mx-auto aspect-square w-32 overflow-hidden rounded-xl bg-black/30">
                    <CharacterVisual
                      player={selected}
                      characterId={null}
                      layers={[partLayer(maleBase), personalFaceLayer(selected)]
                        .filter((l): l is ResolvedCharacterLayer => l !== null)
                        .sort((a, b) => a.layerOrder - b.layerOrder)}
                    />
                  </div>
                </div>
              )}
              {femaleBase && (
                <div className="w-32 text-center">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
                    Face + body (vrouw)
                  </p>
                  <div className="relative mx-auto aspect-square w-32 overflow-hidden rounded-xl bg-black/30">
                    <CharacterVisual
                      player={selected}
                      characterId={null}
                      layers={[
                        partLayer(femaleBase),
                        personalFaceLayer(selected),
                      ]
                        .filter((l): l is ResolvedCharacterLayer => l !== null)
                        .sort((a, b) => a.layerOrder - b.layerOrder)}
                    />
                  </div>
                </div>
              )}

              {/* 4: volledige, ECHTE opgeslagen character-samenstelling
                  (opdracht sectie 19 "Composite") — inclusief overige
                  equipped onderdelen, niet alleen base+face. */}
              <FullCharacterCompositePreview player={selected} />
            </div>
          )}

          {selected && (
            <div className="space-y-2">
              <p className="gn-eyebrow">Processing (op verzoek)</p>
              <FaceProcessingDebugPanel player={selected} />
            </div>
          )}

          {selected && (
            <div className="gn-faint space-y-1 text-[11px]">
              <p>
                face_asset_path:{" "}
                {selected.face_asset_path ?? "— niet ingesteld —"} (privé bucket
                — storage-pad, geen directe URL)
              </p>
              <p>
                face_original_path:{" "}
                {selected.face_original_path ?? "— niet ingesteld —"}
              </p>
              <p>
                face_crop:{" "}
                {selected.face_crop
                  ? `x=${selected.face_crop.sourceX}, y=${selected.face_crop.sourceY}, w=${selected.face_crop.sourceWidth}, h=${selected.face_crop.sourceHeight}` +
                    (selected.face_crop.segmentationVersion
                      ? `, segmentationVersion=${selected.face_crop.segmentationVersion}`
                      : "") +
                    (selected.face_crop.processedAt
                      ? `, processedAt=${selected.face_crop.processedAt}`
                      : "")
                  : "— niet ingesteld —"}
              </p>
              <p>
                getekende URL (60 min geldig):{" "}
                {signedFace.isLoading
                  ? "wordt opgehaald…"
                  : signedFace.isError
                    ? "kon niet worden opgehaald"
                    : "beschikbaar ✓"}
              </p>
              {signedFace.data && (
                <>
                  <p className="flex items-center gap-1">
                    Werkelijke afmetingen face-output:{" "}
                    <AssetDimensionCheck assetPath={signedFace.data} />
                  </p>
                  <p className="flex items-center gap-1">
                    Transparantie:{" "}
                    <TransparencyCheck assetPath={signedFace.data} />
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Game Night — development-only QA-hulpmiddel, GEEN publieke Game
// Night-feature: nergens in de navigatie gelinkt, alleen bereikbaar via de
// directe URL, en owner-only (zelfde bewaking als de overige owner-tools
// in deze app).
export default function CharacterAssetQaGrid() {
  const { isOwner } = useAuth();
  const bySlot = starterManifestBySlot();
  const { data: allParts = [] } = useAllCharacterPartsForQa();
  const { data: analyticsData } = useGameNightAnalytics();
  const v2BySlot = groupPartsBySlot(
    allParts.filter((p) => V2_SLOTS.includes(p.slot)),
  );

  if (!isOwner) {
    return (
      <GnV2Scene className="gnv2-creator-scene">
        <div className="gnv2-creator-empty">
          <p>Alleen de owner kan deze QA-pagina bekijken.</p>
        </div>
      </GnV2Scene>
    );
  }

  const maleBase = allParts.find(
    (p) =>
      p.slot === "base" &&
      p.active &&
      p.key.includes("male") &&
      !p.key.includes("female"),
  );
  const femaleBase =
    allParts.find(
      (p) => p.slot === "base" && p.active && p.body_shape === "medium",
    ) ??
    allParts.find(
      (p) => p.slot === "base" && p.active && p.key.includes("female"),
    );

  const fullPreviewMale = buildFullPreviewLayers(allParts, maleBase);
  const fullPreviewFemale = buildFullPreviewLayers(allParts, femaleBase);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <p className="gn-eyebrow mb-1.5">Game Night — dev-only</p>
        <h1 className="gn-display text-2xl font-semibold">
          Character Asset QA
        </h1>
        <p className="gn-faint mt-1 text-xs">
          Niet in de navigatie — uitsluitend voor het controleren van de
          catalogus-onderdelen. Een lege/lettertegel i.p.v. een afbeelding
          betekent dat de asset nog niet fysiek aanwezig is — CharacterVisual
          valt dan stilzwijgend terug op de initiaal, precies zoals in de
          Creator/Lobby/Arena.
        </p>
      </div>

      <div className="gn-panel-elevated px-5 py-4">
        <p className="gn-eyebrow mb-1">
          Character-onderdelen — huidige catalogus (512×512, handgetekend)
        </p>
        <p className="gn-faint text-xs">
          Toont rechtstreeks de live database (ook
          inactieve/needs_asset_revision- rijen) — geen hardcoded lijst meer.
          Plaats nieuwe PNG's in{" "}
          <code>public/game-night/characters/parts/custom/&lt;slot&gt;/</code>{" "}
          en registreer ze via een nieuwe migratie; ze verschijnen hier
          automatisch zonder codewijziging.
        </p>
      </div>

      {(maleBase || femaleBase) && (
        <div className="gn-panel-elevated px-5 py-4">
          <p className="gn-eyebrow mb-3">
            Volledig samengestelde character (sanity-check, eerste actieve rij
            per slot — geen curated outfit)
          </p>
          <div className="flex flex-wrap gap-6">
            {maleBase && (
              <div className="w-40 text-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-black/20">
                  <CharacterVisual
                    player={QA_PLAYER}
                    layers={fullPreviewMale}
                  />
                </div>
                <p className="mt-2 text-xs">Man ({maleBase.label})</p>
              </div>
            )}
            {femaleBase && (
              <div className="w-40 text-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-black/20">
                  <CharacterVisual
                    player={QA_PLAYER}
                    layers={fullPreviewFemale}
                  />
                </div>
                <p className="mt-2 text-xs">Vrouw ({femaleBase.label})</p>
              </div>
            )}
          </div>
        </div>
      )}

      <PersonalFaceQaSection
        players={analyticsData?.players ?? []}
        maleBase={maleBase}
        femaleBase={femaleBase}
      />

      {[...v2BySlot.entries()].map(([slot, entries]) => (
        <div key={`v2-${slot}`} className="gn-panel-elevated px-5 py-4">
          <p className="gn-eyebrow mb-3">
            {CHARACTER_SLOT_LABELS[slot]} ·{" "}
            {entries.filter((e) => e.active).length}/{entries.length} actief
          </p>
          <div className="flex flex-wrap gap-4">
            {entries.map((item) => (
              <div key={item.key} className="w-24 space-y-2 text-center">
                <div>
                  <p className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
                    Los
                  </p>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-black/20">
                    <CharacterVisual
                      player={QA_PLAYER}
                      layers={[partLayer(item)]}
                    />
                  </div>
                </div>
                {slot !== "base" && maleBase && (
                  <div>
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
                      Op man
                    </p>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-black/20">
                      <CharacterVisual
                        player={QA_PLAYER}
                        layers={compositeOnBase(item, maleBase)}
                      />
                    </div>
                  </div>
                )}
                {slot !== "base" && femaleBase && (
                  <div>
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
                      Op vrouw
                    </p>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-black/20">
                      <CharacterVisual
                        player={QA_PLAYER}
                        layers={compositeOnBase(item, femaleBase)}
                      />
                    </div>
                  </div>
                )}
                <p className="text-[11px] font-semibold">{item.label}</p>
                <p className="gn-faint text-[10px]">{item.key}</p>
                <p className="gn-faint text-[10px]">
                  slot: {item.slot} · {item.active ? "actief" : "inactief"}
                </p>
                <AssetDimensionCheck assetPath={item.asset_path} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div>
        <p className="gn-eyebrow mb-3">
          V2.9B (legacy) — 14 starter-onderdelen
        </p>
      </div>

      {[...bySlot.entries()].map(([slot, entries]) => (
        <div key={slot} className="gn-panel-elevated px-5 py-4">
          <p className="gn-eyebrow mb-3">
            {CHARACTER_SLOT_LABELS[slot]} · layer_order{" "}
            {entries[0]?.layer_order}
          </p>
          <div className="flex flex-wrap gap-4">
            {entries.map((entry) => (
              <div key={entry.key} className="w-24 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-black/20">
                  <CharacterVisual
                    player={QA_PLAYER}
                    layers={[manifestEntryToLayer(entry)]}
                  />
                </div>
                <p className="mt-1 text-[11px] font-semibold">{entry.label}</p>
                <p className="gn-faint text-[10px]">{entry.key}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div>
        <p className="gn-eyebrow mb-3">Samengestelde combinaties</p>
        <div className="flex flex-wrap gap-6">
          {QA_COMBOS.map((combo) => (
            <div key={combo.label} className="w-40 text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-black/20">
                <CharacterVisual player={QA_PLAYER} layers={combo.layers} />
              </div>
              <p className="mt-2 text-xs">{combo.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
