import { supabase } from "@/lib/supabase";
import type { R6GameOperatorAssignment } from "@/features/rainbow-six-siege/types";

const ASSIGNMENT_COLUMNS =
  "id, session_id, match_id, player_id, attacker_operator_id, defender_operator_id, created_at, updated_at";

export async function fetchR6GameOperatorAssignments(matchId: string): Promise<R6GameOperatorAssignment[]> {
  const { data, error } = await supabase
    .from("r6_game_operator_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("match_id", matchId);
  if (error) throw error;
  return (data ?? []) as R6GameOperatorAssignment[];
}

/** Bulk-fetch voor Geschiedenis/Statistieken — alle toewijzingen van
 * meerdere games tegelijk, i.p.v. N+1 per game. */
export async function fetchR6GameOperatorAssignmentsForMatches(matchIds: string[]): Promise<R6GameOperatorAssignment[]> {
  if (matchIds.length === 0) return [];
  const { data, error } = await supabase
    .from("r6_game_operator_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .in("match_id", matchIds);
  if (error) throw error;
  return (data ?? []) as R6GameOperatorAssignment[];
}

/**
 * Slaat de toewijzingen van alle spelers voor precies deze game in één keer
 * op — "opnieuw verdelen" is tot dit punt pure lokale state (zie
 * R6OperatorWheel), pas "Accepteren" roept dit aan. `unique (match_id,
 * player_id)` in de database maakt dit een echte upsert: een tweede keer
 * accepteren voor dezelfde game overschrijft de vorige toewijzing i.p.v. een
 * dubbele rij te maken.
 */
export async function saveR6GameOperatorAssignments(
  assignments: {
    sessionId: string;
    matchId: string;
    playerId: string;
    attackerOperatorId: string | null;
    defenderOperatorId: string | null;
  }[],
): Promise<void> {
  if (assignments.length === 0) return;
  const { error } = await supabase.from("r6_game_operator_assignments").upsert(
    assignments.map((a) => ({
      session_id: a.sessionId,
      match_id: a.matchId,
      player_id: a.playerId,
      attacker_operator_id: a.attackerOperatorId,
      defender_operator_id: a.defenderOperatorId,
    })),
    { onConflict: "match_id,player_id" },
  );
  if (error) throw error;
}
