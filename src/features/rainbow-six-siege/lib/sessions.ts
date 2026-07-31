import { supabase } from "@/lib/supabase";
import { deleteR6SessionStorageFilesOrThrow, fetchR6SessionMedia } from "@/features/rainbow-six-siege/lib/media";
import { fetchR6Events, fetchR6EventsForSessions } from "@/features/rainbow-six-siege/lib/events";
import type {
  R6Event,
  R6Match,
  R6MatchPlayer,
  R6NewMatchInput,
  R6Session,
  R6SessionDetail,
  R6SessionPlayer,
  R6UpdateMatchInput,
} from "@/features/rainbow-six-siege/types";

const SESSION_COLUMNS = "id, name, started_at, ended_at, status, notes, created_by, created_at";
const MATCH_COLUMNS =
  "id, session_id, match_number, played_at, map_id, result, challenge_id, challenge_completed, chaos_rule, funniest_moment, notes, mvp_player_id, mvp_reason, mvp_points, created_at, updated_at";
const MATCH_PLAYER_COLUMNS =
  "id, match_id, player_id, operator_attacker_id, operator_defender_id, operator_single_id, kills, deaths, assists, revives, headshots, clutch, ace, created_at";

export async function fetchR6Sessions(): Promise<R6Session[]> {
  const { data, error } = await supabase.from("r6_sessions").select(SESSION_COLUMNS).order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as R6Session[];
}

export async function fetchActiveR6Session(): Promise<R6Session | null> {
  const { data, error } = await supabase
    .from("r6_sessions")
    .select(SESSION_COLUMNS)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as R6Session | null) ?? null;
}

/**
 * Alle sessies met status 'live' (dezelfde definitie van "actief" als
 * fetchActiveR6Session hierboven — géén nieuwe statuswaarde), deterministisch
 * gesorteerd: meest recent gestart eerst, dan created_at, dan id. Normaliter
 * precies 0 of 1 rij; bij foutieve data (per ongeluk meerdere live-sessies,
 * bv. door een handmatige databasewijziging) geeft dit de aanroeper
 * (useR6ActiveSessionWatch, voor de permanente Big Screen-route) de kans om
 * dat te signaleren en toch deterministisch de meest recente te kiezen —
 * fetchActiveR6Session zelf blijft ongewijzigd (die gebruikt `.single()`-
 * achtig gedrag en is elders al in gebruik).
 */
export async function fetchActiveR6Sessions(): Promise<R6Session[]> {
  const { data, error } = await supabase
    .from("r6_sessions")
    .select(SESSION_COLUMNS)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as R6Session[];
}

async function fetchMatchPlayersForMatchIds(matchIds: string[]): Promise<R6MatchPlayer[]> {
  if (matchIds.length === 0) return [];
  const { data, error } = await supabase.from("r6_match_players").select(MATCH_PLAYER_COLUMNS).in("match_id", matchIds);
  if (error) throw error;
  return (data ?? []) as R6MatchPlayer[];
}

export async function fetchR6SessionDetail(sessionId: string): Promise<R6SessionDetail> {
  const [{ data: session, error: sessionError }, { data: sessionPlayers, error: playersError }, { data: matches, error: matchesError }] =
    await Promise.all([
      supabase.from("r6_sessions").select(SESSION_COLUMNS).eq("id", sessionId).single(),
      supabase
        .from("r6_session_players")
        .select("id, session_id, player_id, created_at, player:r6_players(id, name, created_at)")
        .eq("session_id", sessionId)
        .order("join_order", { ascending: true }),
      supabase.from("r6_matches").select(MATCH_COLUMNS).eq("session_id", sessionId).order("match_number", { ascending: true }),
    ]);

  if (sessionError) throw sessionError;
  if (playersError) throw playersError;
  if (matchesError) throw matchesError;

  const [matchPlayers, events] = await Promise.all([
    fetchMatchPlayersForMatchIds((matches ?? []).map((m) => m.id)),
    fetchR6Events(sessionId),
  ]);

  return {
    session: session as R6Session,
    sessionPlayers: (sessionPlayers ?? []) as unknown as R6SessionPlayer[],
    matches: (matches ?? []) as R6Match[],
    matchPlayers,
    events,
  };
}

/**
 * Bulk-fetch van matches + match_players + session_players voor meerdere
 * sessies tegelijk (bv. alle afgeronde LAN's in de historie) — één set
 * queries in plaats van N+1 per sessiekaart, daarna client-side per
 * session_id gegroepeerd voor computeScoreboard.
 */
export async function fetchR6DataForSessions(sessionIds: string[]): Promise<{
  matches: R6Match[];
  matchPlayers: R6MatchPlayer[];
  sessionPlayers: R6SessionPlayer[];
  events: R6Event[];
}> {
  if (sessionIds.length === 0) {
    return { matches: [], matchPlayers: [], sessionPlayers: [], events: [] };
  }

  const [{ data: matches, error: matchesError }, { data: sessionPlayers, error: playersError }] = await Promise.all([
    supabase.from("r6_matches").select(MATCH_COLUMNS).in("session_id", sessionIds),
    supabase
      .from("r6_session_players")
      .select("id, session_id, player_id, created_at, player:r6_players(id, name, created_at)")
      .in("session_id", sessionIds)
      .order("join_order", { ascending: true }),
  ]);
  if (matchesError) throw matchesError;
  if (playersError) throw playersError;

  const [matchPlayers, events] = await Promise.all([
    fetchMatchPlayersForMatchIds((matches ?? []).map((m) => m.id)),
    fetchR6EventsForSessions(sessionIds),
  ]);

  return {
    matches: (matches ?? []) as R6Match[],
    matchPlayers,
    sessionPlayers: (sessionPlayers ?? []) as unknown as R6SessionPlayer[],
    events,
  };
}

export async function createR6Session(input: {
  name: string;
  startedAt: string;
  playerNames: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_r6_session", {
    p_name: input.name,
    p_started_at: input.startedAt,
    p_player_names: input.playerNames,
  });
  if (error) throw error;
  return (data as { session_id: string }).session_id;
}

/** Naam/datum/notities van een lopende LAN aanpassen — geblokkeerd op
 * databaseniveau (trigger) zodra de sessie is afgerond. */
export async function updateR6SessionDetails(input: {
  sessionId: string;
  name: string;
  startedAt: string;
  notes: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("r6_sessions")
    .update({ name: input.name, started_at: input.startedAt, notes: input.notes })
    .eq("id", input.sessionId);
  if (error) throw error;
}

export async function endR6Session(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("r6_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function reopenR6Session(sessionId: string): Promise<void> {
  const { error } = await supabase.from("r6_sessions").update({ status: "live", ended_at: null }).eq("id", sessionId);
  if (error) throw error;
}

export async function createR6Match(input: R6NewMatchInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_r6_match", {
    p_session_id: input.session_id,
    p_map_id: input.map_id,
    p_players: input.players,
    p_challenge_id: input.challenge_id,
    p_challenge_completed: input.challenge_completed,
    p_chaos_rule: input.chaos_rule,
    p_funniest_moment: input.funniest_moment,
    p_notes: input.notes,
    p_result: input.result,
    p_mvp_player_id: input.mvp_player_id,
    p_mvp_reason: input.mvp_reason,
    p_mvp_points: input.mvp_points,
  });
  if (error) throw error;
  return data as string;
}

export async function updateR6Match(input: R6UpdateMatchInput): Promise<void> {
  const { error } = await supabase.rpc("update_r6_match", {
    p_match_id: input.match_id,
    p_map_id: input.map_id,
    p_players: input.players,
    p_challenge_id: input.challenge_id,
    p_challenge_completed: input.challenge_completed,
    p_chaos_rule: input.chaos_rule,
    p_funniest_moment: input.funniest_moment,
    p_notes: input.notes,
    p_result: input.result,
    p_mvp_player_id: input.mvp_player_id,
    p_mvp_reason: input.mvp_reason,
    p_mvp_points: input.mvp_points,
  });
  if (error) throw error;
}

/**
 * Undo van een MVP-toekenning ("Laatste actie ongedaan maken", zie
 * useR6UndoLastAction) — zet alleen de drie mvp_*-kolommen terug naar hun
 * lege waarde. Bewust GEEN gebruik van update_r6_match: die RPC vervangt bij
 * elke aanroep ALLE r6_match_players-rijen van de match (delete + insert,
 * zie de migraties), wat voor een pure MVP-undo een onnodig risico zou
 * introduceren op het stilzwijgend wissen van kills/deaths/headshots/etc.
 * van die match als de meegestuurde spelerslijst ook maar licht afwijkt van
 * de opgeslagen rijen. Een rechtstreekse, minimale kolomupdate raakt
 * match_players helemaal niet aan. Zelfde live-only-bescherming als de rest
 * van dit schema geldt hier al via de bestaande "update matches in live
 * sessions"-RLS-policy (20260806020000) — geen aparte RPC/policy nodig.
 */
export async function undoR6MatchMvp(matchId: string): Promise<void> {
  const { error } = await supabase
    .from("r6_matches")
    .update({ mvp_player_id: null, mvp_reason: null, mvp_points: null })
    .eq("id", matchId);
  if (error) throw error;
}

/** Cascade (ON DELETE CASCADE op r6_match_players) ruimt de bijbehorende
 * spelerrijen op; de RLS-policy op r6_matches weigert dit al zodra de
 * sessie niet meer live is. */
export async function deleteR6Match(matchId: string): Promise<void> {
  const { error } = await supabase.from("r6_matches").delete().eq("id", matchId);
  if (error) throw error;
}

export async function addR6SessionPlayer(sessionId: string, playerName: string): Promise<string> {
  const { data, error } = await supabase.rpc("add_r6_session_player", {
    p_session_id: sessionId,
    p_player_name: playerName,
  });
  if (error) throw error;
  return data as string;
}

export async function removeR6SessionPlayer(sessionId: string, playerId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_r6_session_player", {
    p_session_id: sessionId,
    p_player_id: playerId,
  });
  if (error) throw error;
}

/**
 * Verwijdert een volledige LAN-sessie.
 *
 * Volgorde is opzettelijk: (1) lees alle storage_path-waarden, (2)
 * verwijder de Storage-bestanden en wacht de bevestiging af, (3) verwijder
 * pas ná een succesvolle Storage-opruiming de sessierij zelf — cascade in
 * Postgres kan Storage niet bereiken, dus dat moet hier expliciet. Als
 * stap 2 faalt, gooien we de fout door en gebeurt stap 3 NIET: de sessie
 * (en dus ook de r6_session_media-rijen die naar de nog-bestaande
 * bestanden verwijzen) blijft dan bestaan, in plaats van dat we
 * databaserijen verwijderen terwijl de bijbehorende bestanden mogelijk nog
 * in Storage staan.
 *
 * Eerlijke beperking: dit is GEEN atomaire transactie over database én
 * Storage heen — dat is met de normale Supabase-client niet mogelijk. Als
 * de Storage-verwijdering wél lukt maar de daaropvolgende
 * databaseverwijdering (stap 3) om een andere reden faalt (bv. netwerk-
 * onderbreking), blijven de databaserijen bestaan terwijl hun bestanden al
 * weg zijn — de gebruiker kan de verwijdering dan gewoon opnieuw proberen
 * (deleteR6SessionStorageFilesOrThrow met een lege lijst is een no-op). Wij
 * kunnen dus niet garanderen dat verweesde Storage-bestanden onmogelijk
 * zijn, alleen dat we ze actief proberen te voorkomen en nooit stilzwijgend
 * doorgaan wanneer de opruiming aantoonbaar mislukt is.
 *
 * Alle overige data (matches, match_players, session_players,
 * session_challenges, session_chaos_effects, session_media-rijen) ruimt
 * Postgres na stap 3 zelf op via ON DELETE CASCADE op session_id. Spelers
 * (r6_players) zijn NIET aan een sessie gekoppeld via cascade in die
 * richting — r6_session_players.player_id verwijst naar r6_players, niet
 * andersom — dus lifetime-spelers blijven altijd bestaan.
 */
export async function deleteR6Session(sessionId: string): Promise<void> {
  const mediaRows = await fetchR6SessionMedia(sessionId);
  if (mediaRows.length > 0) {
    try {
      await deleteR6SessionStorageFilesOrThrow(mediaRows.map((row) => row.storage_path));
    } catch (err) {
      throw new Error(
        `De LAN is niet verwijderd: opruimen van foto's uit Storage is mislukt (${
          err instanceof Error ? err.message : "onbekende fout"
        }). Probeer het opnieuw.`,
      );
    }
  }
  const { error } = await supabase.from("r6_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}
