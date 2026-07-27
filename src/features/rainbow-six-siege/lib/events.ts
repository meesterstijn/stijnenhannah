import { supabase } from "@/lib/supabase";
import type { R6Event, R6Match } from "@/features/rainbow-six-siege/types";

export async function fetchR6Events(sessionId: string): Promise<R6Event[]> {
  const { data, error } = await supabase
    .from("r6_events")
    .select("id, session_id, match_id, player_id, score_rule_code, points_awarded, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as R6Event[];
}

/** Bulk-variant voor meerdere sessies tegelijk (bv. de historielijst) —
 * zelfde reden als fetchR6DataForSessions: één query i.p.v. N+1. */
export async function fetchR6EventsForSessions(sessionIds: string[]): Promise<R6Event[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("r6_events")
    .select("id, session_id, match_id, player_id, score_rule_code, points_awarded, created_at")
    .in("session_id", sessionIds);
  if (error) throw error;
  return (data ?? []) as R6Event[];
}

/**
 * Eén tik = één insert. `points_awarded` wordt bewust NIET meegestuurd —
 * de database-trigger (set_r6_event_points) vult dat altijd zelf in vanuit
 * de actuele r6_score_rules-rij, zodat de client nooit een verouderde of
 * gemanipuleerde puntenwaarde kan laten gelden.
 */
export async function recordR6Event(input: {
  sessionId: string;
  matchId: string;
  playerId: string;
  scoreRuleCode: string;
}): Promise<R6Event> {
  const { data, error } = await supabase
    .from("r6_events")
    .insert({
      session_id: input.sessionId,
      match_id: input.matchId,
      player_id: input.playerId,
      score_rule_code: input.scoreRuleCode,
    })
    .select("id, session_id, match_id, player_id, score_rule_code, points_awarded, created_at")
    .single();
  if (error) throw error;
  return data as R6Event;
}

/** "Ongedaan maken" van een mistik — verwijdert de gebeurtenis-rij. Events
 * zijn een onveranderlijk log, dus corrigeren betekent verwijderen, niet
 * wijzigen. */
export async function deleteR6Event(eventId: string): Promise<void> {
  const { error } = await supabase.from("r6_events").delete().eq("id", eventId);
  if (error) throw error;
}

/** Meest recente ronde (hoogste match_number) van een sessie, of null als
 * er nog geen enkele ronde is. */
export async function fetchLatestR6Match(sessionId: string): Promise<R6Match | null> {
  const { data, error } = await supabase
    .from("r6_matches")
    .select(
      "id, session_id, match_number, played_at, map_id, result, challenge_id, challenge_completed, chaos_rule, funniest_moment, notes, mvp_player_id, mvp_reason, mvp_points, created_at",
    )
    .eq("session_id", sessionId)
    .order("match_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as R6Match | null) ?? null;
}

/**
 * Start een nieuwe ronde: een kale r6_matches-rij (geen map/spelersstats
 * vooraf nodig — dat is precies het punt van de live-tik-flow). Een
 * gewone insert volstaat, geen RPC nodig: match_number wordt al door de
 * bestaande trigger (set_r6_match_number, fase 2) automatisch gezet, en de
 * bestaande RLS-insertpolicy (alleen bij status='live') geldt hier net zo
 * goed.
 */
export async function startR6Round(sessionId: string): Promise<R6Match> {
  const { data, error } = await supabase
    .from("r6_matches")
    .insert({ session_id: sessionId })
    .select(
      "id, session_id, match_number, played_at, map_id, result, challenge_id, challenge_completed, chaos_rule, funniest_moment, notes, mvp_player_id, mvp_reason, mvp_points, created_at",
    )
    .single();
  if (error) throw error;
  return data as R6Match;
}
