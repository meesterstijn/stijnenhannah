import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Loader2, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  useValidateJoinToken,
  useMyLinkedPlayer,
  useJoinViaToken,
} from "@/features/game-night/hooks/useGameNightJoin";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";

const NAME_MAX = 60;
const NICKNAME_MAX = 40;
const PENDING_KEY = (token: string) => `gn-join-pending-${token}`;

type PendingSignup = { name: string; nickname: string; colorId: string | null };

// Game Night V2.4 — /game-night/join/:token (sectie 12-18). Bewust reachable
// zowel via de `!session`-tak in App.tsx (nog niet ingelogd — signup/login
// scoped aan dit ene token) als via de gewone, geauthenticeerde routeboom
// (bestaand account dat opnieuw scant). Eén component voor beide gevallen,
// vertakt op `useAuth()`.
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
    name: string;
    nickname: string | null;
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
        .then((r) => setJoinResult({ name: r.name, nickname: r.nickname }))
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
      .then((r) => setJoinResult({ name: r.name, nickname: r.nickname }))
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!validation.data?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-xl font-semibold">
            Deze uitnodiging is verlopen
          </h1>
          <p className="text-sm text-muted-foreground">
            Vraag de gastheer/gastvrouw om de QR-code opnieuw te tonen.
          </p>
        </div>
      </div>
    );
  }

  if (pendingEmailConfirm) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-xl font-semibold">Check je e-mail</h1>
          <p className="text-sm text-muted-foreground">
            We hebben een bevestigingslink gestuurd naar {email}. Klik erop om
            direct aan tafel te komen bij {validation.data.gameNightName}.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Je bent uitgenodigd voor
            </p>
            <h1 className="text-2xl font-semibold">
              {validation.data.gameNightName}
            </h1>
          </div>

          <div className="flex justify-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={
                authMode === "login"
                  ? "font-semibold underline"
                  : "text-muted-foreground"
              }
            >
              Inloggen
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={
                authMode === "signup"
                  ? "font-semibold underline"
                  : "text-muted-foreground"
              }
            >
              Nieuw account
            </button>
          </div>

          {authMode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mailadres"
                required
                autoComplete="email"
                className="w-full"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wachtwoord"
                required
                autoComplete="current-password"
                className="w-full"
              />
              {authError && <p className="text-sm text-red-500">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="min-h-[48px] w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {authLoading ? "Bezig..." : "Inloggen en aan tafel"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Je naam"
                required
                maxLength={NAME_MAX}
                className="w-full"
              />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname (optioneel, standaard = naam)"
                maxLength={NICKNAME_MAX}
                className="w-full"
              />
              {palette.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {palette.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColorId(c.id)}
                      aria-label={c.label ?? c.hex}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2"
                      style={{
                        background: c.hex,
                        borderColor: colorId === c.id ? "#000" : "transparent",
                      }}
                    >
                      {colorId === c.id && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mailadres"
                required
                autoComplete="email"
                className="w-full"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kies een wachtwoord"
                required
                autoComplete="new-password"
                minLength={6}
                className="w-full"
              />
              {authError && <p className="text-sm text-red-500">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="min-h-[48px] w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {authLoading ? "Bezig..." : "Account maken en aan tafel"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (isLoadingRole || (canCheckExistingLink && myLinkedPlayer.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sectie 32: single-role-waarschuwing vóór provisioning — nooit stil
  // overschrijven.
  if (needsRoleWarning) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-lg font-semibold">Let op: bestaande toegang</h1>
          <p className="text-sm text-muted-foreground">
            Je account heeft al toegang tot een andere afgeschermde pagina. Game
            Night gebruikt voorlopig één toegangsrol per account — doorgaan
            vervangt die toegang door Game Night.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={() => setRoleWarningConfirmed(true)}
              className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Doorgaan
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (joinResult) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-semibold">JE ZIT AAN TAFEL</h1>
          <p className="text-muted-foreground">
            {joinResult.nickname ?? joinResult.name} ·{" "}
            {validation.data.gameNightName}
          </p>
          <Link
            to="/game-night/me"
            className="mt-2 inline-block min-h-[48px] rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Mijn profiel
          </Link>
        </div>
      </div>
    );
  }

  if (hasExistingPlayer) {
    // Bestaande speler met account (sectie 15) — het effect hierboven start
    // de join automatisch, hier alleen de laadstatus tonen.
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm space-y-3 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Je wordt aan tafel gezet...
          </p>
          {join.isError && (
            <p className="text-sm text-red-500">
              {(join.error as Error).message}
            </p>
          )}
        </div>
      </div>
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
      setJoinResult({ name: r.name, nickname: r.nickname });
    } catch {
      // join.isError toont de melding hieronder
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleNewPlayer} className="w-full max-w-sm space-y-3">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Wie ben jij?</p>
          <h1 className="text-xl font-semibold">
            {validation.data.gameNightName}
          </h1>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Je naam"
          required
          maxLength={NAME_MAX}
          className="w-full"
        />
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Nickname (optioneel)"
          maxLength={NICKNAME_MAX}
          className="w-full"
        />
        {palette.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {palette.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColorId(c.id)}
                aria-label={c.label ?? c.hex}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2"
                style={{
                  background: c.hex,
                  borderColor: colorId === c.id ? "#000" : "transparent",
                }}
              >
                {colorId === c.id && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        )}
        {join.isError && (
          <p className="text-sm text-red-500">
            {(join.error as Error).message}
          </p>
        )}
        <button
          type="submit"
          disabled={join.isPending}
          className="min-h-[48px] w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {join.isPending ? "Bezig..." : "Aan tafel!"}
        </button>
      </form>
    </div>
  );
}
