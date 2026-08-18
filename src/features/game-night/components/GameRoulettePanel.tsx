import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Dices } from "lucide-react";
import type { GameNightGame, GameNightPlayer } from "@/lib/supabase";
import { hardFilterGames } from "@/features/game-night/lib/rankGameNightGames";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";
import { GameParticipantSheet } from "@/features/game-night/components/GameParticipantSheet";

// Vaste kaartafmetingen uit .gn-roulette-card/.gn-roulette-track in
// styles.css (6.25rem breed, 0.9rem tussenruimte @ 16px root) — bewust als
// constanten hier, NIET gemeten uit de DOM, zodat de eindpositie van de
// animatie volledig voorspelbaar is uit de al-bepaalde winnaarsindex.
const CARD_W = 100;
const GAP = 14.4;
const STEP = CARD_W + GAP;
const SPIN_MS = 2200;
const REDUCED_MOTION_MS = 320;

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Trekt EERST een echte willekeurige winnaar uit de kandidaten, en bouwt
// dan pas een rij kaarten die daar op eindigt (winnaar altijd op de
// laatste positie) — de animatie leidt het resultaat dus nooit af van
// zichzelf, het resultaat bepaalt de animatie (sectie 20).
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

function RouletteCardFace({
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
      className={`gn-roulette-card ${winner ? "gn-roulette-card-winner" : ""}`}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-end p-1.5"
          style={{ background: placeholderCoverGradient(game.id) }}
          aria-hidden
        >
          <span className="gn-display text-base font-semibold text-white/75">
            {game.name.charAt(0)}
          </span>
        </div>
      )}
    </div>
  );
}

// Game Roulette (Game Night V4, sectie 17-21): bewust NIET slim — harde
// filters (niet gearchiveerd, spelersaantal past), dan pure willekeur uit
// de overgebleven kandidaten. Fysieke kaarten schuiven over het bord en
// vertragen tot stilstand, geen casino-wiel/gokkast-esthetiek. Eindigt via
// dezelfde GameParticipantSheet + start_game_session-RPC als "Kies voor
// ons" en de Spellenkast.
export function GameRoulettePanel({
  games,
  attendees,
  gameNightSessionId,
  onBack,
}: {
  games: GameNightGame[];
  attendees: GameNightPlayer[];
  gameNightSessionId: string;
  onBack: () => void;
}) {
  const candidates = hardFilterGames(games, attendees.length);
  const [phase, setPhase] = useState<"idle" | "spinning" | "result">("idle");
  const [track, setTrack] = useState<GameNightGame[]>([]);
  const [winner, setWinner] = useState<GameNightGame | null>(null);
  const [offsetPx, setOffsetPx] = useState(CARD_W / 2);
  const [animate, setAnimate] = useState(false);
  const [pickingGame, setPickingGame] = useState<GameNightGame | null>(null);
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

    // Dubbele rAF: eerst de startpositie zonder transitie laten schilderen,
    // dan pas de transitieklasse + eindwaarde zetten — anders animeert de
    // browser soms vanaf de vorige eindstand i.p.v. vanaf het begin.
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

  if (pickingGame) {
    return (
      <GameParticipantSheet
        game={pickingGame}
        attendees={attendees}
        gameNightSessionId={gameNightSessionId}
        onClose={() => setPickingGame(null)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="gn-muted inline-flex items-center gap-1 text-xs"
          disabled={phase === "spinning"}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug
        </button>
        <p className="gn-eyebrow">Game Roulette</p>
      </div>

      {candidates.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="gn-display text-lg font-semibold tracking-wide">
            Geen spel past bij {attendees.length}{" "}
            {attendees.length === 1 ? "speler" : "spelers"}
          </p>
          <p className="gn-muted max-w-xs text-xs">
            Er is geen spel in de kast dat dit aantal spelers ondersteunt.
          </p>
        </div>
      ) : (
        <>
          <div className="gn-roulette-track-wrap">
            <div className="gn-roulette-pointer" aria-hidden />
            {phase === "idle" ? (
              <div className="gn-roulette-track">
                {shuffled(candidates)
                  .slice(0, 5)
                  .map((g, i) => (
                    <RouletteCardFace
                      key={`${g.id}-${i}`}
                      game={g}
                      winner={false}
                    />
                  ))}
              </div>
            ) : (
              <div
                className={`gn-roulette-track ${animate ? "gn-roulette-track-spinning" : ""}`}
                style={{ transform: `translateX(-${offsetPx}px)` }}
              >
                {track.map((g, i) => (
                  <RouletteCardFace
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
              className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center gap-2 px-6 py-3.5 disabled:opacity-60"
            >
              <Dices className="h-5 w-5" style={{ color: "var(--gn-brass)" }} />
              <span className="gn-display text-lg font-semibold tracking-wide">
                {phase === "spinning" ? "Bezig..." : "TREK EEN SPEL"}
              </span>
            </button>
          )}

          {phase === "result" && winner && (
            <div className="flex w-full max-w-xs flex-col items-center gap-2.5 text-center">
              <p className="gn-display text-xl font-semibold tracking-wide">
                {winner.name}
              </p>
              <button
                type="button"
                onClick={() => setPickingGame(winner)}
                className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full items-center justify-center px-6 py-3.5"
              >
                <span className="gn-display text-lg font-semibold tracking-wide">
                  SPELEN
                </span>
              </button>
              <button
                type="button"
                onClick={spin}
                className="gn-plaque-action flex min-h-[48px] w-full items-center justify-center px-4"
              >
                <span className="gn-display text-sm font-semibold tracking-wide">
                  NOG EEN KEER
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
