import type {
  GameNightBodyShape,
  GameNightCharacterPart,
  GameNightCharacterSlot,
  GameNightPlayer,
  GameNightPlayerCharacterEquipment,
  GameNightPlayerCharacterUnlock,
} from "@/lib/supabase";
import { PERSONAL_FACE_LAYER_ORDER } from "@/features/game-night/lib/gameNightFaceCanvas";

export type { GameNightBodyShape };

// Game Night V2.9B (sectie 9) — de ENE bron van waarheid voor "hoe wordt
// een samengesteld character opgebouwd/geautoriseerd". De UI (CharacterVisual/
// GameNightCharacter, en straks de V2.9C Character Creator) MOET dit
// bestand gebruiken i.p.v. zelf uit te zoeken welke laag waar hoort of
// welk onderdeel mag worden aangetrokken — precies zoals gameNightArena.ts
// dat al doet voor de arena-configuratie. Puur data in, data uit: geen
// Supabase-call, geen JSX, geen state.
//
// LEGACY-COMPATIBILITEIT (sectie 8): game_night_players.character_id (V2.8,
// 12 vaste presets) blijft ONGEWIJZIGD bestaan en werkend. Een speler
// zonder modulaire equipment valt terug op zijn character_id; zodra een
// speler ook maar één onderdeel modulair draagt, wint de modulaire
// configuratie volledig (geen mengvorm tussen de twee systemen). Pas een
// veel latere migratie mag character_id ooit laten vervallen.

export const CHARACTER_SLOTS: readonly GameNightCharacterSlot[] = [
  // V2.9B — legacy 8-slot systeem, blijft volledig geldig.
  "base",
  "face",
  "hair",
  "outfit",
  "headwear",
  "accessory",
  "effect",
  "badge",
  // Game Night V2.9E (20260915000000) — nieuwe 128×128 pixel-art slots.
  // "base"/"hair"/"headwear" hierboven worden HERGEBRUIKT door de nieuwe
  // catalogus (zelfde slotnaam, nieuwe content) — zie het V2.9E-opleverrapport.
  "clothing",
  "eyes",
  "eyebrows",
  "mouth",
  "facial-hair",
  "glasses",
  "arms",
  "props",
  "foreground-effects",
];

// Nederlandse UI-labels (V2.9C sectie 3) — ÉÉN plek, zodat de Creator-tabs
// en een eventuele toekomstige owner-tool nooit uit de pas kunnen lopen.
export const CHARACTER_SLOT_LABELS: Record<GameNightCharacterSlot, string> = {
  base: "Basis",
  face: "Gezicht",
  hair: "Haar",
  outfit: "Outfit",
  headwear: "Hoed",
  accessory: "Accessoire",
  effect: "Effect",
  badge: "Badge",
  clothing: "Kleding",
  eyes: "Ogen",
  eyebrows: "Wenkbrauwen",
  mouth: "Mond",
  "facial-hair": "Gezichtsbeharing",
  glasses: "Bril",
  arms: "Armen",
  props: "Voorwerp",
  "foreground-effects": "Effect (voorgrond)",
};

export function isCharacterSlot(
  value: string | null | undefined,
): value is GameNightCharacterSlot {
  return CHARACTER_SLOTS.includes(value as GameNightCharacterSlot);
}

// Aanbevolen standaard-layer_order per slot (sectie 2/10) — puur een
// CONVENTIE voor het aanmaken van nieuwe catalogus-rijen (zie de
// starter-seed-migratie), niet database-afgedwongen: de daadwerkelijke
// stacking-volgorde bij het renderen komt altijd van het PART's eigen
// layer_order-veld, nooit van deze tabel, zodat een uitzondering (bv. een
// "effect" dat voorAAN moet liggen) altijd mogelijk blijft zonder dit
// bestand te hoeven aanpassen.
// Nieuwe slots (V2.9E) zijn bewust in een eigen, tussenliggende numerieke
// band gekozen zodat ze correct interleaven met de HERGEBRUIKTE bestaande
// anchors (base=20, hair=50, headwear=60) volgens de voorgeschreven
// volgorde: base → clothing → eyes → eyebrows → mouth → facial-hair → hair
// → glasses → headwear → arms → props → foreground-effects. Overlap in
// getal met een ongebruikt legacy-slot (bv. props=75 vs. geen legacy-slot
// op 75) is onschadelijk: legacy- en V2.9E-content komen nooit samen op
// hetzelfde character voor.
export const DEFAULT_SLOT_LAYER_ORDER: Record<GameNightCharacterSlot, number> =
  {
    effect: 10,
    base: 20,
    clothing: 25,
    outfit: 30,
    eyes: 32,
    eyebrows: 34,
    mouth: 36,
    "facial-hair": 38,
    face: 40,
    hair: 50,
    glasses: 55,
    headwear: 60,
    arms: 65,
    accessory: 70,
    props: 75,
    badge: 80,
    "foreground-effects": 95,
  };

// De basis-laag mag nooit leeg zijn (sectie 12, zie ook de
// unequip-RPC-migratie) — een enkele plek die dat vastlegt, zodat een
// toekomstige creator-UI dezelfde regel kan controleren vóór een
// unequip-aanroep i.p.v. te wachten op de RPC-foutmelding.
export const LOCKED_SLOT: GameNightCharacterSlot = "base";

export function isSlotLocked(slot: GameNightCharacterSlot): boolean {
  return slot === LOCKED_SLOT;
}

export type ResolvedCharacterLayer = {
  slot: GameNightCharacterSlot;
  partId: string;
  key: string;
  assetPath: string;
  layerOrder: number;
};

export type ResolvedCharacter =
  | { mode: "modular"; layers: ResolvedCharacterLayer[] }
  | { mode: "legacy"; characterId: string }
  | { mode: "empty" };

// ── Lichaamsbouw (V2.9E) ─────────────────────────────────────────────────
//
// GEEN cupmaten in de UI — deze drie waarden zijn de enige toegestane
// interne representatie, gepresenteerd in de Creator als "Klein"/
// "Gemiddeld"/"Groot" onder "Lichaamsbouw". "medium" is de vaste default
// voor bestaande spelers zonder keuze (nooit een kolomdefault die dat
// verhult — expliciet hier, op de ENE plek die dat bepaalt).
export const DEFAULT_BODY_SHAPE: GameNightBodyShape = "medium";

export const BODY_SHAPE_LABELS: Record<GameNightBodyShape, string> = {
  small: "Klein",
  medium: "Gemiddeld",
  large: "Groot",
};

export function resolveBodyShape(
  player: Pick<GameNightPlayer, "body_shape">,
): GameNightBodyShape {
  return player.body_shape ?? DEFAULT_BODY_SHAPE;
}

// Eén part kan dienen voor meerdere lichaamsvormen via `body_shape_variants`
// terwijl de speler in de UI nog altijd maar ÉÉN tegel kiest (bv. "Groene
// hoodie"). Ontbrekende sleutel voor de gekozen vorm = needs_asset_revision
// voor die combinatie; val dan terug op de medium-variant, en anders op het
// part's eigen asset_path — kleding verdwijnt hierdoor nooit stilzwijgend,
// en er is GEEN CSS-scaling-hack nodig om één asset kunstmatig passend te
// maken voor een vorm waar geen echte art voor is.
export function resolveBodyShapeAssetPath(
  part: Pick<GameNightCharacterPart, "asset_path" | "body_shape_variants">,
  bodyShape: GameNightBodyShape,
): string {
  const variants = part.body_shape_variants;
  if (!variants) return part.asset_path;
  return variants[bodyShape] ?? variants.medium ?? part.asset_path;
}

// De 3 direct selecteerbare female-base-tegels voor de "Lichaamsbouw"-
// picker — elke tegel is een APART catalogus-item (eigen `id`/`key`) met
// een gezette `body_shape`, niet drie varianten van ÉÉN item (dat is
// voorbehouden aan kleding/armen via body_shape_variants hierboven).
//
// Bewust GEEN `active`-filter hier: small/large staan vandaag inactief
// (needs_asset_revision, nog geen echte art) maar moeten wél als
// (uitgegrijsde) optie in de picker verschijnen, anders lijkt "Lichaamsbouw"
// een keuze uit slechts één optie. canEquipPart() blijft de daadwerkelijke
// selecteerbaarheid bepalen — de caller combineert deze lijst daarmee.
export function getBodyShapeBaseParts(
  parts: GameNightCharacterPart[],
): GameNightCharacterPart[] {
  return parts
    .filter((p) => p.slot === "base" && p.body_shape != null)
    .sort((a, b) => a.sort_order - b.sort_order);
}

// ── Pose/prop-compatibiliteit (V2.9E) ────────────────────────────────────
//
// Een prop die aan een pose gebonden is (bv. prop-mug-01 →
// requires_pose_key "pose-hold-mug") mag nooit los voor het character
// "zweven" — de speler kiest ÉÉN voorwerp-tegel, en de arm/hand-laag wordt
// hier automatisch meegekozen, zonder dat de speler de arms-slot apart
// hoeft te bedienen. Een prop zonder `requires_pose_key` is decoratief en
// pose-onafhankelijk (bv. een controller/headphones-icoon zonder bijpassende
// hand-sprite in de brondata — zie het opleverrapport).
// Arm-sprites zijn base-specifiek (andere mouw/huid dan de female-arm-
// sprite) — `requires_pose_key` op een prop is daarom een GENDER-NEUTRALE
// pose-id (bv. "hold-mug"), terwijl elke arms-rij zijn eigen gender-
// specifieke `pose_key` draagt (bv. "hold-mug-f"/"hold-mug-m"). Het
// geslacht wordt afgeleid uit de key van de momenteel actieve base-laag
// (bevat "female" of "male") — geen aparte state nodig.
function genderMarkerFromBaseKey(
  baseKey: string | undefined,
): "f" | "m" | null {
  if (!baseKey) return null;
  if (baseKey.includes("female")) return "f";
  if (baseKey.includes("male")) return "m";
  return null;
}

export function resolveCompatibleArmsPart(
  propPart: Pick<GameNightCharacterPart, "requires_pose_key"> | undefined,
  parts: GameNightCharacterPart[],
  baseKey?: string,
): GameNightCharacterPart | null {
  if (!propPart?.requires_pose_key) return null;
  const gender = genderMarkerFromBaseKey(baseKey);
  if (!gender) return null;
  const wantedPoseKey = `${propPart.requires_pose_key}-${gender}`;
  return (
    parts.find(
      (p) => p.slot === "arms" && p.active && p.pose_key === wantedPoseKey,
    ) ?? null
  );
}

// Past de pose/prop-override toe op een reeds opgebouwde laag-set: als er
// een `props`-laag actief is die een `pose_key` vereist, wordt de
// bestaande `arms`-laag (indien aanwezig) vervangen door de bijpassende
// arm/hand-laag — de speler bedient in de UI dus effectief nog maar één
// keuze voor "voorwerp + houding" samen. Geen match gevonden (asset nog
// needs_asset_revision of ontbrekende pose_key) → arms-laag blijft
// ongewijzigd, nooit een crash of lege gok.
function applyPoseOverride(
  layers: ResolvedCharacterLayer[],
  allParts: GameNightCharacterPart[],
  bodyShape: GameNightBodyShape,
): ResolvedCharacterLayer[] {
  const propsLayer = layers.find((l) => l.slot === "props");
  if (!propsLayer) return layers;
  const propPart = allParts.find((p) => p.id === propsLayer.partId);
  const baseLayer = layers.find((l) => l.slot === "base");
  const armsPart = resolveCompatibleArmsPart(
    propPart,
    allParts,
    baseLayer?.key,
  );
  if (!armsPart) return layers;

  const withoutArms = layers.filter((l) => l.slot !== "arms");
  const armsLayer: ResolvedCharacterLayer = {
    slot: "arms",
    partId: armsPart.id,
    key: armsPart.key,
    assetPath: resolveBodyShapeAssetPath(armsPart, bodyShape),
    layerOrder: armsPart.layer_order,
  };
  return [...withoutArms, armsLayer].sort(
    (a, b) => a.layerOrder - b.layerOrder,
  );
}

// ── Groeperen/lookups (pure, geen Supabase) ──────────────────────────────

export function groupPartsBySlot(
  parts: GameNightCharacterPart[],
): Map<GameNightCharacterSlot, GameNightCharacterPart[]> {
  const map = new Map<GameNightCharacterSlot, GameNightCharacterPart[]>();
  for (const part of parts) {
    const arr = map.get(part.slot);
    if (arr) arr.push(part);
    else map.set(part.slot, [part]);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.sort_order - b.sort_order);
  }
  return map;
}

// Sectie 7: starter-onderdelen zijn impliciet unlocked voor IEDERE speler
// (geen backfill-rij per speler nodig, zie de migratie-toelichting) —
// "actief" hoort hier ook bij, een gedeactiveerd starter-item is niet meer
// aan te trekken door wie dan ook.
export function getStarterParts(
  parts: GameNightCharacterPart[],
): GameNightCharacterPart[] {
  return parts.filter((p) => p.is_starter && p.active);
}

export function isPartUnlocked(
  part: GameNightCharacterPart,
  unlocks: GameNightPlayerCharacterUnlock[],
): boolean {
  if (part.is_starter) return true;
  return unlocks.some((u) => u.part_id === part.id);
}

// Sectie 12 (E/F/G/I): dezelfde 4 controles als de equip-RPC, ÉÉN keer als
// pure functie — de RPC is de daadwerkelijke beveiligingsgrens (nooit op
// deze frontend-kopie vertrouwen voor autorisatie), maar een UI die vooraf
// wil weten "mag dit getoond worden als aanzetbaar" gebruikt exact dezelfde
// regels, dus nooit een UI die iets als "aanzetbaar" toont wat de RPC
// vervolgens alsnog weigert.
export function canEquipPart(
  part: GameNightCharacterPart | undefined,
  slot: GameNightCharacterSlot,
  unlocks: GameNightPlayerCharacterUnlock[],
): boolean {
  if (!part) return false;
  if (!part.active) return false;
  if (part.slot !== slot) return false;
  return isPartUnlocked(part, unlocks);
}

export type CharacterPartTileStatus = "equipped" | "unlocked" | "locked";

// V2.9C (sectie 6/10/30-C) — de ENE plek die bepaalt of een tegel in de
// Creator getoond wordt als equipped/unlocked/locked, gebruikt door
// GameNightCharacterCreator.tsx zodat de UI nooit zelf opnieuw
// canEquipPart/gelijkheids-logica hoeft te combineren.
export function derivePartTileStatus(
  part: GameNightCharacterPart,
  slot: GameNightCharacterSlot,
  draftPartId: string | null,
  unlocks: GameNightPlayerCharacterUnlock[],
): CharacterPartTileStatus {
  if (draftPartId === part.id) return "equipped";
  return canEquipPart(part, slot, unlocks) ? "unlocked" : "locked";
}

// ── Persoonlijke face-layer (selfie/crop-flow) ───────────────────────────
//
// Een speler's eigen gezichtsfoto (game_night_players.face_asset_path) is
// GEEN catalogus-part — het is per-speler fotodata, geen selecteerbaar
// item in game_night_character_parts. Toch wordt 'm hier, als synthetische
// ResolvedCharacterLayer, in DEZELFDE bestaande stapel geïnjecteerd (zie
// resolvePlayerCharacter/resolveDraftLayers hieronder) zodat CharacterVisual
// 'm zonder een tweede renderer of nieuwe prop kan tonen — precies "onderdeel
// van dezelfde bestaande character-compositie". layer_order (40) matcht de
// positie van de oude "face"-slot: boven body/clothing (20/25), onder
// hair/glasses/headwear (50/55/60) — zie PERSONAL_FACE_LAYER_ORDER in
// gameNightFaceCanvas.ts voor de volledige laagvolgorde-motivatie.
export function personalFaceLayer(
  player: Pick<GameNightPlayer, "face_asset_path">,
): ResolvedCharacterLayer | null {
  if (!player.face_asset_path) return null;
  return {
    slot: "face",
    partId: "personal-face",
    key: "personal-face",
    assetPath: player.face_asset_path,
    layerOrder: PERSONAL_FACE_LAYER_ORDER,
  };
}

// ── Character-resolutie (sectie 8/9/10) ──────────────────────────────────
//
// Prioriteit: modulaire equipment (als er minstens 1 geldige laag over-
// blijft na filtering) > legacy character_id > "empty" (initiaal-fallback,
// zie CharacterVisual.tsx). Nooit een mengvorm — zodra een speler één
// modulaire laag draagt, wordt character_id genegeerd voor de weergave
// (blijft wel gewoon in de database staan, sectie 8: niet destructief).
//
// Defensief tegen corrupte/verwijderde parts (sectie 20-D): een
// equipment-rij die naar een niet(meer)-bestaand of inactief part wijst
// wordt stilzwijgend overgeslagen, nooit een crash of gok. Ook tegen een
// (in theorie door de PK onmogelijke, maar bij samengevoegde/verouderde
// caches denkbare) dubbele rij per slot: een Map per slot dedupliceert
// altijd naar precies één laag (sectie 20-H).
export function resolvePlayerCharacter(
  player: GameNightPlayer,
  equipment: GameNightPlayerCharacterEquipment[],
  partsById: Map<string, GameNightCharacterPart>,
): ResolvedCharacter {
  const ownEquipment = equipment.filter((e) => e.player_id === player.id);
  const bodyShape = resolveBodyShape(player);

  const bySlot = new Map<GameNightCharacterSlot, ResolvedCharacterLayer>();
  for (const row of ownEquipment) {
    const part = partsById.get(row.part_id);
    if (!part || !part.active) continue;
    bySlot.set(row.slot, {
      slot: row.slot,
      partId: part.id,
      key: part.key,
      assetPath: resolveBodyShapeAssetPath(part, bodyShape),
      layerOrder: part.layer_order,
    });
  }
  const faceLayer = personalFaceLayer(player);
  // Vervangt bewust een eventuele catalogus-"face"-laag i.p.v. ernaast te
  // renderen: twee volledige 512x512-gezichtslagen (een catalogus-face-part
  // én de eigen foto) tegelijk zou de twee gewoon over elkaar stapelen,
  // wat nooit het gewenste resultaat is zodra een speler zijn eigen foto
  // heeft ingesteld.
  if (faceLayer) bySlot.set("face", faceLayer);
  const combinedLayers = [...bySlot.values()];
  if (combinedLayers.length > 0) {
    const layers = applyPoseOverride(
      combinedLayers.sort((a, b) => a.layerOrder - b.layerOrder),
      [...partsById.values()],
      bodyShape,
    );
    return { mode: "modular", layers };
  }

  if (player.character_id) {
    return { mode: "legacy", characterId: player.character_id };
  }

  return { mode: "empty" };
}

// Vertaalt een ResolvedCharacter naar de props die CharacterVisual.tsx
// verwacht (sectie 18: "GEEN tweede character-preview renderer bouwen") —
// zowel GameNightCharacter.tsx als andere directe CharacterVisual-callers
// (PartyPlayerCard, de Creator-preview) gebruiken deze ENE afleiding, geen
// losse kopieën van dezelfde mode-if/else.
export function characterVisualPropsFor(
  resolved: ResolvedCharacter | undefined,
): {
  characterId: string | null;
  layers: ResolvedCharacterLayer[] | undefined;
} {
  if (!resolved) return { characterId: null, layers: undefined };
  if (resolved.mode === "modular") {
    return { characterId: null, layers: resolved.layers };
  }
  if (resolved.mode === "legacy") {
    return { characterId: resolved.characterId, layers: undefined };
  }
  return { characterId: null, layers: undefined };
}

// ── Character Creator — draft/saved-model (V2.9C sectie 5) ──────────────
//
// De Creator werkt met een simpel, volledig-gevuld "slot -> gekozen part-id
// (of null)"-record voor zowel de opgeslagen als de nog-niet-opgeslagen
// staat — geen aparte ResolvedCharacterLayer-structuur nodig zolang er nog
// niets is opgeslagen, dat zou de UI dwingen twee keer met partsById-
// lookups te jongleren voor hetzelfde doel.
export type CharacterSlotMap = Record<GameNightCharacterSlot, string | null>;

export function equipmentToSlotMap(
  equipment: GameNightPlayerCharacterEquipment[],
): CharacterSlotMap {
  const map = Object.fromEntries(
    CHARACTER_SLOTS.map((slot) => [slot, null]),
  ) as CharacterSlotMap;
  for (const row of equipment) {
    map[row.slot] = row.part_id;
  }
  return map;
}

export type CharacterSlotChange =
  | { slot: GameNightCharacterSlot; action: "equip"; partId: string }
  | { slot: GameNightCharacterSlot; action: "unequip" };

// Vergelijkt saved vs. draft en levert UITSLUITEND de gewijzigde slots —
// de Creator voert bij "Opslaan" alleen deze rijen daadwerkelijk uit
// (sectie 5: "voer alleen gewijzigde slots uit"), nooit alle 8 slots
// blind opnieuw.
export function diffCharacterSlots(
  saved: CharacterSlotMap,
  draft: CharacterSlotMap,
): CharacterSlotChange[] {
  const changes: CharacterSlotChange[] = [];
  for (const slot of CHARACTER_SLOTS) {
    const savedPartId = saved[slot] ?? null;
    const draftPartId = draft[slot] ?? null;
    if (savedPartId === draftPartId) continue;
    if (draftPartId === null) {
      changes.push({ slot, action: "unequip" });
    } else {
      changes.push({ slot, action: "equip", partId: draftPartId });
    }
  }
  return changes;
}

export function hasUnsavedCharacterChanges(
  saved: CharacterSlotMap,
  draft: CharacterSlotMap,
): boolean {
  return diffCharacterSlots(saved, draft).length > 0;
}

// Live preview-lagen uit een DRAFT (nog niet opgeslagen) selectie — zelfde
// filtering/sortering als resolvePlayerCharacter's modulaire pad, maar
// zonder de legacy/"empty"-afweging (de Creator toont zijn eigen expliciete
// legacy-fallback rond de preview, zie sectie 13, niet in deze functie).
export function resolveDraftLayers(
  draft: CharacterSlotMap,
  partsById: Map<string, GameNightCharacterPart>,
  bodyShape: GameNightBodyShape = DEFAULT_BODY_SHAPE,
  // Optioneel (sectie 10 face-layer-opdracht): laat de Creator's eigen
  // live-preview ook de speler's ingestelde face-foto tonen, zonder de
  // draft/slot-selectiestaat zelf te hoeven kennen van iets dat geen
  // catalogus-part is. Vervangt, net als in resolvePlayerCharacter, een
  // eventueel gekozen catalogus-"face"-part.
  facePhotoUrl: string | null = null,
): ResolvedCharacterLayer[] {
  const layers: ResolvedCharacterLayer[] = [];
  for (const slot of CHARACTER_SLOTS) {
    if (slot === "face" && facePhotoUrl) continue;
    const partId = draft[slot];
    if (!partId) continue;
    const part = partsById.get(partId);
    if (!part || !part.active) continue;
    layers.push({
      slot,
      partId: part.id,
      key: part.key,
      assetPath: resolveBodyShapeAssetPath(part, bodyShape),
      layerOrder: part.layer_order,
    });
  }
  if (facePhotoUrl) {
    layers.push({
      slot: "face",
      partId: "personal-face",
      key: "personal-face",
      assetPath: facePhotoUrl,
      layerOrder: PERSONAL_FACE_LAYER_ORDER,
    });
  }
  return applyPoseOverride(
    layers.sort((a, b) => a.layerOrder - b.layerOrder),
    [...partsById.values()],
    bodyShape,
  );
}

// V2.9D (sectie 16/25-F) — pure tegenhanger van CharacterVisual.tsx's
// per-laag onError-filtering: welke lagen blijven zichtbaar nadat een
// (mogelijk lege) set asset-keys is mislukt te laden. Losstaand testbaar
// zonder React te hoeven mounten — CharacterVisual roept dit rechtstreeks
// aan zodat er maar één plek is die "welke lagen tonen we nog" bepaalt.
export function resolveVisibleLayers(
  layers: ResolvedCharacterLayer[],
  failedKeys: ReadonlySet<string>,
): ResolvedCharacterLayer[] {
  return layers.filter((l) => !failedKeys.has(l.key));
}

// Eerste (laagste sort_order) starter-part in een slot — uitsluitend
// gebruikt om de Creator een VOORGESTELD, nog niet opgeslagen draft-default
// te geven voor de verplichte 'base'-slot bij een speler die nog nooit iets
// modulairs heeft opgeslagen (sectie 9: "kies niet stil client-side... en
// schrijf die zonder toestemming" — dit vult alleen de DRAFT, nooit de
// database, pas een expliciete "Opslaan" doet dat).
export function pickDefaultStarterPart(
  parts: GameNightCharacterPart[],
  slot: GameNightCharacterSlot,
): GameNightCharacterPart | null {
  const starters = getStarterParts(parts)
    .filter((p) => p.slot === slot)
    .sort((a, b) => a.sort_order - b.sort_order);
  return starters[0] ?? null;
}

// Sectie 9/30-D: de daadwerkelijke "saved -> draft"-initialisatie, als één
// pure, testbare functie — gebruikt zowel bij het eerste openen van de
// Creator als na een (partiële) save-refetch, zodat beide paden exact
// dezelfde regel volgen (nooit twee net-iets-andere implementaties).
export function buildInitialDraft(
  equipment: GameNightPlayerCharacterEquipment[],
  parts: GameNightCharacterPart[],
): CharacterSlotMap {
  const map = equipmentToSlotMap(equipment);
  if (!map.base) {
    const defaultBase = pickDefaultStarterPart(parts, "base");
    if (defaultBase) map.base = defaultBase.id;
  }
  return map;
}
