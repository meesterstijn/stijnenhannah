import { useState } from "react";
import { Plus, Undo2 } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import {
  useAwardMarioKartPoints,
  useMarioKartPointEvents,
  useUndoLastMarioKartPointEvent,
} from "@/features/game-night/hooks/useMarioKartPoints";
import { PlayerLink } from "@/features/game-night/components/PlayerLink";
import {
  characterVisualPropsFor,
  type ResolvedCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

type Row = { player: GameNightPlayer; points: number };

// "1st"/"2nd"/"3rd"/"4th"... — Engelse ordinale, bewust dezelfde conventie
// als de racefinish-stijl die dit klassement navolgt (zie .gnv2-mk-rank in
// styles.css), niet de Nederlandse "1e/2e".
function ordinalSuffix(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (rank % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

// Bewust op module-niveau, NIET als binnenste functie in
// MarioKartLeaderboard: een component die bij elke render van zijn ouder
// opnieuw als functie wordt aangemaakt krijgt daardoor een nieuwe identity,
// waardoor React 'm bij elke toetsaanslag (die immers de drafts-state en
// dus een re-render triggert) volledig unmount/remount i.p.v. alleen de
// props bij te werken — de <input> verloor daardoor telkens zijn focus,
// vandaar de bug "stopt na 1 cijfer". Met een stabiele component buiten de
// ouder + expliciete props (i.p.v. closures over drafts/setDrafts) blijft
// hetzelfde DOM-element gewoon staan tussen renders.
function ScoreControl({
  player,
  draft,
  onDraftChange,
  onSubmit,
  pending,
}: {
  player: GameNightPlayer;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <div className="gnv2-mk-score">
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        className="gnv2-mk-score-input"
        aria-label={`Punten voor ${player.name}`}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className="gnv2-mk-score-submit"
        aria-label={`Punten geven aan ${player.name}`}
        title="Punten geven"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function UndoButton({
  onUndo,
  disabled,
  pending,
}: {
  onUndo: () => void;
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onUndo}
      disabled={disabled || pending}
      className="gnv2-mk-undo-btn"
      aria-label="Laatste puntenwijziging ongedaan maken"
      title="Laatste puntenwijziging ongedaan maken"
    >
      <Undo2 className="h-3.5 w-3.5" />
      Laatste ongedaan maken
    </button>
  );
}

// Mario Kart is het enige spel met een eigen puntenklassement i.p.v. het
// generieke rondes-/sessieklassement (zie GameNightGameDetail, dat dit
// component alleen rendert voor game.slug === "mario-kart"): de owner kent
// na elke race handmatig een getal toe per speler, hoogste totaal staat
// boven, en het klassement begint vanzelf weer bij nul zodra er een nieuwe
// Game Night start (nieuwe game_night_session_id, dus nog geen rijen). De
// punten zelf zijn een append-only event-log (zie useMarioKartPoints.ts) —
// dat is wat de "Laatste ongedaan maken"-knop hieronder mogelijk maakt: die
// markeert simpelweg de meest recente nog-actieve toekenning van de hele
// avond (welke speler dan ook) als ongedaan, en de klikbare puntentotalen
// zijn altijd de som van de niet-ongedaan-gemaakte delta's per speler.
//
// `characterFor`/`colorHex` zijn optioneel én bepalen meteen de hele
// opmaak: de Arena (waar de owner tijdens het spelen al deze data toch al
// heeft, zie GameNightV2Arena) geeft ze mee en krijgt dan de "grote,
// 2-koloms"-weergave hieronder — naam+character zo groot mogelijk, links
// de bovenste helft van het klassement, rechts de onderste helft (bv. 10
// spelers = 1-5 links/6-10 rechts, 8 spelers = 1-4/5-8). De speldetailpagina
// laat ze weg en krijgt de originele compacte, smalle enkele-kolomlijst
// zonder daarvoor zelf character-data te hoeven ophalen.
export function MarioKartLeaderboard({
  gameNightSessionId,
  players,
  characterFor,
  colorHex,
}: {
  gameNightSessionId: string;
  players: GameNightPlayer[];
  characterFor?: (player: GameNightPlayer) => ResolvedCharacter;
  colorHex?: (player: GameNightPlayer) => string | null;
}) {
  const { data: events = [] } = useMarioKartPointEvents(gameNightSessionId);
  const awardPoints = useAwardMarioKartPoints(gameNightSessionId);
  const undoLast = useUndoLastMarioKartPointEvent(gameNightSessionId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const activeEvents = events.filter((e) => e.undone_at == null);
  const pointsByPlayer = new Map<string, number>();
  for (const event of activeEvents) {
    pointsByPlayer.set(
      event.player_id,
      (pointsByPlayer.get(event.player_id) ?? 0) + event.delta,
    );
  }
  const canUndo = activeEvents.length > 0;

  const rows: Row[] = [...players]
    .map((player) => ({
      player,
      points: pointsByPlayer.get(player.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.points - a.points || a.player.name.localeCompare(b.player.name, "nl"),
    );

  function submit(playerId: string) {
    const raw = drafts[playerId];
    const delta = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(delta) || delta === 0) return;
    awardPoints.mutate(
      { playerId, delta },
      { onSuccess: () => setDrafts((d) => ({ ...d, [playerId]: "" })) },
    );
  }

  function scoreControlProps(row: Row) {
    return {
      player: row.player,
      draft: drafts[row.player.id] ?? "",
      onDraftChange: (value: string) =>
        setDrafts((d) => ({ ...d, [row.player.id]: value })),
      onSubmit: () => submit(row.player.id),
      pending: awardPoints.isPending,
    };
  }

  if (players.length === 0) {
    return (
      <div className="gnv2-panel-elevated px-5 py-4 text-center">
        <p className="gnv2-eyebrow mb-1.5">Klassement</p>
        <p className="gnv2-muted text-sm">
          Voeg spelers toe aan deze Game Night om punten bij te houden.
        </p>
      </div>
    );
  }

  // Grote 2-koloms-weergave (Arena, tijdens het spelen): rangnummers worden
  // vooraf in twee helften geknipt (niet via CSS multi-column, dat balanceert
  // op hoogte en zou de volgorde door elkaar husselen) — links altijd de
  // bovenste helft van het klassement, rechts de rest. Bij een oneven aantal
  // spelers krijgt links de ene extra rij (5/4 bij 9 spelers).
  if (characterFor) {
    const half = Math.ceil(rows.length / 2);
    const columns = [rows.slice(0, half), rows.slice(half)];

    return (
      <div className="gnv2-mk-columns">
        {columns.map((column, colIndex) =>
          column.length === 0 ? null : (
            <div key={colIndex} className="gnv2-mk-column">
              {column.map((row, i) => {
                const rank = colIndex === 0 ? i + 1 : half + i + 1;
                return (
                  <div key={row.player.id} className="gnv2-mk-row-large">
                    <span
                      className={`gnv2-mk-rank${rank === 1 ? " gnv2-mk-rank-first" : ""}`}
                      data-rank={rank}
                    >
                      {rank}
                      <span className="gnv2-mk-rank-suffix">
                        {ordinalSuffix(rank)}
                      </span>
                    </span>
                    <span
                      className="gnv2-mk-avatar"
                      style={{
                        ["--gnv2-ring" as string]:
                          colorHex?.(row.player) ??
                          "var(--gnv2-border-strong)",
                      }}
                    >
                      <span className="gnv2-party-character-art">
                        <CharacterVisual
                          player={row.player}
                          {...characterVisualPropsFor(
                            characterFor(row.player),
                          )}
                        />
                      </span>
                    </span>
                    <span className="gnv2-mk-name">{row.player.name}</span>
                    <span className="gnv2-mk-total">{row.points}</span>
                    <ScoreControl {...scoreControlProps(row)} />
                  </div>
                );
              })}
            </div>
          ),
        )}
      </div>
    );
  }

  return (
    <div className="gnv2-panel-elevated px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="gnv2-eyebrow">Klassement</p>
        <UndoButton
          onUndo={() => undoLast.mutate()}
          disabled={!canUndo}
          pending={undoLast.isPending}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <div
            key={row.player.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="gnv2-faint w-4 shrink-0 text-right">
                {i + 1}.
              </span>
              <PlayerLink player={row.player} />
            </span>
            <span className="gnv2-mk-total gnv2-mk-total-compact">
              {row.points}
            </span>
            <ScoreControl {...scoreControlProps(row)} />
          </div>
        ))}
      </div>
    </div>
  );
}
