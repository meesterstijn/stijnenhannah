import { useEffect, useState } from "react";
import type { GameNightPlayer } from "@/lib/supabase";
import { getPlayerInitial } from "@/features/game-night/lib/playerIdentity";
import { resolveCharacterVisualSource } from "@/features/game-night/lib/characterPresets";
import {
  resolveVisibleLayers,
  type ResolvedCharacterLayer,
} from "@/features/game-night/lib/gameNightCharacter";
import { useSignedFaceUrl } from "@/features/game-night/hooks/useSignedFaceUrl";

// De "personal-face"-laag (zie personalFaceLayer() in gameNightCharacter.ts)
// wijst naar een storage-PAD in de privé game-night-player-faces-bucket
// (20260918000000), geen direct bruikbare URL zoals elke andere,
// statische/publieke character-laag. Deze ene laag lost daarom eerst zelf
// een getekende URL op (useSignedFaceUrl) vóór 'm rendert — alle overige
// lagen gaan via de kortere, synchrone `else`-tak hieronder, ongewijzigd.
// Bewust een APART kind-component (i.p.v. een hook binnen de .map() zelf,
// wat de Rules of Hooks zou schenden): elke instantie hiervan is één eigen
// React-boomelement, dus zijn eigen useSignedFaceUrl()-call per laag is
// volledig legaal.
function CharacterLayerImage({
  layer,
  loading,
  onError,
}: {
  layer: ResolvedCharacterLayer;
  loading: "eager" | "lazy";
  onError: () => void;
}) {
  const isPersonalFace = layer.partId === "personal-face";
  const signedFace = useSignedFaceUrl(isPersonalFace ? layer.assetPath : null);

  // Fetchfout doorgeven aan dezelfde "deze laag mislukt permanent"-afhandeling
  // als een gewone <img onError> — geen apart foutpad nodig.
  useEffect(() => {
    if (isPersonalFace && signedFace.isError) onError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPersonalFace, signedFace.isError]);

  if (isPersonalFace) {
    // Nog geen getekende URL (of de fetch faalde net) -> deze laag toont
    // simpelweg (nog) niets, exact zoals elke andere ontbrekende laag —
    // nooit een kapot-plaatje-icoon.
    if (!signedFace.data) return null;
    return (
      <img
        key={layer.key}
        src={signedFace.data}
        alt=""
        loading={loading}
        decoding="async"
        className="gnv2-character-layer"
        onError={onError}
      />
    );
  }

  return (
    <img
      key={layer.key}
      src={layer.assetPath}
      alt=""
      loading={loading}
      decoding="async"
      className="gnv2-character-layer"
      onError={onError}
    />
  );
}

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
            <CharacterLayerImage
              key={layer.key}
              layer={layer}
              loading={loading}
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
