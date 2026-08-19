import { useAuth } from "@/contexts/AuthContext";
import type { GameNightPlayer } from "@/lib/supabase";
import {
  CHARACTER_STARTER_MANIFEST,
  starterManifestBySlot,
} from "@/features/game-night/lib/characterStarterManifest";
import {
  CHARACTER_SLOT_LABELS,
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
          Niet in de navigatie — uitsluitend voor het controleren van de 14
          starter-onderdelen. Een lege/lettertegel i.p.v. een afbeelding
          betekent dat de asset nog niet fysiek aanwezig is (verwacht zolang er
          geen echte art is aangeleverd) — CharacterVisual valt dan stilzwijgend
          terug op de initiaal, precies zoals in de Creator/Lobby/Arena.
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
