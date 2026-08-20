import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Link2, Unlink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import {
  useLinkPlayerAccount,
  useUnlinkPlayerAccount,
  useProfileRoleLookup,
} from "@/features/game-night/hooks/useGameNightMemberProfile";
import {
  useCharacterEquipmentForPlayers,
  useCharacterParts,
} from "@/features/game-night/hooks/useCharacterCatalog";
import {
  buildPlayerStats,
  gameDetailPath,
} from "@/features/game-night/lib/gameNightStats";
import { titlesForPlayer } from "@/features/game-night/lib/gameNightTitles";
import { formatDuration } from "@/features/game-night/lib/gameTimer";
import {
  characterVisualPropsFor,
  resolvePlayerCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";
import type { GameNightPlayer } from "@/lib/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Game Night V2.3 (sectie 14-15) — minimale owner-only accountkoppeling.
// Er bestaat nergens in de app een manier om bestaande auth-accounts op te
// sommen (geen "browse profiles"-UI), dus de owner plakt hier het account-
// UUID dat hij zelf uit het Supabase Dashboard (Authentication → Users)
// haalt. Zelf-service signup/account-browser is bewust V2.4-scope.
function AccountLinkSection({
  playerId,
  authUserId,
}: {
  playerId: string;
  authUserId: string | null;
}) {
  const [input, setInput] = useState("");
  const link = useLinkPlayerAccount();
  const unlink = useUnlinkPlayerAccount();

  const trimmedInput = input.trim();
  const validUuid = UUID_RE.test(trimmedInput);
  const { data: lookedUpRole, isFetching: roleLoading } = useProfileRoleLookup(
    validUuid ? trimmedInput : null,
  );

  return (
    <div className="gnv2-panel-elevated px-5 py-4">
      <p className="gnv2-eyebrow mb-2">Account (owner)</p>
      {authUserId ? (
        <>
          <p className="gnv2-muted text-xs">
            Gekoppeld account-id:{" "}
            <span className="font-mono">{authUserId}</span>
          </p>
          <p className="gnv2-faint mt-1 text-xs">
            Ontkoppelen verbreekt de link én zet de rol van dit account naar
            "geen toegang" — de speler/historie blijft gewoon bestaan.
          </p>
          <button
            type="button"
            onClick={() => unlink.mutate(playerId)}
            disabled={unlink.isPending}
            className="gnv2-btn gnv2-btn-ghost mt-3 px-4 text-xs"
          >
            <Unlink className="h-3.5 w-3.5" />
            {unlink.isPending ? "Bezig..." : "Ontkoppelen"}
          </button>
        </>
      ) : (
        <>
          <p className="gnv2-faint text-xs">
            Geen gekoppeld account. Plak hier het account-UUID (Supabase
            Dashboard → Authentication → Users) om deze speler een eigen Game
            Night-login te geven.
          </p>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="gnv2-input mt-2 font-mono text-xs"
          />
          {validUuid && (
            <p
              className={`mt-1.5 text-xs ${
                lookedUpRole === "r6_player" ||
                lookedUpRole === "cocktail_guest"
                  ? "font-semibold text-red-400"
                  : "gnv2-faint"
              }`}
            >
              {roleLoading
                ? "Huidige rol opzoeken..."
                : lookedUpRole == null
                  ? "Geen profiel gevonden voor dit account-id."
                  : lookedUpRole === "owner"
                    ? "Dit is het owner-account — koppelen degradeert de rol niet."
                    : lookedUpRole === "game_night_member" ||
                        lookedUpRole === "no_access"
                      ? `Huidige rol: ${lookedUpRole} — koppelen zet deze naar game_night_member.`
                      : `Let op: dit account heeft nu rol "${lookedUpRole}" — koppelen VERVANGT die door game_night_member (systeem is voorlopig single-role).`}
            </p>
          )}
          <button
            type="button"
            onClick={() => link.mutate({ playerId, authUserId: trimmedInput })}
            disabled={!validUuid || link.isPending}
            className="gnv2-btn gnv2-btn-ghost mt-2 px-4 text-xs"
          >
            <Link2 className="h-3.5 w-3.5" />
            {link.isPending ? "Bezig..." : "Koppelen"}
          </button>
        </>
      )}
      {(link.isError || unlink.isError) && (
        <p className="mt-2 text-xs text-red-400">
          {(link.error as Error | undefined)?.message ??
            (unlink.error as Error | undefined)?.message ??
            "Actie mislukt."}
        </p>
      )}
    </div>
  );
}

// Game Night V2.9C (sectie 22) — vervangt de V2.8/V2.9-editeerbare legacy-
// character-selector: die kon "onzichtbaar" worden zodra een speler
// daarnaast ook modulaire equipment had (character_id blijft dan wel
// aanpasbaar via deze sectie, maar de weergave overal elders zou 'm
// negeren — verwarrend, zie caller/UX-review in het opleverrapport). V2.9C
// geeft de owner uitsluitend een READ-ONLY preview van het ECHTE huidige
// (modulair-voorrang, anders legacy) character — bewerken van andermans
// (mogelijk locked) cosmetics komt pas in een latere fase.
function CharacterPreviewSection({ player }: { player: GameNightPlayer }) {
  const { data: parts = [] } = useCharacterParts();
  const { data: equipment = [] } = useCharacterEquipmentForPlayers([player.id]);
  const partsById = useMemo(
    () => new Map(parts.map((p) => [p.id, p])),
    [parts],
  );
  const resolved = resolvePlayerCharacter(player, equipment, partsById);

  return (
    <div className="gnv2-panel-elevated px-5 py-4">
      <p className="gnv2-eyebrow mb-1">Character</p>
      <p className="gnv2-muted text-xs">
        {resolved.mode === "modular"
          ? "Samengesteld character"
          : resolved.mode === "legacy"
            ? "Legacy character"
            : "Nog geen character gekozen"}
      </p>
    </div>
  );
}

// Spelerprofiel (Game Night V5, sectie 11-16): echte, herleidbare cijfers
// per speler. Gearchiveerde spelers blijven volledig bereikbaar (sectie
// 33), alleen subtiel gelabeld — hun historie wordt nooit verborgen.
//
// Visuele consistentieronde (legacy .gn-*-migratie): het character is nu
// het hoofdelement van de hero (CharacterVisual/resolvePlayerCharacter,
// dezelfde bron als overal elders — geen aparte avatarimplementatie),
// i.p.v. uitsluitend een losse avatar_url/initiaal. Puur presentationeel —
// dezelfde reeds-bestaande, read-only hooks als CharacterPreviewSection
// hieronder al gebruikte (React Query dedupliceert de gelijke query's).
export default function GameNightPlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const { isOwner } = useAuth();
  const { data, isLoading } = useGameNightAnalytics();
  const { data: parts = [] } = useCharacterParts();
  const { data: equipment = [] } = useCharacterEquipmentForPlayers(
    playerId ? [playerId] : [],
  );
  const stats = data && playerId ? buildPlayerStats(data, playerId) : null;
  const titles = data && playerId ? titlesForPlayer(data, playerId) : [];
  const headlineTitle = titles[0];

  const partsById = useMemo(
    () => new Map(parts.map((p) => [p.id, p])),
    [parts],
  );
  const resolvedCharacter = stats
    ? resolvePlayerCharacter(stats.player, equipment, partsById)
    : undefined;
  const visualProps = characterVisualPropsFor(resolvedCharacter);

  if (isLoading) return <GnV2Loading />;

  return (
    <GnV2Scene className="gnv2-player-profile-scene">
      <header className="gnv2-topbar">
        <Link
          to="/game-night/spelers"
          className="gnv2-nav-btn"
          aria-label="Terug naar spelers"
          title="Terug"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="gnv2-identity gnv2-identity-center">
          <p className="gnv2-identity-eyebrow">Game Night</p>
          <p className="gnv2-identity-date">Spelerprofiel</p>
        </div>
        <div className="gnv2-topbar-spacer" aria-hidden />
      </header>

      <main className="gnv2-content-main">
        {!stats ? (
          <p className="gnv2-faint text-sm">Deze speler is niet gevonden.</p>
        ) : (
          <>
            <div className="gnv2-panel-elevated px-6 py-6 text-center">
              <div
                className="gnv2-creator-preview-frame mx-auto"
                style={{
                  ["--gnv2-ring" as string]:
                    stats.player.color ?? "var(--gnv2-accent-warm)",
                }}
              >
                <CharacterVisual
                  player={stats.player}
                  characterId={visualProps.characterId}
                  layers={visualProps.layers}
                />
              </div>
              <h1 className="gnv2-display mt-4 text-2xl font-semibold sm:text-3xl">
                {stats.player.name.toUpperCase()}
              </h1>
              {stats.player.archived_at && (
                <p className="gnv2-faint mt-1 text-xs">Niet meer actief</p>
              )}
              {headlineTitle && (
                <p
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: "var(--gnv2-accent-warm-strong)" }}
                >
                  <Crown className="h-3.5 w-3.5" /> {headlineTitle.title}
                </p>
              )}

              <div className="gnv2-faint mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                <div>
                  <p className="gnv2-display text-lg font-semibold text-[var(--gnv2-text)]">
                    {stats.gameNightsAttended}
                  </p>
                  <p>Game Nights</p>
                </div>
                <div>
                  <p className="gnv2-display text-lg font-semibold text-[var(--gnv2-text)]">
                    {stats.gameSessionsPlayed}
                  </p>
                  <p>spellen gespeeld</p>
                </div>
                <div>
                  <p className="gnv2-display text-lg font-semibold text-[var(--gnv2-text)]">
                    {stats.sessionWins}
                  </p>
                  <p>session-overwinningen</p>
                </div>
                <div>
                  <p className="gnv2-display text-lg font-semibold text-[var(--gnv2-text)]">
                    {stats.roundWins}
                  </p>
                  <p>ronde-overwinningen</p>
                </div>
              </div>
            </div>

            {isOwner && playerId && (
              <AccountLinkSection
                playerId={playerId}
                authUserId={stats.player.auth_user_id}
              />
            )}

            {isOwner && playerId && (
              <CharacterPreviewSection player={stats.player} />
            )}

            {titles.length > 1 && (
              <div className="gnv2-panel-elevated px-5 py-4">
                <p className="gnv2-eyebrow mb-2">Titels</p>
                <div className="flex flex-wrap gap-2">
                  {titles.map((t) => (
                    <span key={t.title} className="gnv2-chip">
                      {t.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(stats.mostPlayed ||
              stats.mostSessionWins ||
              stats.mostRoundWins) && (
              <div className="gnv2-panel-elevated grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
                {stats.mostPlayed && (
                  <div>
                    <p className="gnv2-eyebrow mb-1">Meest gespeeld</p>
                    <p className="text-sm">
                      {stats.mostPlayed.game.name} · {stats.mostPlayed.count}{" "}
                      {stats.mostPlayed.count === 1 ? "keer" : "keer"}
                    </p>
                  </div>
                )}
                {stats.mostSessionWins && (
                  <div>
                    <p className="gnv2-eyebrow mb-1">Meeste gewonnen</p>
                    <p className="text-sm">
                      {stats.mostSessionWins.game.name} ·{" "}
                      {stats.mostSessionWins.count} session wins
                    </p>
                  </div>
                )}
                {stats.mostRoundWins && (
                  <div>
                    <p className="gnv2-eyebrow mb-1">Meeste rondes gewonnen</p>
                    <p className="text-sm">
                      {stats.mostRoundWins.game.name} ·{" "}
                      {stats.mostRoundWins.count}
                    </p>
                  </div>
                )}
              </div>
            )}

            {(stats.averageSessionDurationSeconds != null ||
              stats.longestSession) && (
              <div className="gnv2-panel-elevated grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
                {stats.averageSessionDurationSeconds != null && (
                  <div>
                    <p className="gnv2-eyebrow mb-1">Gemiddelde spelduur</p>
                    <p className="text-sm">
                      {formatDuration(stats.averageSessionDurationSeconds)}
                    </p>
                  </div>
                )}
                {stats.longestSession && (
                  <div>
                    <p className="gnv2-eyebrow mb-1">Langste spel</p>
                    <p className="text-sm">
                      {stats.longestSession.game.name} ·{" "}
                      {formatDuration(stats.longestSession.seconds)}
                    </p>
                  </div>
                )}
                {stats.totalActiveSeconds > 0 && (
                  <div>
                    <p className="gnv2-eyebrow mb-1">Totale speeltijd</p>
                    <p className="text-sm">
                      {formatDuration(stats.totalActiveSeconds)}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="gnv2-eyebrow mb-3">Per spel</p>
              {stats.perGame.length === 0 ? (
                <p className="gnv2-faint text-sm">Nog geen spellen gespeeld.</p>
              ) : (
                <div className="gnv2-content-list">
                  {stats.perGame.map((g) => (
                    <Link
                      key={g.game.id}
                      to={gameDetailPath(g.game)}
                      className="gnv2-list-row flex-col items-start"
                    >
                      <p className="text-sm font-semibold">{g.game.name}</p>
                      <p className="gnv2-muted mt-0.5 text-xs">
                        {g.sessionsPlayed}× gespeeld
                        {g.roundsPlayed > 0 &&
                          ` · ${g.roundsWon} rondes gewonnen`}
                        {g.sessionWinratePct != null &&
                          ` · ${g.sessionWins} session wins · ${g.sessionWinratePct}% winrate`}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </GnV2Scene>
  );
}
