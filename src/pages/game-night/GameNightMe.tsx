import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, LogOut, Check, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import {
  useGameNightColorPalette,
  useUpdateMyProfile,
} from "@/features/game-night/hooks/useGameNightMemberProfile";
import {
  useCharacterEquipmentForPlayers,
  useCharacterParts,
} from "@/features/game-night/hooks/useCharacterCatalog";
import { buildPlayerStats } from "@/features/game-night/lib/gameNightStats";
import { titlesForPlayer } from "@/features/game-night/lib/gameNightTitles";
import {
  characterVisualPropsFor,
  resolvePlayerCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

const NICKNAME_MAX_LENGTH = 40;

// Game Night V2.3 (sectie 11-13) — de eerste echte member-pagina. Bewust
// functioneel/clean, GEEN character-design of visuele redesign (sectie 27):
// dezelfde algemene .gn-panel-elevated/.gn-plaque-action-stijl als
// GameNightPlayerProfile.tsx, gewone scrollbare `max-w-2xl`-layout — niet
// de vaste tabletop-viewport van GameNightHome (dit is een telefoonpagina).
// Alle cijfers komen uit de bestaande analytics-laag (useGameNightAnalytics/
// buildPlayerStats/titlesForPlayer) — geen tweede stats-engine.
//
// V2.9C (sectie 2/22): character kiezen/samenstellen verhuisde volledig
// naar de eigen /game-night/me/character-Creator — deze pagina toont hier
// alleen nog een read-only preview van het HUIDIGE (modulair-voorrang,
// anders legacy) character + een duidelijke "Mijn character"-actie. Geen
// tweede editor meer hier (was de V2.8/V2.9-CharacterSelector-chipgrid).
export default function GameNightMe() {
  const { session, isOwner } = useAuth();
  const { data, isLoading } = useGameNightAnalytics();
  const { data: palette = [] } = useGameNightColorPalette();
  const { data: parts = [] } = useCharacterParts();
  const updateProfile = useUpdateMyProfile();

  const myPlayer = data?.players.find(
    (p) => p.auth_user_id === session?.user.id,
  );

  const { data: equipment = [] } = useCharacterEquipmentForPlayers(
    myPlayer ? [myPlayer.id] : [],
  );
  const partsById = useMemo(
    () => new Map(parts.map((p) => [p.id, p])),
    [parts],
  );
  const resolvedCharacter = myPlayer
    ? resolvePlayerCharacter(myPlayer, equipment, partsById)
    : undefined;
  const visualProps = characterVisualPropsFor(resolvedCharacter);

  const [nickname, setNickname] = useState("");
  const [colorId, setColorId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Formuliervelden pas initialiseren zodra de eigen speler geladen is —
  // en opnieuw synchroniseren als de rij zelf wijzigt (bv. na een save door
  // een andere sessie van hetzelfde account).
  useEffect(() => {
    if (!myPlayer) return;
    setNickname(myPlayer.nickname ?? myPlayer.name);
    setColorId(myPlayer.color_id);
  }, [myPlayer]);

  async function handleSave() {
    if (!myPlayer) return;
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length > NICKNAME_MAX_LENGTH) return;
    await updateProfile.mutateAsync({
      nickname: trimmed,
      colorId,
      // Read-only hier sinds V2.9C (zie bestandscommentaar) — de RPC
      // vereist dit veld altijd, dus de HUIDIGE waarde ongewijzigd
      // meesturen i.p.v.'m via deze pagina te laten wijzigen. Zelfde
      // redenering geldt sinds V2.9E voor bodyShape — deze pagina bewerkt
      // "Lichaamsbouw" niet (dat gebeurt in de Character Creator).
      characterId: myPlayer.character_id,
      bodyShape: myPlayer.body_shape,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const trimmedNickname = nickname.trim();
  const nicknameValid =
    trimmedNickname.length > 0 && trimmedNickname.length <= NICKNAME_MAX_LENGTH;
  const dirty =
    !!myPlayer &&
    (trimmedNickname !== (myPlayer.nickname ?? myPlayer.name) ||
      colorId !== myPlayer.color_id);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl justify-center py-14">
        <Loader2 className="gn-faint h-5 w-5 animate-spin" />
      </div>
    );
  }

  // Sectie 13: owner zonder gekoppeld player-record — nette fallback, geen
  // automatisch aangemaakt profiel, geen crash.
  if (!myPlayer) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <div>
          <p className="gn-eyebrow mb-1.5">Game Night</p>
          <h1 className="gn-display text-2xl font-semibold sm:text-3xl">
            Mijn profiel
          </h1>
        </div>
        <div className="gn-panel-elevated px-6 py-8">
          <p className="gn-muted text-sm">
            Dit account is nog niet gekoppeld aan een spelersprofiel.
          </p>
          {isOwner ? (
            <Link
              to="/game-night/spelers"
              className="gn-muted mt-3 inline-block text-xs underline"
            >
              Koppel een account via Spelersbeheer
            </Link>
          ) : (
            <p className="gn-faint mt-2 text-xs">
              Vraag de eigenaar om je account te koppelen.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="gn-muted inline-flex items-center gap-1.5 text-xs underline"
        >
          <LogOut className="h-3.5 w-3.5" /> Uitloggen
        </button>
      </div>
    );
  }

  const stats = data ? buildPlayerStats(data, myPlayer.id) : null;
  const titles = data ? titlesForPlayer(data, myPlayer.id) : [];
  const activeColor = palette.find((c) => c.id === colorId);
  const ringColor = activeColor?.hex ?? myPlayer.color;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="gn-eyebrow mb-1.5">Game Night</p>
          <h1 className="gn-display text-2xl font-semibold sm:text-3xl">
            Mijn profiel
          </h1>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="gn-muted flex min-h-[44px] items-center gap-1.5 px-2 text-xs underline"
        >
          <LogOut className="h-3.5 w-3.5" /> Uitloggen
        </button>
      </div>

      <div className="gn-panel-elevated px-6 py-6 text-center">
        <span
          className="gn-player-avatar gn-player-avatar-xl mx-auto"
          style={{
            background:
              visualProps.characterId || visualProps.layers
                ? "var(--gn-bg-elevated)"
                : (ringColor ?? undefined),
            boxShadow:
              (visualProps.characterId || visualProps.layers) && ringColor
                ? `0 0 0 3px ${ringColor}`
                : undefined,
          }}
        >
          <CharacterVisual
            player={myPlayer}
            characterId={visualProps.characterId}
            layers={visualProps.layers}
            loading="eager"
          />
        </span>
        <h2 className="gn-display mt-3 text-2xl font-semibold sm:text-3xl">
          {(myPlayer.nickname ?? myPlayer.name).toUpperCase()}
        </h2>
        <p className="gn-faint mt-1 text-xs">Echte naam: {myPlayer.name}</p>
        {titles[0] && (
          <p
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: "var(--gn-brass)" }}
          >
            <Crown className="h-3.5 w-3.5" /> {titles[0].title}
          </p>
        )}

        {/* V2.9C (sectie 2/21): character samenstellen gebeurt volledig in
            de eigen Creator — hier alleen de duidelijke actie ernaartoe. */}
        <Link
          to="/game-night/me/character"
          className="gn-plaque-action mt-4 flex min-h-[48px] items-center justify-center gap-2 px-6 text-sm font-semibold"
        >
          <Sparkles className="h-4 w-4" />
          Mijn character
        </Link>
      </div>

      {/* Sectie 12: profiel aanpassen — nickname + kleur uit het actieve
          palet, opslaan via de smalle RPC (useUpdateMyProfile). */}
      <div className="gn-panel-elevated px-5 py-5">
        <p className="gn-eyebrow mb-3">Profiel aanpassen</p>

        <label className="gn-muted mb-1 block text-xs" htmlFor="gn-me-nickname">
          Nickname
        </label>
        <input
          id="gn-me-nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          className="mb-1 w-full"
          placeholder={myPlayer.name}
        />
        {!nicknameValid && (
          <p className="mb-2 text-xs text-red-500">
            Nickname mag niet leeg zijn (max {NICKNAME_MAX_LENGTH} tekens).
          </p>
        )}

        <p className="gn-muted mb-1.5 mt-3 block text-xs">Kleur</p>
        <div className="flex flex-wrap gap-2">
          {palette.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColorId(c.id)}
              aria-label={c.label ?? c.hex}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform"
              style={{
                background: c.hex,
                borderColor:
                  colorId === c.id ? "var(--gn-brass)" : "transparent",
                transform: colorId === c.id ? "scale(1.1)" : undefined,
              }}
            >
              {colorId === c.id && (
                <Check className="h-4 w-4" style={{ color: "white" }} />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!nicknameValid || !dirty || updateProfile.isPending}
          className="gn-plaque-action gn-plaque-action-primary mt-4 flex min-h-[48px] w-full items-center justify-center px-6"
        >
          <span className="gn-display text-sm font-semibold tracking-wide">
            {updateProfile.isPending
              ? "Opslaan..."
              : saved
                ? "Opgeslagen"
                : "Opslaan"}
          </span>
        </button>
        {updateProfile.isError && (
          <p className="mt-2 text-center text-xs text-red-500">
            Opslaan mislukt. Probeer het opnieuw.
          </p>
        )}
      </div>

      {stats && (
        <div className="gn-panel-elevated grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
          <div>
            <p className="gn-display text-lg font-semibold">
              {stats.gameNightsAttended}
            </p>
            <p className="gn-faint text-xs">Game Nights</p>
          </div>
          <div>
            <p className="gn-display text-lg font-semibold">
              {stats.gameSessionsPlayed}
            </p>
            <p className="gn-faint text-xs">spellen gespeeld</p>
          </div>
          <div>
            <p className="gn-display text-lg font-semibold">
              {stats.canonicalWins}
            </p>
            <p className="gn-faint text-xs">lifetime WINs</p>
          </div>
          {stats.mostPlayed && (
            <div>
              <p className="gn-display text-lg font-semibold">
                {stats.mostPlayed.count}×
              </p>
              <p className="gn-faint text-xs">{stats.mostPlayed.game.name}</p>
            </div>
          )}
        </div>
      )}

      {titles.length > 1 && (
        <div className="gn-panel-elevated px-5 py-4">
          <p className="gn-eyebrow mb-2">Titels</p>
          <div className="flex flex-wrap gap-2">
            {titles.map((t) => (
              <span key={t.title} className="gn-chip gn-chip-felt">
                {t.title}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to={`/game-night/spelers/${myPlayer.id}`}
        className="gn-muted block text-center text-xs underline"
      >
        Volledig profiel bekijken
      </Link>
    </div>
  );
}
