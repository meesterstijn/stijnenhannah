import { useState } from "react";
import { Camera, Flag, Pause, Undo2 } from "lucide-react";
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
import { WinnerPickerGrid } from "@/features/game-night/components/WinnerPickerGrid";

type Mode = "idle" | "picking" | "correcting" | "confirm-finish";

// Handmatige rondeflow (ongewijzigd t.o.v. de vorige correctieronde): drie
// duidelijk gescheiden fases, allemaal afleidbaar uit de database —
// round-active (useCurrentRound), between-rounds (geen currentRound, wel
// useLastEndedRound), en de puur lokale "picking"-modus voor het kiezen van
// een winnaar (de ronde blijft in de database open tot dat moment, dus een
// refresh halverwege valt gewoon terug op round-active).
//
// Deze correctie: alle belangrijke acties zijn nu echte tablet-knoppen
// (≥48px, primair 56-64px) i.p.v. tekstlinkjes — Ronde afronden/Volgende
// ronde starten blijven primair, Stand opslaan/Pauzeer/Spel afronden/
// Laatste resultaat aanpassen zijn duidelijke secundaire plaques.
function UtilityRow({
  onSaveCheckpoint,
  onPause,
  pausePending,
}: {
  onSaveCheckpoint: () => void;
  onPause: () => void;
  pausePending: boolean;
}) {
  return (
    <div className="grid w-full max-w-xs grid-cols-2 gap-2.5">
      <button
        type="button"
        onClick={onSaveCheckpoint}
        className="gn-plaque-action flex min-h-[52px] w-full flex-row items-center justify-center gap-1.5 px-3 py-2"
      >
        <Camera className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
        <span className="gn-display text-xs font-semibold tracking-wide">
          Stand opslaan
        </span>
      </button>
      <button
        type="button"
        onClick={onPause}
        disabled={pausePending}
        className="gn-plaque-action flex min-h-[52px] w-full flex-row items-center justify-center gap-1.5 px-3 py-2"
      >
        <Pause className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
        <span className="gn-display text-xs font-semibold tracking-wide">
          Pauzeer
        </span>
      </button>
    </div>
  );
}

export function RoundPlayPanel({
  gameSessionId,
  participants,
  trackRoundResults,
  onFinishSession,
  onSaveCheckpoint,
  onPause,
  pausePending,
}: {
  gameSessionId: string;
  participants: GameNightPlayer[];
  trackRoundResults: boolean;
  onFinishSession: (openRoundId?: string) => void;
  onSaveCheckpoint: () => void;
  onPause: () => void;
  pausePending: boolean;
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

  // ── Tussenscherm: er ligt nog een onafgeronde ronde ─────────────────────
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
              Ronde eerst afronden
            </span>
          </button>
          <button
            type="button"
            onClick={() => currentRound && onFinishSession(currentRound.id)}
            className="gn-plaque-action flex min-h-[56px] w-full items-center justify-center px-6 py-3"
          >
            <span className="gn-display text-sm font-semibold tracking-wide">
              Onafgeronde ronde niet meetellen & spel stoppen
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  // ── Winnaar kiezen / laatste resultaat corrigeren ───────────────────────
  if (mode === "picking" || mode === "correcting") {
    const round = mode === "correcting" ? lastEndedRound : currentRound;
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center gap-3">
        <p className="gn-display text-lg font-semibold tracking-wide sm:text-xl">
          {mode === "correcting"
            ? `WIE WON RONDE ${round?.round_number}?`
            : "WIE WON DEZE RONDE?"}
        </p>
        <div className="gn-player-grid-scroll">
          <WinnerPickerGrid
            players={participants}
            onPick={mode === "correcting" ? handleCorrect : handlePickWinner}
            disabled={recordWinner.isPending || correctResult.isPending}
          />
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Annuleren
          </button>
          {mode === "picking" && (
            <button
              type="button"
              onClick={handleTapFinishSession}
              className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
            >
              Spel afronden
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Ronde actief ─────────────────────────────────────────────────────────
  if (currentRound) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2.5">
        <div className="text-center">
          <p className="gn-eyebrow">Bezig</p>
          <p className="gn-display text-2xl font-semibold tracking-wide sm:text-3xl">
            RONDE {currentRound.round_number}
          </p>
        </div>

        {trackRoundResults && tally.length > 0 && (
          <div className="flex flex-col items-center gap-0.5">
            {tally.map((entry) => (
              <p key={entry.playerId} className="gn-muted text-sm">
                {playerById.get(entry.playerId)?.name ?? "?"} — {entry.wins}
              </p>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            trackRoundResults
              ? setMode("picking")
              : handleEndRoundWithoutResult()
          }
          disabled={endRound.isPending}
          className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center px-6 py-3.5"
        >
          <span className="gn-display text-lg font-semibold tracking-wide">
            Ronde afronden
          </span>
        </button>

        <UtilityRow
          onSaveCheckpoint={onSaveCheckpoint}
          onPause={onPause}
          pausePending={pausePending}
        />

        <button
          type="button"
          onClick={handleTapFinishSession}
          className="gn-plaque-action flex min-h-[56px] w-full max-w-xs items-center justify-center gap-2 px-6 py-3"
        >
          <Flag className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
          <span className="gn-display text-sm font-semibold tracking-wide">
            Spel afronden
          </span>
        </button>
      </div>
    );
  }

  // ── Tussen rondes ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2.5">
      <div className="text-center">
        <p className="gn-eyebrow">
          Ronde {lastEndedRound?.round_number} afgerond
        </p>
        {trackRoundResults && lastRoundWinner && (
          <p className="gn-display mt-0.5 text-xl font-semibold tracking-wide sm:text-2xl">
            {lastRoundWinner.playerName.toUpperCase()} WINT RONDE{" "}
            {lastEndedRound?.round_number}
          </p>
        )}
      </div>

      {trackRoundResults && tally.length > 0 && (
        <div className="flex flex-col items-center gap-0.5">
          {tally.map((entry) => (
            <p key={entry.playerId} className="gn-muted text-sm">
              {playerById.get(entry.playerId)?.name ?? "?"} — {entry.wins}
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
          {startNextRound.isPending ? "Bezig..." : "Volgende ronde starten"}
        </span>
      </button>

      <UtilityRow
        onSaveCheckpoint={onSaveCheckpoint}
        onPause={onPause}
        pausePending={pausePending}
      />

      {trackRoundResults && lastEndedRound && (
        <button
          type="button"
          onClick={() => setMode("correcting")}
          className="gn-plaque-action flex min-h-[48px] w-full max-w-xs items-center justify-center gap-2 px-6 py-2.5"
        >
          <Undo2 className="h-3.5 w-3.5" style={{ color: "var(--gn-brass)" }} />
          <span className="gn-display text-xs font-semibold tracking-wide">
            Laatste resultaat aanpassen
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={handleTapFinishSession}
        className="gn-plaque-action flex min-h-[56px] w-full max-w-xs items-center justify-center gap-2 px-6 py-3"
      >
        <Flag className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
        <span className="gn-display text-sm font-semibold tracking-wide">
          Spel afronden
        </span>
      </button>
    </div>
  );
}
