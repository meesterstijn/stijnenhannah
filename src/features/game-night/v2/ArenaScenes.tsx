import { Flame, Info, Swords } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import type { ResolvedCharacter } from "@/features/game-night/lib/gameNightCharacter";
import type {
  HistorischSceneData,
  RecordSceneData,
  RivaliteitSceneData,
  VanavondSceneData,
} from "@/features/game-night/lib/gameNightArenaScenes";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";
import { characterVisualPropsFor } from "@/features/game-night/lib/gameNightCharacter";

// Game Night V2.10.5 (Arena Fase 1) — de vier AANVULLENDE scènes naast
// TAFEL (die blijft de bestaande ArenaPlayerLayout-render in
// GameNightV2Arena.tsx zelf). Hergebruikt bewust dezelfde grote,
// kaderloze character-presentatie als de Lobby (`.gnv2-party-character*`,
// zie styles.css) i.p.v. een nieuwe presentatiestijl te verzinnen —
// "characters zijn de show" geldt hier net zo goed als op het
// spelersscherm. Elke scène is puur presentatie: de DATA komt kant-en-klaar
// binnen vanuit gameNightArenaScenes.ts (resolveAvailableArenaScenes),
// geen eigen berekeningen hier.

function ScenePlayerCharacter({
  player,
  resolvedCharacter,
  colorHex,
  sizePx,
  caption,
}: {
  player: GameNightPlayer;
  resolvedCharacter: ResolvedCharacter | undefined;
  colorHex: string | null;
  sizePx: number;
  caption?: string;
}) {
  const visualProps = characterVisualPropsFor(resolvedCharacter);
  return (
    <div
      className="gnv2-party-character"
      style={{
        ["--gnv2-party-char-size" as string]: `${sizePx}px`,
        ["--gnv2-ring" as string]: colorHex ?? "var(--gnv2-border-strong)",
      }}
    >
      <span className="gnv2-party-character-art">
        <CharacterVisual
          player={player}
          characterId={visualProps.characterId}
          layers={visualProps.layers}
          loading="eager"
        />
      </span>
      <span className="gnv2-party-character-name">
        {getPlayerDisplayName(player)}
      </span>
      {caption && <span className="gnv2-arena-scene-caption">{caption}</span>}
    </div>
  );
}

export function ArenaSceneVanavond({
  data,
  colorHex,
  characterFor,
}: {
  data: VanavondSceneData;
  colorHex: (player: GameNightPlayer) => string | null;
  characterFor: (player: GameNightPlayer) => ResolvedCharacter;
}) {
  // Bewust maximaal 5 tonen (sectie "vanavond": sfeer, geen dashboard) —
  // bij meer spelers zou een volledige lijst de scène weer een
  // score-administratiepaneel maken.
  const top = data.standings.slice(0, 5);
  const size = top.length <= 3 ? 190 : 150;
  return (
    <div className="gnv2-arena-scene-content">
      <p className="gnv2-arena-scene-eyebrow">Vanavond</p>
      <div className="gnv2-arena-scene-row">
        {top.map(({ player, wins }) => (
          <ScenePlayerCharacter
            key={player.id}
            player={player}
            resolvedCharacter={characterFor(player)}
            colorHex={colorHex(player)}
            sizePx={size}
            caption={`${wins} ${wins === 1 ? "WIN" : "WINS"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function ArenaSceneRivaliteit({
  data,
  colorHex,
  characterFor,
}: {
  data: RivaliteitSceneData;
  colorHex: (player: GameNightPlayer) => string | null;
  characterFor: (player: GameNightPlayer) => ResolvedCharacter;
}) {
  return (
    <div className="gnv2-arena-scene-content">
      <p className="gnv2-arena-scene-eyebrow">
        <Swords className="h-4 w-4" aria-hidden /> Rivaliteit
      </p>
      <div className="gnv2-arena-scene-row gnv2-arena-scene-vs">
        <ScenePlayerCharacter
          player={data.playerA}
          resolvedCharacter={characterFor(data.playerA)}
          colorHex={colorHex(data.playerA)}
          sizePx={220}
        />
        <div className="gnv2-arena-scene-vs-score">
          <span>{data.winsA}</span>
          <span className="gnv2-arena-scene-vs-dash">—</span>
          <span>{data.winsB}</span>
        </div>
        <ScenePlayerCharacter
          player={data.playerB}
          resolvedCharacter={characterFor(data.playerB)}
          colorHex={colorHex(data.playerB)}
          sizePx={220}
        />
      </div>
      <p className="gnv2-arena-scene-headline">{data.headline}</p>
    </div>
  );
}

export function ArenaSceneHistorisch({
  data,
  colorHex,
  characterFor,
}: {
  data: HistorischSceneData;
  colorHex: (player: GameNightPlayer) => string | null;
  characterFor: (player: GameNightPlayer) => ResolvedCharacter;
}) {
  return (
    <div className="gnv2-arena-scene-content">
      <p className="gnv2-arena-scene-eyebrow">
        <Info className="h-4 w-4" aria-hidden /> Historisch feitje
      </p>
      <ScenePlayerCharacter
        player={data.player}
        resolvedCharacter={characterFor(data.player)}
        colorHex={colorHex(data.player)}
        sizePx={230}
      />
      <p className="gnv2-arena-scene-headline">
        <strong>{getPlayerDisplayName(data.player)}</strong> {data.sentence}
      </p>
    </div>
  );
}

export function ArenaSceneRecord({
  data,
  colorHex,
  characterFor,
}: {
  data: RecordSceneData;
  colorHex: (player: GameNightPlayer) => string | null;
  characterFor: (player: GameNightPlayer) => ResolvedCharacter;
}) {
  return (
    <div className="gnv2-arena-scene-content">
      <p className="gnv2-arena-scene-eyebrow">
        <Flame className="h-4 w-4" aria-hidden /> Record
      </p>
      <ScenePlayerCharacter
        player={data.player}
        resolvedCharacter={characterFor(data.player)}
        colorHex={colorHex(data.player)}
        sizePx={230}
        caption={`${data.streak} op rij`}
      />
      <p className="gnv2-arena-scene-headline">
        <strong>{getPlayerDisplayName(data.player)}</strong> heeft de langste
        winstreak: {data.streak} overwinningen op rij.
      </p>
    </div>
  );
}
