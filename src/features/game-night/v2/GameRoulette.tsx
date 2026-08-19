import { useEffect, useMemo, useRef, useState } from "react";
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
// kaarten die daarop eindigt (sectie 38: "de winnaar wordt VOORAF bepaald
// door bestaande roulette-logica. Animatietiming bepaalt NOOIT de
// winnaar." — het resultaat bepaalt de animatie, nooit andersom).
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

function RouletteFace({ game }: { game: GameNightGame }) {
  const coverUrl = game.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;
  return (
    <div className="gnv2-roulette-card">
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

// Game Night V2.6/V2.7B (sectie 38 V2.7B-correctie) — Game Roulette als
// daadwerkelijk moment. Twee losse, elkaar nooit sturende lagen:
//   1. Een AMBIENT achtergrondband (`.gnv2-roulette-ambient`) — puur
//      decoratief, altijd zachtjes doorlopend (idle, tijdens het draaien,
//      ÉN na het resultaat: "de onderliggende track blijft langzaam
//      bewegen"). Heeft NOOIT invloed op wie wint — gewoon een oneindige
//      CSS-keyframe-loop van gedupliceerde kaarten.
//   2. De voorgrondtrack — exact de bestaande deterministische logica
//      (pickWinner → buildTrack → offset-animatie naar de vooraf bepaalde
//      winnaar). Zodra die tot stilstand komt, "tilt" de winnende kaart
//      zich los als eigen, groter element boven de ambient-band; de rest
//      van de voorgrondtrack vervaagt.
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

  // Puur decoratieve, altijd-bewegende achtergrondband — eenmalig
  // gerandomiseerd per mount, verder nooit door de winnaarslogica
  // aangeraakt. Twee keer achter elkaar gerenderd zodat de CSS-loop
  // (translateX(0) -> translateX(-50%)) naadloos aansluit.
  const ambientCards = useMemo(() => {
    const pool = candidates.length > 0 ? candidates : games;
    if (pool.length === 0) return [];
    const base = shuffled(pool).slice(
      0,
      Math.max(8, Math.min(14, pool.length * 2)),
    );
    return base.length > 0 ? base : pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <p className="gnv2-select-subheading">
        {phase === "result"
          ? "Het lot heeft gesproken."
          : "Laat het lot beslissen"}
      </p>

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

            {/* Laag 1: altijd-bewegende ambient-band (idle EN tijdens/na
                het draaien — "de onderliggende track blijft langzaam
                bewegen", sectie 38). */}
            <div className="gnv2-roulette-ambient" aria-hidden>
              <div className="gnv2-roulette-ambient-track">
                {[...ambientCards, ...ambientCards].map((g, i) => (
                  <RouletteFace key={`${g.id}-amb-${i}`} game={g} />
                ))}
              </div>
            </div>

            {/* Laag 2: de deterministische voorgrondtrack — alleen zichtbaar
                zolang er nog niet definitief een winnaar is getild. */}
            {phase !== "idle" && (
              <div
                className={`gnv2-roulette-track ${animate ? "gnv2-roulette-track-spinning" : ""} ${phase === "result" ? "gnv2-roulette-track-settling" : ""}`}
                style={{ transform: `translateX(-${offsetPx}px)` }}
              >
                {track.map((g, i) => (
                  <RouletteFace key={`${g.id}-${i}`} game={g} />
                ))}
              </div>
            )}

            {/* De gekozen game "uit de track getild": los, groter element
                exact op de markerpositie — komt pas op zodra de
                voorgrondtrack tot stilstand is gekomen. */}
            {phase === "result" && winner && (
              <div className="gnv2-roulette-lifted">
                <RouletteFace game={winner} />
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
