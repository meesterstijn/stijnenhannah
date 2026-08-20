import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Skull, Trophy } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import {
  buildGeneralRecords,
  gameDetailPath,
  type Leaderboard,
} from "@/features/game-night/lib/gameNightStats";
import {
  buildGameAwards,
  buildGeneralAwards,
  type GameAwardResult,
  type GeneralAwardResult,
} from "@/features/game-night/lib/gameNightTitles";
import { PlayerLink } from "@/features/game-night/components/PlayerLink";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";
import type { GameNightPlayer } from "@/lib/supabase";

// Sectie 28 (V6): elke spelernaam moet naar het spelerprofiel kunnen
// linken — nooit als platte samengevoegde tekst.
function HolderNames({ holders }: { holders: GameNightPlayer[] }): ReactNode {
  return holders.map((h, i) => (
    <span key={h.id}>
      {i > 0 && " & "}
      <PlayerLink player={h} />
    </span>
  ));
}

// De plaque zelf is bewust GEEN <Link> (sectie 29: geen nested interactive
// elements) — spelernamen linken naar hun profiel, een aparte kleine
// "Bekijk [spel]"-link onderaan linkt naar de speldetailpagina.
function GameAwardPlaque({ award }: { award: GameAwardResult }) {
  const Icon = award.config.slug === "skull" ? Skull : Trophy;

  return (
    <div className="gnv2-award-plaque">
      <Icon
        className="mx-auto h-5 w-5"
        style={{ color: "var(--gnv2-accent-warm-strong)" }}
        strokeWidth={1.7}
      />
      <p className="gnv2-display mt-2 text-lg font-semibold tracking-wide">
        {award.config.title}
      </p>
      {award.holders.length > 0 ? (
        <>
          <p
            className="gnv2-display mt-1.5 text-xl font-semibold"
            style={{ color: "var(--gnv2-accent-warm-strong)" }}
          >
            <HolderNames holders={award.holders} />
          </p>
          <p className="gnv2-muted mt-1 text-xs">
            {award.metricValue} keer gewonnen
          </p>
        </>
      ) : (
        <>
          <p className="gnv2-faint mt-1.5 text-sm italic">
            Nog niet uitgereikt
          </p>
          <p className="gnv2-faint mt-1 text-xs">{award.requirementText}</p>
        </>
      )}
      {award.game && (
        <Link
          to={gameDetailPath(award.game)}
          className="gnv2-muted mt-3 inline-block text-xs underline"
        >
          Bekijk {award.game.name}
        </Link>
      )}
    </div>
  );
}

function GeneralAwardCard({ award }: { award: GeneralAwardResult }) {
  return (
    <div className="gnv2-panel-elevated px-5 py-4 text-center">
      <p className="gnv2-display text-base font-semibold tracking-wide">
        {award.config.title}
      </p>
      <p className="gnv2-faint mt-0.5 text-xs">{award.config.description}</p>
      {award.holders.length > 0 ? (
        <p
          className="mt-2 text-sm font-semibold"
          style={{ color: "var(--gnv2-accent-warm-strong)" }}
        >
          <HolderNames holders={award.holders} />
        </p>
      ) : (
        <p className="gnv2-faint mt-2 text-xs italic">Nog niet uitgereikt</p>
      )}
    </div>
  );
}

function RecordRow({
  label,
  leaderboard,
}: {
  label: string;
  leaderboard: Leaderboard;
}) {
  if (leaderboard.entries.length === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <p className="gnv2-eyebrow">{label}</p>
      <p className="text-sm font-semibold">
        <HolderNames holders={leaderboard.entries.map((e) => e.player)} /> ·{" "}
        {leaderboard.entries[0].value}
      </p>
    </div>
  );
}

// Hall of Fame (Game Night V5, sectie 17-18/29): een echte, theatrale
// prijzenwand — spel-specifieke titels als grote messing plaques,
// speelse algemene titels als secundaire kaarten, harde records als
// compacte lijst. Alles herberekend uit historie (sectie 19), geen enkele
// titel staat handmatig ergens vast. "Recent gebroken records" (sectie 29)
// wordt bewust NIET gebouwd — dat zou historische snapshots vereisen die
// er niet zijn, en doen alsof we dat wél weten zou het tegenovergestelde
// zijn van "alleen betrouwbaar afgeleide data tonen".
//
// Visuele consistentieronde (legacy .gn-*-migratie): plaques laten de
// gn-plaque-tilt-rotatie los ten gunste van de rustigere gnv2-award-plaque
// (consistent met SpecialistPlaque op de speldetailpagina) — puur visueel,
// geen enkele award-berekening gewijzigd.
export default function GameNightHallOfFame() {
  const { data, isLoading } = useGameNightAnalytics();

  const gameAwards = useMemo(() => (data ? buildGameAwards(data) : []), [data]);
  const generalAwards = useMemo(
    () => (data ? buildGeneralAwards(data) : []),
    [data],
  );
  const records = useMemo(
    () => (data ? buildGeneralRecords(data) : null),
    [data],
  );

  if (isLoading || !data || !records) return <GnV2Loading />;

  const noRecords = [
    records.mostGameNights,
    records.mostGameSessions,
    records.mostSessionWins,
    records.mostRoundWins,
    records.mostDifferentGamesWon,
    records.longestWinStreak,
  ].every((l) => l.entries.length === 0);

  return (
    <GnV2Scene className="gnv2-hall-of-fame-scene">
      <header className="gnv2-topbar">
        <Link
          to="/game-night"
          className="gnv2-nav-btn"
          aria-label="Terug naar Game Night"
          title="Terug"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="gnv2-identity gnv2-identity-center">
          <p className="gnv2-identity-eyebrow">Game Night</p>
          <p className="gnv2-identity-date">Hall of Fame</p>
        </div>
        <div className="gnv2-topbar-spacer" aria-hidden />
      </header>

      <main className="gnv2-content-main">
        <div className="gnv2-content-intro text-center">
          <p className="gnv2-content-sub">De eeuwige roem</p>
        </div>

        {gameAwards.length > 0 && (
          <div>
            <p className="gnv2-eyebrow mb-3 text-center">Titelhouders</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gameAwards.map((award) => (
                <GameAwardPlaque key={award.config.slug} award={award} />
              ))}
            </div>
          </div>
        )}

        {generalAwards.length > 0 && (
          <div>
            <p className="gnv2-eyebrow mb-3 text-center">Speelse titels</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {generalAwards.map((award) => (
                <GeneralAwardCard key={award.config.key} award={award} />
              ))}
            </div>
          </div>
        )}

        <div className="gnv2-panel-elevated px-5 py-4">
          <p className="gnv2-eyebrow mb-1">Records</p>
          <div
            className="divide-y"
            style={{ borderColor: "var(--gnv2-border)" }}
          >
            <RecordRow
              label="Meeste Game Nights"
              leaderboard={records.mostGameNights}
            />
            <RecordRow
              label="Meeste game sessions"
              leaderboard={records.mostGameSessions}
            />
            <RecordRow
              label="Meeste session wins"
              leaderboard={records.mostSessionWins}
            />
            <RecordRow
              label="Meeste round wins"
              leaderboard={records.mostRoundWins}
            />
            <RecordRow
              label="Meeste verschillende spellen gewonnen"
              leaderboard={records.mostDifferentGamesWon}
            />
            <RecordRow
              label="Langste winstreak"
              leaderboard={records.longestWinStreak}
            />
          </div>
          {noRecords && (
            <p className="gnv2-faint text-sm">
              Nog geen records — speel wat Game Nights om deze lijst te vullen.
            </p>
          )}
        </div>
      </main>
    </GnV2Scene>
  );
}
