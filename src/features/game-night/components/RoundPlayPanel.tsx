import { useState } from "react";
import { Camera, Flag, Images, MoreHorizontal } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import {
  useCurrentRound,
  useLastEndedRound,
  useRoundWinner,
  useRoundTally,
  useRecordRoundWinner,
  useCorrectRoundResult,
  useEndRound,
  useStartNextRound,
} from "@/features/game-night/hooks/useGameNightRounds";

type Mode = "idle" | "correcting" | "confirm-finish";

// Compacte winnaarknoppen, specifiek voor het vilt (correctieronde, sectie
// 6): een nette 2-koloms grid van naam-only plaqueknoppen i.p.v. de
// grotere avatar-fiches van WinnerPickerGrid (die blijft ongewijzigd voor
// CompleteGameSessionPanel, waar wél ruimte is). ≥56px hoog, dezelfde
// messing/plaque-styling (.gn-plaque-action) als de rest van Game Night —
// bewust géén nieuwe visuele taal, alleen compacter.
function FeltWinnerGrid({
  players,
  onPick,
  disabled,
}: {
  players: GameNightPlayer[];
  onPick: (playerId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      {players.map((player) => (
        <button
          key={player.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(player.id)}
          className="gn-plaque-action flex min-h-[60px] w-full items-center justify-center px-2.5 py-2"
        >
          <span className="gn-display text-center text-sm font-semibold leading-tight tracking-wide sm:text-base">
            {player.name}
          </span>
        </button>
      ))}
    </div>
  );
}

// Opschoning actieve speelmodus (sectie 1-13 van de opdracht): tijdens het
// spelen zelf is er maar plek voor drie dingen — welk spel, welke ronde,
// wat nu registreren. Pauzeren is volledig uit deze flow verdwenen (sectie
// 1) — nieuwe spelsessies pauzeren dus nooit meer handmatig; de RPC/hook
// blijft intact voor eventuele al-gepauzeerde historische sessies (zie
// ActiveGameSessionPanel's paused-status-tak, ongewijzigd). "Stand
// opslaan" (camera) en de "•••"-knop vormen samen de enige permanente
// secundaire rij — "Spel afsluiten" (en, indien aanwezig, "Spelstanden
// bekijken") zitten daarachter i.p.v. als losse grote knoppen.
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

export function RoundPlayPanel({
  gameSessionId,
  participants,
  trackRoundResults,
  onFinishSession,
  onSaveCheckpoint,
  checkpointCount,
  onViewCheckpoints,
}: {
  gameSessionId: string;
  participants: GameNightPlayer[];
  trackRoundResults: boolean;
  onFinishSession: (openRoundId?: string) => void;
  onSaveCheckpoint: () => void;
  checkpointCount: number;
  onViewCheckpoints: () => void;
}) {
  const { data: currentRound } = useCurrentRound(gameSessionId);
  const { data: lastEndedRound } = useLastEndedRound(gameSessionId);
  const { data: lastRoundWinner } = useRoundWinner(
    trackRoundResults ? lastEndedRound?.id : undefined,
  );
  const { data: tally = [] } = useRoundTally(gameSessionId);
  const recordWinner = useRecordRoundWinner(gameSessionId);
  const correctResult = useCorrectRoundResult(gameSessionId);
  const endRound = useEndRound(gameSessionId);
  const startNextRound = useStartNextRound(gameSessionId);

  const [mode, setMode] = useState<Mode>("idle");

  const playerById = new Map(participants.map((p) => [p.id, p]));
  // Sectie 5: spelers met 0 overwinningen nemen geen ruimte in — een
  // fysiek scorebord toont ook niet iedereen op nul.
  const nonZeroTally = tally.filter((entry) => entry.wins > 0);

  async function handlePickWinner(playerId: string) {
    if (!currentRound || recordWinner.isPending) return;
    await recordWinner.mutateAsync({
      roundId: currentRound.id,
      winnerPlayerId: playerId,
    });
    setMode("idle");
  }

  async function handleEndRoundWithoutResult() {
    if (!currentRound || endRound.isPending) return;
    await endRound.mutateAsync(currentRound.id);
    setMode("idle");
  }

  async function handleCorrect(playerId: string) {
    if (!lastEndedRound || correctResult.isPending) return;
    await correctResult.mutateAsync({
      roundId: lastEndedRound.id,
      winnerPlayerId: playerId,
    });
    setMode("idle");
  }

  function handleTapFinishSession() {
    if (currentRound) {
      setMode("confirm-finish");
    } else {
      onFinishSession();
    }
  }

  // ── Tussenscherm: er ligt nog een onafgeronde ronde (sectie 9) ─────────
  if (mode === "confirm-finish") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
        <p className="gn-display text-lg font-semibold tracking-wide sm:text-xl">
          RONDE {currentRound?.round_number} IS NOG BEZIG
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="gn-plaque-action gn-plaque-action-primary flex min-h-[56px] w-full items-center justify-center px-6 py-3"
          >
            <span className="gn-display text-sm font-semibold tracking-wide">
              Ronde afronden
            </span>
          </button>
          <button
            type="button"
            onClick={() => currentRound && onFinishSession(currentRound.id)}
            className="gn-plaque-action flex min-h-[56px] w-full items-center justify-center px-6 py-3"
          >
            <span className="gn-display text-sm font-semibold tracking-wide">
              Spel stoppen zonder deze ronde
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Terug
          </button>
        </div>
      </div>
    );
  }

  // ── Laatste resultaat corrigeren (los van de live ronde, sectie 3) ──────
  if (mode === "correcting") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center gap-2">
        <p className="gn-display text-base font-semibold tracking-wide sm:text-lg">
          WIE WON RONDE {lastEndedRound?.round_number}?
        </p>
        <FeltWinnerGrid
          players={participants}
          onPick={handleCorrect}
          disabled={correctResult.isPending}
        />
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
        >
          Annuleren
        </button>
      </div>
    );
  }

  // ── Ronde actief (sectie 2/5) ────────────────────────────────────────────
  // Bij track_round_results=true verschijnen de winnaarknoppen meteen —
  // één tik = ronde afgerond + winnaar opgeslagen via de bestaande
  // useRecordRoundWinner-RPC, geen tussenliggende "Ronde afronden"-stap en
  // geen uitlegzin meer (de knoppen spreken voor zich). Zonder
  // resultaatregistratie (sectie 4) blijft de eenvoudige "Ronde afronden"-
  // knop, want er is dan niets om aan te tikken.
  if (currentRound) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2">
        <p className="gn-display text-2xl font-semibold tracking-wide sm:text-3xl">
          RONDE {currentRound.round_number}
        </p>

        {trackRoundResults ? (
          <FeltWinnerGrid
            players={participants}
            onPick={handlePickWinner}
            disabled={recordWinner.isPending}
          />
        ) : (
          <button
            type="button"
            onClick={handleEndRoundWithoutResult}
            disabled={endRound.isPending}
            className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center px-6 py-3.5"
          >
            <span className="gn-display text-lg font-semibold tracking-wide">
              Ronde afronden
            </span>
          </button>
        )}

        <SecondaryRow
          onSaveCheckpoint={onSaveCheckpoint}
          checkpointCount={checkpointCount}
          onViewCheckpoints={onViewCheckpoints}
          onFinishSession={handleTapFinishSession}
        />
      </div>
    );
  }

  // ── Tussen rondes ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2">
      <div className="text-center">
        <p className="gn-display text-2xl font-semibold tracking-wide sm:text-3xl">
          RONDE {lastEndedRound?.round_number}
        </p>
        {trackRoundResults && lastRoundWinner && (
          <p className="gn-muted mt-0.5 text-sm">
            {lastRoundWinner.playerName} won
          </p>
        )}
      </div>

      {trackRoundResults && nonZeroTally.length > 0 && (
        <div className="flex flex-col items-center gap-0.5">
          {nonZeroTally.map((entry) => (
            <p key={entry.playerId} className="gn-muted text-sm">
              {playerById.get(entry.playerId)?.name ?? "?"} · {entry.wins}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => startNextRound.mutate()}
        disabled={startNextRound.isPending}
        className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center px-6 py-3.5"
      >
        <span className="gn-display text-lg font-semibold tracking-wide">
          {startNextRound.isPending ? "Bezig..." : "Volgende ronde"}
        </span>
      </button>

      {trackRoundResults && lastEndedRound && (
        <button
          type="button"
          onClick={() => setMode("correcting")}
          className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
        >
          Resultaat aanpassen
        </button>
      )}

      <SecondaryRow
        onSaveCheckpoint={onSaveCheckpoint}
        checkpointCount={checkpointCount}
        onViewCheckpoints={onViewCheckpoints}
        onFinishSession={handleTapFinishSession}
      />
    </div>
  );
}
