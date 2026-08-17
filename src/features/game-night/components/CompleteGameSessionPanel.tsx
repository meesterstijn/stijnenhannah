import { useState } from "react";
import { Trophy, X } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import type { GameSessionWithGame } from "@/features/game-night/hooks/useGameSession";
import { useCompleteGameSession } from "@/features/game-night/hooks/useGameSession";
import { useDiscardOpenRound } from "@/features/game-night/hooks/useGameNightRounds";
import { WinnerPickerGrid } from "@/features/game-night/components/WinnerPickerGrid";

// Sectie 21/23/24 (vorige ronde) + deze correctie: "winner" en "score"
// werken volledig, ranking/team/coop tonen bewust een nette tijdelijke
// melding — het datamodel staat er al klaar voor.
//
// Correctie "eindwinnaar optioneel": has_session_winner=true betekent
// voortaan alleen "dit spel ONDERSTEUNT een eindwinnaar", nooit "een
// eindwinnaar is verplicht". Deze component (alleen gerenderd wanneer
// has_session_winner=true, zie ActiveGameSessionPanel) begint daarom altijd
// met een keuzescherm: WINNAAR REGISTREREN / AFSLUITEN ZONDER WINNAAR /
// TERUG NAAR SPEL. "Afsluiten zonder winnaar" roept dezelfde RPC aan met
// een lege resultatenlijst — game_night_complete_game_session ondersteunde
// dat al (coalesce naar '[]'::jsonb), geen migratie nodig.
//
// `discardRoundId` (alleen meegegeven vanuit een rondespel): de nog-open
// ronde wordt pas hier, vlak vóór de daadwerkelijke afrondactie,
// weggegooid — niet eerder, zodat elke "Terug"/"Annuleren" hieronder altijd
// veilig teruggaat naar een intacte ronde i.p.v. een al-verdwenen ronde.
type Step = "choice" | "picker";

export function CompleteGameSessionPanel({
  gameSession,
  participants,
  discardRoundId,
  onCancel,
}: {
  gameSession: GameSessionWithGame;
  participants: GameNightPlayer[];
  discardRoundId?: string;
  onCancel: () => void;
}) {
  const completeSession = useCompleteGameSession();
  const discardRound = useDiscardOpenRound(gameSession.id);
  const [step, setStep] = useState<Step>("choice");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [confirmingWinnerId, setConfirmingWinnerId] = useState<string | null>(
    null,
  );

  // Configuratiesnapshot van de sessie zelf, niet de (mogelijk inmiddels
  // gewijzigde) live spelconfiguratie.
  const mode = gameSession.result_mode;
  const confirmingWinner = participants.find(
    (p) => p.id === confirmingWinnerId,
  );

  async function finalizeResults(
    results: { player_id: string; is_winner: boolean; score?: number }[],
  ) {
    if (discardRoundId) {
      await discardRound.mutateAsync(discardRoundId);
    }
    await completeSession.mutateAsync({
      gameSessionId: gameSession.id,
      results,
    });
  }

  async function confirmWinner() {
    if (!confirmingWinnerId) return;
    await finalizeResults(
      participants.map((p) => ({
        player_id: p.id,
        is_winner: p.id === confirmingWinnerId,
      })),
    );
  }

  async function submitScores() {
    const parsed = participants.map((p) => ({
      player_id: p.id,
      score: Number(scores[p.id] ?? 0) || 0,
    }));
    const maxScore = Math.max(...parsed.map((p) => p.score));
    await finalizeResults(
      parsed.map((p) => ({
        ...p,
        is_winner: p.score === maxScore,
      })),
    );
  }

  // ── Stap 1: registreren of zonder winnaar afsluiten ─────────────────────
  if (step === "choice") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
        <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
          SPEL AFRONDEN
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setStep("picker")}
            className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full items-center px-6 py-3.5"
          >
            <Trophy
              className="mr-2 h-5 w-5 shrink-0"
              style={{ color: "var(--gn-brass)" }}
            />
            <span className="gn-display text-base font-semibold tracking-wide">
              Winnaar registreren
            </span>
          </button>
          <button
            type="button"
            onClick={() => finalizeResults([])}
            disabled={completeSession.isPending || discardRound.isPending}
            className="gn-plaque-action flex min-h-[56px] w-full items-center justify-center px-6 py-3"
          >
            <span className="gn-display text-sm font-semibold tracking-wide">
              {completeSession.isPending
                ? "Bezig..."
                : "Afsluiten zonder winnaar"}
            </span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Terug naar spel
          </button>
        </div>
      </div>
    );
  }

  // ── Stap 2: winnaar/score registreren ───────────────────────────────────
  if (mode === "winner") {
    if (confirmingWinner) {
      return (
        <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
          <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
            {confirmingWinner.name.toUpperCase()} WINT{" "}
            {gameSession.game.name.toUpperCase()}
          </p>
          <button
            type="button"
            onClick={confirmWinner}
            disabled={completeSession.isPending}
            className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center px-6 py-3.5"
          >
            <span className="gn-display text-lg font-semibold tracking-wide">
              {completeSession.isPending ? "Bezig..." : "Bevestigen"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmingWinnerId(null)}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Terug
          </button>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center gap-3">
        <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
          WIE HEEFT GEWONNEN?
        </p>
        <div className="gn-player-grid-scroll">
          <WinnerPickerGrid
            players={participants}
            onPick={setConfirmingWinnerId}
          />
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => finalizeResults([])}
            disabled={completeSession.isPending}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Geen winnaar opslaan
          </button>
          <button
            type="button"
            onClick={() => setStep("choice")}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            <X className="mr-1 inline h-3 w-3" />
            Terug
          </button>
        </div>
      </div>
    );
  }

  if (mode === "score") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center gap-3">
        <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
          EINDSTAND
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          {participants.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-sm">{player.name}</span>
              <input
                type="number"
                inputMode="numeric"
                value={scores[player.id] ?? ""}
                onChange={(e) =>
                  setScores((s) => ({ ...s, [player.id]: e.target.value }))
                }
                className="w-16 rounded-md px-2 py-1 text-center text-sm"
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={submitScores}
          disabled={completeSession.isPending}
          className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center px-6 py-3.5"
        >
          <span className="gn-display text-lg font-semibold tracking-wide">
            {completeSession.isPending ? "Bezig..." : "Bevestigen"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStep("choice")}
          className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
        >
          Terug
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
      <p className="gn-display text-lg font-semibold tracking-wide">
        Nog niet beschikbaar
      </p>
      <p className="gn-muted max-w-xs text-xs">
        Score-invoer voor deze spelmodus ({mode}) is nog niet gebouwd — het
        datamodel ondersteunt het al, de interface volgt in een latere stap.
      </p>
      <button
        type="button"
        onClick={() => setStep("choice")}
        className="gn-plaque-action flex min-h-[56px] w-full max-w-xs items-center justify-center px-6 py-3.5"
      >
        <span className="gn-display text-lg font-semibold tracking-wide">
          Terug
        </span>
      </button>
    </div>
  );
}
