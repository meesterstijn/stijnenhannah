import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import type { GameNightGame } from "@/lib/supabase";
import { hardFilterGames } from "@/features/game-night/lib/rankGameNightGames";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";

// Zelfde vaste kaartmaten als .gnv2-roulette-card/-track in styles.css —
// bewust als constanten (niet uit de DOM gemeten), zodat de eindpositie
// altijd exact voorspelbaar is uit de al-bepaalde winnaarsindex (zelfde
// aanpak als de legacy GameRoulettePanel.tsx die dit vervangt).
const CARD_W = 132;
const GAP = 18;
const STEP = CARD_W + GAP;
const SPIN_MS = 2600;
const REDUCED_MOTION_MS = 320;

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Trekt EERST een echte winnaar uit de kandidaten, bouwt DAARNA de rij
// kaarten die daarop eindigt (sectie 8: "de animatie mag nooit een ander
// spel tonen als winnaar dan de bestaande logica daadwerkelijk
// geselecteerd heeft" — het resultaat bepaalt de animatie, nooit andersom).
function pickWinner(
  candidates: GameNightGame[],
  excludeId: string | null,
): GameNightGame {
  const pool =
    excludeId && candidates.length > 1
      ? candidates.filter((g) => g.id !== excludeId)
      : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildTrack(candidates: GameNightGame[], winner: GameNightGame) {
  const track: GameNightGame[] = [];
  for (let i = 0; i < 4; i++) track.push(...shuffled(candidates));
  track.push(winner);
  return track;
}

function RouletteFace({
  game,
  winner,
}: {
  game: GameNightGame;
  winner: boolean;
}) {
  const coverUrl = game.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;
  return (
    <div
      className={`gnv2-roulette-card ${winner ? "gnv2-roulette-card-winner" : ""}`}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" />
      ) : (
        <div
          className="gnv2-roulette-card-fallback"
          style={{ background: placeholderCoverGradient(game.id) }}
        >
          <span>{game.name.charAt(0)}</span>
        </div>
      )}
    </div>
  );
}

// Game Night V2.6 (sectie 8) — Game Roulette als daadwerkelijk moment: een
// horizontale kaartenrij passeert een centrale selectiezone en vertraagt
// tot stilstand, i.p.v. direct een resultaattekst. De bestaande
// selectielogica (harde filter + pure willekeur) is functioneel
// ongewijzigd overgenomen uit de legacy GameRoulettePanel.tsx — alleen de
// presentatie is nieuw.
export function GameRoulette({
  games,
  playerCount,
  onBack,
  onSelectGame,
}: {
  games: GameNightGame[];
  playerCount: number;
  onBack: () => void;
  onSelectGame: (game: GameNightGame) => void;
}) {
  const candidates = hardFilterGames(games, playerCount);
  const [phase, setPhase] = useState<"idle" | "spinning" | "result">("idle");
  const [track, setTrack] = useState<GameNightGame[]>([]);
  const [winner, setWinner] = useState<GameNightGame | null>(null);
  const [offsetPx, setOffsetPx] = useState(CARD_W / 2);
  const [animate, setAnimate] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function spin() {
    if (candidates.length === 0) return;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const nextWinner = pickWinner(candidates, winner?.id ?? null);
    const nextTrack = buildTrack(candidates, nextWinner);
    const finalOffset = (nextTrack.length - 1) * STEP + CARD_W / 2;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setWinner(nextWinner);
    setTrack(nextTrack);
    setPhase("spinning");
    setAnimate(false);
    setOffsetPx(CARD_W / 2);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimate(true);
        setOffsetPx(finalOffset);
      });
    });

    timeoutRef.current = setTimeout(
      () => setPhase("result"),
      reducedMotion ? REDUCED_MOTION_MS : SPIN_MS,
    );
  }

  return (
    <div className="gnv2-roulette gnv2-view-enter">
      <button
        type="button"
        onClick={onBack}
        disabled={phase === "spinning"}
        className="gnv2-preview-back"
      >
        Terug
      </button>

      <p className="gnv2-select-heading">Game Roulette</p>
      <p className="gnv2-select-subheading">Laat het lot beslissen</p>

      {candidates.length === 0 ? (
        <div className="gnv2-roulette-empty">
          <p>
            Geen spel past bij {playerCount}{" "}
            {playerCount === 1 ? "speler" : "spelers"}.
          </p>
        </div>
      ) : (
        <>
          <div className="gnv2-roulette-track-wrap">
            <div className="gnv2-roulette-pointer" aria-hidden />
            {phase === "idle" ? (
              <div className="gnv2-roulette-track">
                {shuffled(candidates)
                  .slice(0, 6)
                  .map((g, i) => (
                    <RouletteFace
                      key={`${g.id}-${i}`}
                      game={g}
                      winner={false}
                    />
                  ))}
              </div>
            ) : (
              <div
                className={`gnv2-roulette-track ${animate ? "gnv2-roulette-track-spinning" : ""}`}
                style={{ transform: `translateX(-${offsetPx}px)` }}
              >
                {track.map((g, i) => (
                  <RouletteFace
                    key={`${g.id}-${i}`}
                    game={g}
                    winner={phase === "result" && i === track.length - 1}
                  />
                ))}
              </div>
            )}
          </div>

          {phase !== "result" && (
            <button
              type="button"
              onClick={spin}
              disabled={phase === "spinning"}
              className="gnv2-btn gnv2-btn-primary gnv2-roulette-cta"
            >
              <Dices className="h-5 w-5" />
              {phase === "spinning" ? "Bezig..." : "Trek een spel"}
            </button>
          )}

          {phase === "result" && winner && (
            <div className="gnv2-roulette-result">
              <p className="gnv2-roulette-result-name">{winner.name}</p>
              <div className="gnv2-roulette-result-actions">
                <button
                  type="button"
                  onClick={() => onSelectGame(winner)}
                  className="gnv2-btn gnv2-btn-primary"
                >
                  Dit wordt 'm
                </button>
                <button
                  type="button"
                  onClick={spin}
                  className="gnv2-btn gnv2-btn-ghost"
                >
                  Nog een keer
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
