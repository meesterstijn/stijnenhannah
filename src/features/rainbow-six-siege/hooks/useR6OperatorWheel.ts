import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchR6GameOperatorAssignments,
  saveR6GameOperatorAssignments,
} from "@/features/rainbow-six-siege/lib/operatorWheel";

export function useR6GameOperatorAssignments(matchId: string | null) {
  return useQuery({
    queryKey: ["r6_game_operator_assignments", matchId],
    queryFn: () => fetchR6GameOperatorAssignments(matchId as string),
    enabled: !!matchId,
  });
}

export function useSaveR6GameOperatorAssignments(matchId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveR6GameOperatorAssignments,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_game_operator_assignments", matchId] }),
  });
}
