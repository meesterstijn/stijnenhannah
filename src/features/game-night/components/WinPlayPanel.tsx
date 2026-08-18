import { useState } from "react";
import { Camera, Flag, Images, MoreHorizontal, Trophy } from "lucide-react";
import type { GameNightPlayer, GameNightWinEvent } from "@/lib/supabase";
import {
  useGameSessionWinEvents,
  useRecordWin,
  useUndoWinEvent,
} from "@/features/game-night/hooks/useGameNightWinEvents";

// Game Night V2.2 — de universele actieve-speelinterface voor
// win_source='win_events'-sessies (sectie 6-11). Bewust een volledig nieuw,
// eigen bestand i.p.v. RoundPlayPanel uitbreiden: de twee interactiemodellen
// (rondes kiezen vs. simpelweg WIN tikken) delen weinig meer dan de
// omliggende "Stand opslaan"/"Spel afsluiten"-rij, en RoundPlayPanel blijft
// ongewijzigd nodig voor elke legacy-sessie (sectie 16). MoreMenu/
// SecondaryRow hieronder zijn daarom een bewuste, kleine duplicatie — zelfde
// precedent als FeltWinnerGrid destijds naast WinnerPickerGrid.
//
// Géén "Wie wint deze ronde?", "RONDE N" of vergelijkbare uitleg (sectie 7):
// spelernaam/nickname aantikken = WIN, dat moet zichzelf uitleggen.

function MoreMenu({
  checkpointCount,
  onViewCheckpoints,
  onFinishSession,
}: {
  checkpointCount: number;
  onViewCheckpoints: () => void;
  onFinishSession: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Meer opties"
        className="gn-round-icon-btn"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="gn-sheet-backdrop"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="gn-sheet-card flex flex-col gap-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            {checkpointCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onViewCheckpoints();
                }}
                className="gn-plaque-action flex min-h-[52px] w-full items-center justify-center gap-2 px-6"
              >
                <Images
                  className="h-4 w-4"
                  style={{ color: "var(--gn-brass)" }}
                />
                <span className="gn-display text-sm font-semibold tracking-wide">
                  Spelstanden bekijken · {checkpointCount}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onFinishSession();
              }}
              className="gn-plaque-action flex min-h-[52px] w-full items-center justify-center gap-2 px-6"
            >
              <Flag className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
              <span className="gn-display text-sm font-semibold tracking-wide">
                Spel afsluiten
              </span>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SecondaryRow({
  onSaveCheckpoint,
  checkpointCount,
  onViewCheckpoints,
  onFinishSession,
}: {
  onSaveCheckpoint: () => void;
  checkpointCount: number;
  onViewCheckpoints: () => void;
  onFinishSession: () => void;
}) {
  return (
    <div className="flex w-full max-w-xs items-center gap-2.5">
      <button
        type="button"
        onClick={onSaveCheckpoint}
        className="gn-plaque-action flex min-h-[52px] flex-1 items-center justify-center gap-1.5 px-3"
      >
        <Camera className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
        <span className="gn-display text-xs font-semibold tracking-wide">
          Stand opslaan
        </span>
      </button>
      <MoreMenu
        checkpointCount={checkpointCount}
        onViewCheckpoints={onViewCheckpoints}
        onFinishSession={onFinishSession}
      />
    </div>
  );
}

// Eén grote, aantikbare spelerkaart. Naam (nickname > name, sectie 7) +
// live actieve-WIN-telling (undone_at is null, sectie 8) + een klein
// "+1"-opflits-momentje na de eigen tik (sectie 9, CSS-animatie in
// styles.css — respecteert prefers-reduced-motion daar zelf al). ≥64px
// (sectie 26), geen hover-afhankelijk gedrag, drukfeedback via de
// bestaande .gn-plaque-action-stijl.
function WinCard({
  player,
  wins,
  onTap,
  disabled,
  flashEventId,
}: {
  player: GameNightPlayer;
  wins: number;
  onTap: () => void;
  disabled: boolean;
  flashEventId: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className="gn-plaque-action relative flex min-h-[64px] w-full flex-col items-center justify-center gap-0.5 px-3 py-2.5"
    >
      {flashEventId && (
        <span
          key={flashEventId}
          aria-hidden
          className="gn-win-flash gn-display pointer-events-none absolute -top-1 right-2 text-sm font-bold"
          style={{ color: "var(--gn-brass)" }}
        >
          +1
        </span>
      )}
      <span className="gn-display text-center text-base font-semibold leading-tight tracking-wide sm:text-lg">
        {player.nickname ?? player.name}
      </span>
      <span className="gn-muted flex items-center gap-1 text-xs">
        <Trophy className="h-3 w-3" style={{ color: "var(--gn-brass)" }} />
        {wins} WIN{wins === 1 ? "" : "s"}
      </span>
    </button>
  );
}

// Klein, rustig feedbackgebied (sectie 10) — géén dashboard: alleen het
// nieuwste actieve event krijgt een prominente Undo-knop (≥44px
// touch-target); eventuele 2e/3e actieve events staan er compact bij op
// één regel, zonder eigen Undo-knop. Geen timestamps, geen volledige
// historie. Ongedaan gemaakte events verdwijnen simpelweg uit deze lijst
// (undone_at != null wordt hier al uitgefilterd).
function ActionFeed({
  events,
  participantsById,
  onUndo,
  undoPending,
}: {
  events: GameNightWinEvent[];
  participantsById: Map<string, GameNightPlayer>;
  onUndo: (eventId: string) => void;
  undoPending: boolean;
}) {
  const active = events.filter((e) => e.undone_at == null).slice(0, 3);
  if (active.length === 0) return null;

  const newest = active[0];
  const rest = active.slice(1);
  const newestName =
    participantsById.get(newest.player_id)?.nickname ??
    participantsById.get(newest.player_id)?.name ??
    "?";

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-0.5">
      <div className="flex w-full items-center justify-between gap-2">
        <span className="gn-muted text-xs">{newestName} +1</span>
        <button
          type="button"
          onClick={() => onUndo(newest.id)}
          disabled={undoPending}
          className="gn-faint flex min-h-[44px] shrink-0 items-center px-2 text-[11px] underline"
        >
          Ongedaan maken
        </button>
      </div>
      {rest.length > 0 && (
        <p className="gn-faint w-full truncate text-center text-[11px]">
          ook:{" "}
          {rest
            .map(
              (e) =>
                `${participantsById.get(e.player_id)?.nickname ?? participantsById.get(e.player_id)?.name ?? "?"} +1`,
            )
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

export function WinPlayPanel({
  gameSessionId,
  gameName,
  participants,
  onFinishSession,
  onSaveCheckpoint,
  checkpointCount,
  onViewCheckpoints,
}: {
  gameSessionId: string;
  gameName: string;
  participants: GameNightPlayer[];
  onFinishSession: () => void;
  onSaveCheckpoint: () => void;
  checkpointCount: number;
  onViewCheckpoints: () => void;
}) {
  const { data: events = [] } = useGameSessionWinEvents(gameSessionId);
  const recordWin = useRecordWin(gameSessionId);
  const undoWinEvent = useUndoWinEvent(gameSessionId);

  const [flash, setFlash] = useState<{
    playerId: string;
    eventId: string;
  } | null>(null);

  const participantsById = new Map(participants.map((p) => [p.id, p]));
  const activeWinsByPlayer = new Map<string, number>();
  for (const event of events) {
    if (event.undone_at != null) continue;
    activeWinsByPlayer.set(
      event.player_id,
      (activeWinsByPlayer.get(event.player_id) ?? 0) + 1,
    );
  }

  async function handleTapPlayer(playerId: string) {
    if (recordWin.isPending) return; // sectie 3: bescherming tegen één dubbel-verstuurd fysiek tik-event
    const event = await recordWin.mutateAsync(playerId);
    setFlash({ playerId, eventId: event.id });
  }

  function handleUndo(eventId: string) {
    if (undoWinEvent.isPending) return;
    undoWinEvent.mutate(eventId);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2">
      <p className="gn-eyebrow">{gameName}</p>

      <div className="grid w-full max-w-sm grid-cols-2 gap-2">
        {participants.map((player) => (
          <WinCard
            key={player.id}
            player={player}
            wins={activeWinsByPlayer.get(player.id) ?? 0}
            onTap={() => handleTapPlayer(player.id)}
            disabled={recordWin.isPending}
            flashEventId={flash?.playerId === player.id ? flash.eventId : null}
          />
        ))}
      </div>

      <ActionFeed
        events={events}
        participantsById={participantsById}
        onUndo={handleUndo}
        undoPending={undoWinEvent.isPending}
      />

      <SecondaryRow
        onSaveCheckpoint={onSaveCheckpoint}
        checkpointCount={checkpointCount}
        onViewCheckpoints={onViewCheckpoints}
        onFinishSession={onFinishSession}
      />
    </div>
  );
}
