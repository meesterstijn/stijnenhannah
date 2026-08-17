import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useGameNightGames } from "@/features/game-night/hooks/useGameNightGames";
import { GameCard } from "@/features/game-night/components/GameCard";

export default function GameNightGames() {
  const { data: games = [], isLoading } = useGameNightGames();

  return (
    <div className="space-y-7">
      <Link
        to="/game-night"
        className="gn-muted inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--gn-brass)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar Game Night
      </Link>

      <div>
        <p className="gn-eyebrow mb-1.5">Game Night</p>
        <h1 className="gn-display text-2xl font-semibold sm:text-3xl">
          Mijn spellen
        </h1>
        <p className="gn-muted mt-1.5 text-sm">
          {isLoading
            ? "Kast wordt geladen…"
            : `${games.length} ${games.length === 1 ? "spel" : "spellen"} in de kast`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="gn-faint h-5 w-5 animate-spin" />
        </div>
      ) : games.length === 0 ? (
        <p className="gn-faint text-sm">Nog geen spellen in de kast.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
