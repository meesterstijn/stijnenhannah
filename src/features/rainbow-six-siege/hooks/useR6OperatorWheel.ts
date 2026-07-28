import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchR6GameOperatorAssignments,
  fetchR6GameOperatorAssignmentsForMatches,
  saveR6GameOperatorAssignments,
} from "@/features/rainbow-six-siege/lib/operatorWheel";

export function useR6GameOperatorAssignments(matchId: string | null) {
  return useQuery({
    queryKey: ["r6_game_operator_assignments", matchId],
    queryFn: () => fetchR6GameOperatorAssignments(matchId as string),
    enabled: !!matchId,
  });
}

/** Bulk-variant voor Geschiedenis/Statistieken/Tablet Controller — alle
 * toewijzingen van meerdere games in één keer, i.p.v. N+1 per game. */
export function useR6GameOperatorAssignmentsForMatches(matchIds: string[]) {
  return useQuery({
    queryKey: ["r6_game_operator_assignments", "bulk", ...matchIds],
    queryFn: () => fetchR6GameOperatorAssignmentsForMatches(matchIds),
    enabled: matchIds.length > 0,
  });
}

export function useSaveR6GameOperatorAssignments(matchId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveR6GameOperatorAssignments,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_game_operator_assignments", matchId] }),
  });
}
