import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  useValidateJoinToken,
  useMyLinkedPlayer,
  useJoinViaToken,
} from "@/features/game-night/hooks/useGameNightJoin";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import {
  useCharacterEquipmentForPlayers,
  useCharacterParts,
} from "@/features/game-night/hooks/useCharacterCatalog";
import {
  characterVisualPropsFor,
  resolvePlayerCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

const NAME_MAX = 60;
const NICKNAME_MAX = 40;
const PENDING_KEY = (token: string) => `gn-join-pending-${token}`;

type PendingSignup = { name: string; nickname: string; colorId: string | null };

// Visuele consistentieronde (sectie 5/13) — dit bestand gebruikte t/m nu
// GEEN van beide Game Night-designsystemen (niet .gn-*, niet .gnv2-*): pure
// generieke site-Tailwind (`bg-primary`, kale <input>) — precies het
// "standaard webformulier"-probleem uit de opdracht. Volledig herbouwd op
// GnV2Scene/gnv2-*, zelfde primitieven als de rest van V2 (geen nieuw
// design system). "JE ZIT AAN TAFEL" toont nu het echte character
// (CharacterVisual + resolvePlayerCharacter, dezelfde bron als GameNightMe/
// Lobby — geen aparte avatarimplementatie) i.p.v. een bijna leeg houten
// scherm met alleen tekst.
//
// Bewust reachable zowel via de `!session`-tak in App.tsx (nog niet
// ingelogd — signup/login scoped aan dit ene token) als via de gewone,
// geauthenticeerde routeboom (bestaand account dat opnieuw scant). Eén
// component voor beide gevallen, vertakt op `useAuth()`.
export default function GameNightJoin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, isLoadingRole, appRole } = useAuth();
  const validation = useValidateJoinToken(token);
  const join = useJoinViaToken();
  const { data: palette = [] } = useGameNightColorPalette();

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(false);

  const [roleWarningConfirmed, setRoleWarningConfirmed] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [colorId, setColorId] = useState<string | null>(null);
  const [joinResult, setJoinResult] = useState<{
    playerId: string;
    name: string;
    nickname: string | null;
    // Sectie 5 (visuele consistentieronde): de RPC geeft dit toch al terug
    // — rechtstreeks gebruiken voor de sessie-info op "JE ZIT AAN TAFEL"
    // i.p.v. achteraf via sessionPlayers terug te zoeken (een speler die
    // eerder al bij een ANDERE Game Night was, zou daar de verkeerde/oude
    // sessie kunnen treffen).
    gameNightSessionId: string;
    // Sectie 15 (face-layer-opdracht): alleen bij een gloednieuw profiel
    // bewust naar character/face-setup wijzen — een bestaande speler die
    // opnieuw scant (hasExistingPlayer, zie hieronder) krijgt zijn normale
    // "Mijn profiel"-pad, nooit geforceerd naar setup. Puur een lokale
    // sessievlag, geen extra query nodig.
    isNewProfile: boolean;
  } | null>(null);

  // Sectie 7 (Owner)/Sectie 5 (V2.3): alleen owner/game_night_member kunnen
  // via RLS zelf checken of ze al een gekoppelde speler hebben — voor elke
  // andere rol staat door constructie al vast dat er nog geen koppeling is
  // (elke flow die auth_user_id zet, zet in dezelfde stap ook de rol).
  const canCheckExistingLink =
    appRole === "owner" || appRole === "game_night_member";
  const myLinkedPlayer = useMyLinkedPlayer(!!session && canCheckExistingLink);

  const needsRoleWarning =
    (appRole === "r6_player" || appRole === "cocktail_guest") &&
    !roleWarningConfirmed;

  // Ná een e-mailbevestigingslink keert Supabase terug op EXACT deze URL
  // (emailRedirectTo, zie handleSignup) met een verse sessie, maar een
  // volledige page reload — lokale React-state van vóór het versturen is
  // dan weg. sessionStorage overleeft die reload wél, dus de eerder
  // ingevoerde naam/nickname/kleur worden hier automatisch hervat en de
  // join direct afgerond, zonder dat de gebruiker alles opnieuw hoeft in
  // te typen.
  const hasExistingPlayer = canCheckExistingLink && !!myLinkedPlayer.data;

  // Eén effect voor beide automatische-join-gevallen (sectie 15: bestaande
  // speler met account; e-mailbevestiging-hervatting hierboven) — een
  // mutation nooit tijdens render zelf starten, alleen via een effect.
  useEffect(() => {
    if (!session || !token || join.isPending || join.isSuccess) return;
    if (needsRoleWarning) return;
    if (canCheckExistingLink && myLinkedPlayer.isLoading) return;

    if (hasExistingPlayer) {
      join
        .mutateAsync({ token, confirmRoleReplacement: roleWarningConfirmed })
        .then((r) =>
          setJoinResult({
            playerId: r.playerId,
            name: r.name,
            nickname: r.nickname,
            gameNightSessionId: r.gameNightSessionId,
            isNewProfile: false,
          }),
        )
        .catch(() => {
          /* join.isError toont de melding */
        });
      return;
    }

    const raw = sessionStorage.getItem(PENDING_KEY(token));
    if (!raw) return;
    let pending: PendingSignup;
    try {
      pending = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(PENDING_KEY(token));
      return;
    }
    sessionStorage.removeItem(PENDING_KEY(token));
    join
      .mutateAsync({
        token,
        newPlayer: {
          name: pending.name,
          nickname: pending.nickname,
          colorId: pending.colorId,
        },
        confirmRoleReplacement: roleWarningConfirmed,
      })
      .then((r) =>
        setJoinResult({
          playerId: r.playerId,
          name: r.name,
          nickname: r.nickname,
          gameNightSessionId: r.gameNightSessionId,
          isNewProfile: true,
        }),
      )
      .catch(() => {
        // Stil falen hier is prima — de gewone "nieuw profiel"-vorm
        // hieronder verschijnt dan alsnog als fallback.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session,
    token,
    needsRoleWarning,
    canCheckExistingLink,
    myLinkedPlayer.isLoading,
    hasExistingPlayer,
    roleWarningConfirmed,
  ]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setAuthError("E-mail of wachtwoord klopt niet.");
    setAuthLoading(false);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setAuthError("Naam is verplicht.");
      return;
    }
    setAuthLoading(true);
    if (token) {
      sessionStorage.setItem(
        PENDING_KEY(token),
        JSON.stringify({
          name: trimmedName,
          nickname: nickname.trim() || trimmedName,
          colorId,
        } satisfies PendingSignup),
      );
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) {
      setAuthError(error.message);
      if (token) sessionStorage.removeItem(PENDING_KEY(token));
      setAuthLoading(false);
      return;
    }
    if (!data.session) {
      // E-mailbevestiging vereist — de pending-data staat al klaar in
      // sessionStorage voor wanneer de gebruiker terugkeert via de link.
      setPendingEmailConfirm(true);
    }
    setAuthLoading(false);
  }

  if (!token || validation.isLoading) {
    return <GnV2Loading />;
  }

  if (!validation.data?.valid) {
    return (
      <GnV2Scene className="gnv2-join-scene">
        <div className="gnv2-join-center">
          <div className="gnv2-join-card gnv2-join-card-narrow">
            <p className="gnv2-dialog-title text-lg">
              Deze uitnodiging is verlopen
            </p>
            <p className="gnv2-dialog-muted text-sm">
              Vraag de gastheer/gastvrouw om de QR-code opnieuw te tonen.
            </p>
          </div>
        </div>
      </GnV2Scene>
    );
  }

  if (pendingEmailConfirm) {
    return (
      <GnV2Scene className="gnv2-join-scene">
        <div className="gnv2-join-center">
          <div className="gnv2-join-card gnv2-join-card-narrow">
            <p className="gnv2-dialog-title text-lg">Check je e-mail</p>
            <p className="gnv2-dialog-muted text-sm">
              We hebben een bevestigingslink gestuurd naar {email}. Klik erop om
              direct aan tafel te komen bij {validation.data.gameNightName}.
            </p>
          </div>
        </div>
      </GnV2Scene>
    );
  }

  if (!session) {
    return (
      <GnV2Scene className="gnv2-join-scene">
        <div className="gnv2-join-center">
          <div className="gnv2-join-card">
            <div className="text-center">
              <p className="gnv2-identity-eyebrow">Je bent uitgenodigd voor</p>
              <p className="gnv2-dialog-title mt-1 text-2xl">
                {validation.data.gameNightName}
              </p>
            </div>

            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`gnv2-btn px-4 py-2 text-xs ${authMode === "login" ? "gnv2-creator-tab-active" : "gnv2-btn-ghost"}`}
              >
                Inloggen
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`gnv2-btn px-4 py-2 text-xs ${authMode === "signup" ? "gnv2-creator-tab-active" : "gnv2-btn-ghost"}`}
              >
                Nieuw account
              </button>
            </div>

            {authMode === "login" ? (
              <form onSubmit={handleLogin} className="mt-5 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mailadres"
                  required
                  autoComplete="email"
                  className="gnv2-input"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Wachtwoord"
                  required
                  autoComplete="current-password"
                  className="gnv2-input"
                />
                {authError && (
                  <p className="text-sm text-red-400">{authError}</p>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="gnv2-btn gnv2-btn-primary w-full"
                >
                  {authLoading ? "Bezig..." : "Inloggen en aan tafel"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="mt-5 space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Je naam"
                  required
                  maxLength={NAME_MAX}
                  className="gnv2-input"
                />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nickname (optioneel, standaard = naam)"
                  maxLength={NICKNAME_MAX}
                  className="gnv2-input"
                />
                {palette.length > 0 && (
                  <ColorPalettePicker
                    palette={palette}
                    colorId={colorId}
                    onSelect={setColorId}
                  />
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mailadres"
                  required
                  autoComplete="email"
                  className="gnv2-input"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kies een wachtwoord"
                  required
                  autoComplete="new-password"
                  minLength={6}
                  className="gnv2-input"
                />
                {authError && (
                  <p className="text-sm text-red-400">{authError}</p>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="gnv2-btn gnv2-btn-primary w-full"
                >
                  {authLoading ? "Bezig..." : "Account maken en aan tafel"}
                </button>
              </form>
            )}
          </div>
        </div>
      </GnV2Scene>
    );
  }

  if (isLoadingRole || (canCheckExistingLink && myLinkedPlayer.isLoading)) {
    return <GnV2Loading />;
  }

  // Sectie 32: single-role-waarschuwing vóór provisioning — nooit stil
  // overschrijven.
  if (needsRoleWarning) {
    return (
      <GnV2Scene className="gnv2-join-scene">
        <div className="gnv2-join-center">
          <div className="gnv2-join-card gnv2-join-card-narrow">
            <p className="gnv2-dialog-title text-lg">
              Let op: bestaande toegang
            </p>
            <p className="gnv2-dialog-muted text-sm">
              Je account heeft al toegang tot een andere afgeschermde pagina.
              Game Night gebruikt voorlopig één toegangsrol per account —
              doorgaan vervangt die toegang door Game Night.
            </p>
            <div className="mt-4 flex justify-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="gnv2-btn gnv2-btn-ghost"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => setRoleWarningConfirmed(true)}
                className="gnv2-btn gnv2-btn-primary"
              >
                Doorgaan
              </button>
            </div>
          </div>
        </div>
      </GnV2Scene>
    );
  }

  if (joinResult) {
    return <JoinSuccessScreen joinResult={joinResult} />;
  }

  if (hasExistingPlayer) {
    // Bestaande speler met account (sectie 15) — het effect hierboven start
    // de join automatisch, hier alleen de laadstatus tonen.
    return (
      <GnV2Scene className="gnv2-join-scene">
        <div className="gnv2-join-center">
          <div className="gnv2-join-card gnv2-join-card-narrow text-center">
            <p className="gnv2-dialog-muted text-sm">
              Je wordt aan tafel gezet...
            </p>
            {join.isError && (
              <p className="mt-2 text-sm text-red-400">
                {(join.error as Error).message}
              </p>
            )}
          </div>
        </div>
      </GnV2Scene>
    );
  }

  // Nieuw profiel (sectie 16/18) — geldt voor: gloednieuwe accounts,
  // eerder ontkoppelde (no_access) accounts, en owner zonder eigen player.
  // Bewust GEEN "claim een bestaand ongekoppeld profiel"-stap in V2.4 (zie
  // opleverrapport) — voorkomt elk risico op een verkeerde/ongewilde claim
  // zonder een apart bevestigingsmechanisme te hoeven bouwen.
  async function handleNewPlayer(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !token) return;
    try {
      const r = await join.mutateAsync({
        token,
        newPlayer: {
          name: trimmed,
          nickname: nickname.trim() || trimmed,
          colorId,
        },
        confirmRoleReplacement: roleWarningConfirmed,
      });
      setJoinResult({
        playerId: r.playerId,
        name: r.name,
        nickname: r.nickname,
        gameNightSessionId: r.gameNightSessionId,
        isNewProfile: true,
      });
    } catch {
      // join.isError toont de melding hieronder
    }
  }

  return (
    <GnV2Scene className="gnv2-join-scene">
      <div className="gnv2-join-center">
        <form onSubmit={handleNewPlayer} className="gnv2-join-card space-y-3">
          <div className="text-center">
            <p className="gnv2-identity-eyebrow">Wie ben jij?</p>
            <p className="gnv2-dialog-title mt-1 text-xl">
              {validation.data.gameNightName}
            </p>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Je naam"
            required
            maxLength={NAME_MAX}
            className="gnv2-input"
          />
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname (optioneel)"
            maxLength={NICKNAME_MAX}
            className="gnv2-input"
          />
          {palette.length > 0 && (
            <ColorPalettePicker
              palette={palette}
              colorId={colorId}
              onSelect={setColorId}
            />
          )}
          {join.isError && (
            <p className="text-sm text-red-400">
              {(join.error as Error).message}
            </p>
          )}
          <button
            type="submit"
            disabled={join.isPending}
            className="gnv2-btn gnv2-btn-primary w-full"
          >
            {join.isPending ? "Bezig..." : "Aan tafel!"}
          </button>
        </form>
      </div>
    </GnV2Scene>
  );
}

// Kleurenpalet — zelfde ronde swatch-knoppen als voorheen, uitsluitend
// hergekleurd naar de gnv2-tokens (was hardcoded `#000`/`text-white`, nu
// consistent met de rest van V2). Eigen klein component i.p.v. inline
// gedupliceerd op de twee plekken (login/signup-formulier + nieuw-profiel-
// formulier) die dit nodig hebben.
function ColorPalettePicker({
  palette,
  colorId,
  onSelect,
}: {
  palette: { id: string; hex: string; label: string | null }[];
  colorId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {palette.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          aria-label={c.label ?? c.hex}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 transition-transform"
          style={{
            background: c.hex,
            borderColor:
              colorId === c.id ? "var(--gnv2-accent-warm)" : "transparent",
            transform: colorId === c.id ? "scale(1.08)" : undefined,
          }}
        >
          {colorId === c.id && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
    </div>
  );
}

// "JE ZIT AAN TAFEL" (sectie 5) — het character is hier het visuele
// hoofdelement, niet langer een bijna leeg houten scherm. Haalt de zojuist
// aangemaakte/bevestigde speler op via de AL BESTAANDE analytics-bundel
// (useGameNightAnalytics — dezelfde bron als GameNightMe.tsx) i.p.v. de
// join-RPC zelf uit te breiden: face/character/equipment leven daar al,
// geen reden om de RPC-contract aan te passen voor deze puur presentationele
// behoefte. Een gloednieuw profiel heeft meestal nog geen face/character
// ingesteld — CharacterVisual valt dan simpelweg terug op de bestaande
// initiaal-fallback, exact zoals overal elders.
function JoinSuccessScreen({
  joinResult,
}: {
  joinResult: {
    playerId: string;
    name: string;
    nickname: string | null;
    gameNightSessionId: string;
    isNewProfile: boolean;
  };
}) {
  const { data: analyticsData } = useGameNightAnalytics();
  const { data: parts = [] } = useCharacterParts();
  const player = analyticsData?.players.find(
    (p) => p.id === joinResult.playerId,
  );
  const { data: equipment = [] } = useCharacterEquipmentForPlayers(
    player ? [player.id] : [],
  );
  const partsById = new Map(parts.map((p) => [p.id, p]));
  const resolved = player
    ? resolvePlayerCharacter(player, equipment, partsById)
    : undefined;
  const visualProps = characterVisualPropsFor(resolved);
  const session = analyticsData?.sessions.find(
    (s) => s.id === joinResult.gameNightSessionId,
  );

  return (
    <GnV2Scene className="gnv2-join-scene">
      <div className="gnv2-join-center">
        <div className="gnv2-join-card gnv2-join-success text-center">
          <p className="gnv2-identity-eyebrow">Game Night</p>
          {player ? (
            <div
              className="gnv2-creator-preview-frame mx-auto mt-3"
              style={{
                ["--gnv2-ring" as string]: "var(--gnv2-accent-warm)",
              }}
            >
              <CharacterVisual
                player={player}
                characterId={visualProps.characterId}
                layers={visualProps.layers}
                loading="eager"
              />
            </div>
          ) : (
            <div className="gnv2-loading-pulse mx-auto mt-4" aria-hidden />
          )}
          <p className="gnv2-dialog-title mt-4 text-2xl">JE ZIT AAN TAFEL</p>
          <p className="gnv2-dialog-muted mt-1 text-sm">
            {joinResult.nickname ?? joinResult.name}
          </p>
          {session && (
            <p className="gnv2-dialog-faint text-xs">
              {session.name ?? "Game Night"} ·{" "}
              {new Date(session.started_at).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
              })}
            </p>
          )}

          {joinResult.isNewProfile ? (
            <div className="mt-5 flex flex-col items-center gap-2">
              <Link
                to="/game-night/me/face"
                className="gnv2-btn gnv2-btn-primary w-full"
              >
                <Sparkles className="h-4 w-4" />
                Maak je character
              </Link>
              <Link to="/game-night/me" className="gnv2-dialog-cancel-link">
                Overslaan, naar mijn profiel
              </Link>
            </div>
          ) : (
            <Link
              to="/game-night/me"
              className="gnv2-btn gnv2-btn-primary mt-5 w-full"
            >
              Mijn profiel
            </Link>
          )}
        </div>
      </div>
    </GnV2Scene>
  );
}
