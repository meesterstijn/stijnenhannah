import { useState } from "react";
import type { GameNightPlayer } from "@/lib/supabase";
import { getPlayerInitial } from "@/features/game-night/lib/playerIdentity";
import { resolveCharacterVisualSource } from "@/features/game-night/lib/characterPresets";
import {
  resolveVisibleLayers,
  type ResolvedCharacterLayer,
} from "@/features/game-night/lib/gameNightCharacter";

// Game Night V2.9/V2.9B (sectie 1/7/9/10/15/17) — de "base art"-laag:
// uitsluitend verantwoordelijk voor WAT er in het character-vlak
// verschijnt, nooit voor de omlijsting/ring/naam/celebratie eromheen (dat
// blijft GameNightCharacter.tsx — dezelfde bounds).
//
// V2.9B voegt `layers` toe (modulaire Character Creator, sectie 10) als
// EXTRA, optionele prop — additief, backwards-compatible. Wanneer `layers`
// gevuld is (al gesorteerd op layerOrder door resolvePlayerCharacter, zie
// gameNightCharacter.ts — dit component sorteert zelf niet nogmaals, ÉÉN
// bron van waarheid) worden ze gestapeld gerenderd: elke laag exact
// inset:0 binnen dezelfde vaste container, object-fit:contain,
// pointer-events:none, geen layout shift. Zonder `layers` (of characterId)
// valt dit component terug op het bestaande single-asset/icoon/initiaal-pad.
//
// V2.9D (sectie 16/25-F): als ÉÉN laag mist, verdwijnt uitsluitend die laag
// (de andere blijven staan — een speler met alleen een ontbrekende
// accessory-asset toont nog gewoon zijn base/outfit/hair). Maar als ALLE
// lagen missen (vandaag de realiteit: er bestaat nog geen enkel fysiek
// asset-bestand, zie public/game-night/characters/parts/README.md) mag de
// preview nooit een lege cirkel worden — dat oogt net zo "broken" als een
// kapot-plaatje-icoon. In dat geval valt het component terug op dezelfde
// initiaal-fallback als het legacy/lege pad hieronder.
export function CharacterVisual({
  player,
  characterId,
  layers,
  loading = "lazy",
}: {
  player: GameNightPlayer;
  characterId?: string | null;
  layers?: ResolvedCharacterLayer[];
  loading?: "eager" | "lazy";
}) {
  const [failedLayerKeys, setFailedLayerKeys] = useState<Set<string>>(
    new Set(),
  );
  const [failedFor, setFailedFor] = useState<string | null>(null);

  if (layers && layers.length > 0) {
    const visible = resolveVisibleLayers(layers, failedLayerKeys);
    if (visible.length > 0) {
      return (
        <span className="gnv2-character-layers">
          {visible.map((layer) => (
            <img
              key={layer.key}
              src={layer.assetPath}
              alt=""
              loading={loading}
              decoding="async"
              className="gnv2-character-layer"
              // Eén mislukte laag (bv. een ontbrekende accessory-asset) mag
              // nooit de andere lagen wegtrekken — elke laag heeft zijn
              // eigen fout-state en verdwijnt uitsluitend zelf.
              onError={() =>
                setFailedLayerKeys((prev) => new Set(prev).add(layer.key))
              }
            />
          ))}
        </span>
      );
    }
    // Alle lagen zijn (nog) niet beschikbaar -> initiaal-fallback,
    // hieronder gedeeld met het legacy/lege pad.
  }

  const source = resolveCharacterVisualSource(
    characterId,
    !!characterId && failedFor === characterId,
  );

  if (source.mode === "image") {
    return (
      <img
        key={source.assetPath}
        src={source.assetPath}
        alt=""
        loading={loading}
        decoding="async"
        className="gnv2-character-visual-img"
        onError={() => setFailedFor(characterId ?? null)}
      />
    );
  }

  if (source.mode === "icon") {
    const Icon = source.icon;
    return (
      <Icon className="gnv2-character-icon" aria-hidden strokeWidth={1.8} />
    );
  }

  return (
    <span className="gnv2-character-initial">{getPlayerInitial(player)}</span>
  );
}
