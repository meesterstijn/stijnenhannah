import { useAuth } from "@/contexts/AuthContext";
import type { GameNightBodyShape, GameNightPlayer } from "@/lib/supabase";
import {
  CHARACTER_STARTER_MANIFEST,
  starterManifestBySlot,
} from "@/features/game-night/lib/characterStarterManifest";
import {
  CHARACTER_V2_MANIFEST,
  V2_NEEDS_ASSET_REVISION_SLOTS,
  v2ManifestBySlot,
  type CharacterV2ManifestEntry,
} from "@/features/game-night/lib/characterV2Manifest";
import {
  BODY_SHAPE_LABELS,
  CHARACTER_SLOT_LABELS,
  resolveBodyShapeAssetPath,
  type ResolvedCharacterLayer,
} from "@/features/game-night/lib/gameNightCharacter";
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

function v2EntryToLayer(
  entry: CharacterV2ManifestEntry,
  bodyShape: GameNightBodyShape = "medium",
): ResolvedCharacterLayer {
  return {
    slot: entry.slot,
    partId: entry.key,
    key: entry.key,
    assetPath: resolveBodyShapeAssetPath(entry, bodyShape),
    layerOrder: entry.layer_order,
  };
}

function v2ByKey(key: string): CharacterV2ManifestEntry {
  const entry = CHARACTER_V2_MANIFEST.find((e) => e.key === key);
  if (!entry) throw new Error(`Onbekende V2.9E-key in QA-grid: ${key}`);
  return entry;
}

// V2.9E — de drie female-body-shape-tegels (sectie "Debug/QA-extensie").
// Small/large zijn needs_asset_revision (active:false, geen bestaand
// bestand) — CharacterVisual verbergt die laag stilzwijgend, precies zoals
// bedoeld; deze grid maakt dat expliciet zichtbaar i.p.v. het te verbergen.
const BODY_SHAPE_QA_KEYS = [
  "base-female-small",
  "base-female-medium",
  "base-female-large",
] as const;

// Gecombineerd met kleding+bril+prop — alleen 'medium' heeft hier vandaag
// écht renderende lagen; small/large tonen bewust dezelfde combinatie zodat
// in één oogopslag zichtbaar is WAT er nog ontbreekt (geen basislaag), niet
// om een fout resultaat te verbergen.
const BODY_SHAPE_COMBO_EXTRA_KEYS = [
  "clothing-hoodie-purple-f",
  "glasses-round-gold",
  "arms-f-mug",
  "prop-mug",
] as const;

const V2_QA_COMBOS: { label: string; layers: ResolvedCharacterLayer[] }[] = [
  {
    label: "Man + ogen + mond + pet + mok (hand + prop gekoppeld)",
    layers: [
      v2EntryToLayer(v2ByKey("base-male-01")),
      v2EntryToLayer(v2ByKey("eyes-round-01")),
      v2EntryToLayer(v2ByKey("mouth-01")),
      v2EntryToLayer(v2ByKey("headwear-cap-white")),
      v2EntryToLayer(v2ByKey("clothing-henley-gray-m")),
      v2EntryToLayer(v2ByKey("arms-m-mug")),
      v2EntryToLayer(v2ByKey("prop-mug")),
    ],
  },
  {
    label:
      "Vrouw (gemiddeld) + hoodie + bril + kaarten (hand + prop gekoppeld)",
    layers: [
      v2EntryToLayer(v2ByKey("base-female-medium")),
      v2EntryToLayer(v2ByKey("eyes-almond-01"), "medium"),
      v2EntryToLayer(v2ByKey("mouth-03")),
      v2EntryToLayer(v2ByKey("glasses-round-gold")),
      v2EntryToLayer(v2ByKey("clothing-hoodie-purple-f"), "medium"),
      v2EntryToLayer(v2ByKey("arms-f-cards")),
      v2EntryToLayer(v2ByKey("prop-cards")),
    ],
  },
  {
    label: "Man + gitaar (hand + prop gekoppeld) + feesthoedje",
    layers: [
      v2EntryToLayer(v2ByKey("base-male-01")),
      v2EntryToLayer(v2ByKey("eyes-round-02")),
      v2EntryToLayer(v2ByKey("mouth-05")),
      v2EntryToLayer(v2ByKey("clothing-flannel-red-m")),
      v2EntryToLayer(v2ByKey("arms-m-guitar")),
      v2EntryToLayer(v2ByKey("prop-guitar")),
      v2EntryToLayer(v2ByKey("effect-party-hat")),
    ],
  },
  {
    label:
      "V2.9E-hersteltraject: man + haar + wenkbrauwen + volle baard (alpha-extractie)",
    layers: [
      v2EntryToLayer(v2ByKey("base-male-01")),
      v2EntryToLayer(v2ByKey("eyes-round-01")),
      v2EntryToLayer(v2ByKey("eyebrows-03")),
      v2EntryToLayer(v2ByKey("mouth-01")),
      v2EntryToLayer(v2ByKey("facialhair-beard-full-01")),
      v2EntryToLayer(v2ByKey("hair-short-04")),
    ],
  },
  {
    label:
      "V2.9E-hersteltraject: vrouw + lang haar + wenkbrauwen (alpha-extractie, zelfde haar-key als man)",
    layers: [
      v2EntryToLayer(v2ByKey("base-female-medium")),
      v2EntryToLayer(v2ByKey("eyes-almond-01"), "medium"),
      v2EntryToLayer(v2ByKey("eyebrows-08")),
      v2EntryToLayer(v2ByKey("mouth-02")),
      v2EntryToLayer(v2ByKey("hair-long-03")),
    ],
  },
];

// Drie combinaties uit de opdracht (sectie 17) — puur de bestaande
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

// Game Night V2.9D (sectie 17) — development-only QA-hulpmiddel, GEEN
// publieke Game Night-feature: nergens in de navigatie gelinkt, alleen
// bereikbaar via de directe URL, en owner-only (zelfde bewaking als de
// overige owner-tools in deze app). Toont de 14 starter-onderdelen
// individueel (label/slot/layer_order/asset aanwezig-of-fallback) plus een
// paar samengestelde combinaties — puur om straks de echte 14 bestanden in
// één oogopslag te kunnen controleren zodra ze op hun afgesproken paden
// staan, zonder daarvoor een Game Night-sessie te hoeven opzetten.
export default function CharacterAssetQaGrid() {
  const { isOwner } = useAuth();
  const bySlot = starterManifestBySlot();
  const v2BySlot = v2ManifestBySlot();

  if (!isOwner) {
    return (
      <GnV2Scene className="gnv2-creator-scene">
        <div className="gnv2-creator-empty">
          <p>Alleen de owner kan deze QA-pagina bekijken.</p>
        </div>
      </GnV2Scene>
    );
  }

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
          betekent dat de asset nog niet fysiek aanwezig is (verwacht zolang er
          geen echte art is aangeleverd, of expliciet needs_asset_revision) —
          CharacterVisual valt dan stilzwijgend terug op de initiaal, precies
          zoals in de Creator/Lobby/Arena.
        </p>
      </div>

      <div className="gn-panel-elevated px-5 py-4">
        <p className="gn-eyebrow mb-1">V2.9E — pixel-art (128×128)</p>
        <p className="gn-faint text-xs">
          Uitgesneden uit de aangeleverde spritesheet. Slots die hier NIET
          verschijnen (skintone, eyebrows, facial-hair) zijn volledig
          needs_asset_revision — zie het opleverrapport voor de per-sectie
          tally.
        </p>
      </div>

      {[...v2BySlot.entries()].map(([slot, entries]) => (
        <div key={`v2-${slot}`} className="gn-panel-elevated px-5 py-4">
          <p className="gn-eyebrow mb-3">
            {CHARACTER_SLOT_LABELS[slot]} · layer_order{" "}
            {entries[0]?.layer_order} · {entries.filter((e) => e.active).length}
            /{entries.length} actief
          </p>
          <div className="flex flex-wrap gap-4">
            {entries.map((item) => (
              <div key={item.key} className="w-24 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-black/20">
                  <CharacterVisual
                    player={QA_PLAYER}
                    layers={item.active ? [v2EntryToLayer(item)] : []}
                  />
                </div>
                <p className="mt-1 text-[11px] font-semibold">{item.label}</p>
                <p className="gn-faint text-[10px]">
                  {item.key}
                  {!item.active && " · needs_asset_revision"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="gn-panel-elevated px-5 py-4">
        <p className="gn-eyebrow mb-1">
          V2.9E — volledig needs_asset_revision (geen enkele rij geseed)
        </p>
        <ul className="gn-faint text-xs">
          {V2_NEEDS_ASSET_REVISION_SLOTS.map(({ slot, note }) => (
            <li key={slot}>
              {CHARACTER_SLOT_LABELS[slot]}: {note}
            </li>
          ))}
          <li>Huidskleur (geen slot in het 12-slot-model): 0/12 bruikbaar.</li>
        </ul>
      </div>

      <div>
        <p className="gn-eyebrow mb-3">
          V2.9E — samengestelde combinaties (incl. pose/prop-koppeling)
        </p>
        <div className="flex flex-wrap gap-6">
          {V2_QA_COMBOS.map((combo) => (
            <div key={combo.label} className="w-40 text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-black/20">
                <CharacterVisual player={QA_PLAYER} layers={combo.layers} />
              </div>
              <p className="mt-2 text-xs">{combo.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="gn-panel-elevated px-5 py-4">
        <p className="gn-eyebrow mb-1">
          V2.9E — Lichaamsbouw: klein / gemiddeld / groot
        </p>
        <p className="gn-faint mb-3 text-xs">
          Alleen "gemiddeld" heeft vandaag een echte basislaag; klein/groot zijn
          needs_asset_revision (leeg silhouet hieronder is verwacht, geen bug).
          Tweede rij: dezelfde 3 vormen gecombineerd met kleding + bril + mok —
          hoofd/gezicht blijven bewust pixel-identiek.
        </p>
        <div className="flex flex-wrap gap-6">
          {BODY_SHAPE_QA_KEYS.map((key) => {
            const item = v2ByKey(key);
            return (
              <div key={key} className="w-28 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-black/20">
                  <CharacterVisual
                    player={QA_PLAYER}
                    layers={item.active ? [v2EntryToLayer(item)] : []}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold">
                  {item.body_shape && BODY_SHAPE_LABELS[item.body_shape]}
                </p>
                {!item.active && (
                  <p className="gn-faint text-[10px]">needs_asset_revision</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-6">
          {BODY_SHAPE_QA_KEYS.map((key) => {
            const base = v2ByKey(key);
            const layers = base.active
              ? [
                  v2EntryToLayer(base),
                  ...BODY_SHAPE_COMBO_EXTRA_KEYS.map((k) =>
                    v2EntryToLayer(v2ByKey(k), base.body_shape ?? "medium"),
                  ),
                ]
              : [];
            return (
              <div key={`combo-${key}`} className="w-28 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-black/20">
                  <CharacterVisual player={QA_PLAYER} layers={layers} />
                </div>
                <p className="mt-2 text-xs font-semibold">
                  {base.body_shape && BODY_SHAPE_LABELS[base.body_shape]} +
                  kleding
                </p>
              </div>
            );
          })}
        </div>
      </div>

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
