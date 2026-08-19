import { useState } from "react";
import type {
  GameNightColorPaletteEntry,
  GameNightGame,
  GameNightPlayer,
  GameNightSession,
} from "@/lib/supabase";
import { useStartGameSession } from "@/features/game-night/hooks/useGameSession";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";
import {
  getPlayerDisplayName,
  getPlayerInitial,
  resolvePlayerColorHex,
} from "@/features/game-night/lib/playerIdentity";

// Game Night V2.6 (sectie 12/13/14) — het pre-game-moment: DE plek waar de
// keuze definitief wordt. Schrijft as enige stap in deze hele Game-Select-
// flow naar Supabase (sectie 20: alles ervoor is pure lokale view-state).
// Uitbreidbaar bedoeld (sectie 24) — voting-resultaat/rivaliteit/random-
// eerste-speler/achievements kunnen later als extra blok tussen de titel en
// de deelnemerssectie landen, zonder deze component te herstructureren.
// Geen van die features wordt hier al gebouwd.
export function GameReveal({
  game,
  session,
  party,
  palette,
  onBack,
}: {
  game: GameNightGame;
  session: GameNightSession;
  party: GameNightPlayer[];
  palette: GameNightColorPaletteEntry[];
  onBack: () => void;
}) {
  const startSession = useStartGameSession();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(party.map((p) => p.id)),
  );
  const [error, setError] = useState<string | null>(null);

  // Sectie 14: alleen een deelnemerskeuze tonen als het spel daadwerkelijk
  // minder spelers toestaat dan er aan tafel zitten — de normale avond
  // (party past altijd) toont dit blok gewoon niet, geen extra tik nodig.
  const needsParticipantPicker =
    game.max_players != null && party.length > game.max_players;

  const count = selectedIds.size;
  const tooFew = game.min_players != null && count < game.min_players;
  const tooMany = game.max_players != null && count > game.max_players;
  const canStart = count > 0 && !tooFew && !tooMany && !startSession.isPending;

  let helperText: string | null = null;
  if (tooFew) helperText = `Minimaal ${game.min_players} spelers nodig`;
  else if (tooMany) helperText = `Maximaal ${game.max_players} spelers`;

  function toggle(playerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function handleStart() {
    setError(null);
    try {
      // Sectie 13: exact de bestaande startflow — huidig spel, actieve
      // party/deelnemersselectie, bestaande RPC. Geen navigate() nodig: dit
      // component leeft niet op een eigen route, GameNightHome.tsx valt
      // vanzelf terug op de bestaande (Live Play-)weergave zodra
      // useLatestGameSession herlaadt na de mutation.
      await startSession.mutateAsync({
        gameNightSessionId: session.id,
        gameId: game.id,
        playerIds: [...selectedIds],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Starten mislukt");
    }
  }

  const coverUrl = game.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;
  const wash = placeholderCoverGradient(game.id);

  return (
    <div className="gnv2-reveal gnv2-view-enter-dramatic">
      <div
        className="gnv2-reveal-wash"
        style={
          coverUrl
            ? { backgroundImage: `url(${coverUrl})` }
            : { backgroundImage: wash }
        }
        aria-hidden
      />
      <div className="gnv2-reveal-scrim" aria-hidden />

      <div className="gnv2-reveal-content">
        <button type="button" onClick={onBack} className="gnv2-reveal-back">
          Terug
        </button>

        <div className="gnv2-reveal-cover">
          {coverUrl ? (
            <img src={coverUrl} alt="" />
          ) : (
            <div
              className="gnv2-reveal-cover-fallback"
              style={{ background: wash }}
            >
              <span>{game.name.charAt(0)}</span>
            </div>
          )}
        </div>

        <p className="gnv2-reveal-title">{game.name}</p>

        {!needsParticipantPicker && party.length > 0 && (
          <div className="gnv2-reveal-players">
            {party.map((p) => (
              <span key={p.id} className="gnv2-reveal-player">
                {getPlayerDisplayName(p)}
              </span>
            ))}
          </div>
        )}

        {needsParticipantPicker && (
          <div className="gnv2-reveal-picker">
            <p className="gnv2-reveal-picker-label">
              {game.max_players} spelers voor deze ronde
            </p>
            <div className="gnv2-reveal-picker-grid">
              {party.map((player) => {
                const selected = selectedIds.has(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => toggle(player.id)}
                    aria-pressed={selected}
                    className={`gnv2-reveal-picker-chip ${selected ? "gnv2-reveal-picker-chip-selected" : ""}`}
                  >
                    <span
                      className="gnv2-avatar gnv2-avatar-sm"
                      style={{
                        ["--gnv2-ring" as string]:
                          resolvePlayerColorHex(player, palette) ??
                          "var(--gnv2-border-strong)",
                      }}
                    >
                      {getPlayerInitial(player)}
                    </span>
                    {getPlayerDisplayName(player)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className="gnv2-reveal-tagline">Klaar voor de strijd?</p>

        {(helperText || error) && (
          <p className="gnv2-reveal-helper">{error ?? helperText}</p>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="gnv2-btn gnv2-btn-primary gnv2-reveal-start"
        >
          {startSession.isPending ? "Bezig..." : "Start spel"}
        </button>
      </div>
    </div>
  );
}
