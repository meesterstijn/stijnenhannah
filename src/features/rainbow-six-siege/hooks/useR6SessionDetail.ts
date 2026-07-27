import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addR6SessionPlayer,
  createR6Match,
  deleteR6Match,
  fetchR6SessionDetail,
  removeR6SessionPlayer,
  updateR6Match,
} from "@/features/rainbow-six-siege/lib/sessions";

export function useR6SessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["r6_session_detail", sessionId],
    queryFn: () => fetchR6SessionDetail(sessionId!),
    enabled: !!sessionId,
  });
}

function useR6SessionDetailMutation<TVariables, TResult>(sessionId: string, mutationFn: (vars: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["r6_session_detail", sessionId] });
      // De matchcount/scorebord-samenvatting in de historielijst moet ook
      // meteen bijwerken.
      queryClient.invalidateQueries({ queryKey: ["r6_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["r6_history"] });
    },
  });
}

export function useCreateR6Match(sessionId: string) {
  return useR6SessionDetailMutation(sessionId, createR6Match);
}

export function useUpdateR6Match(sessionId: string) {
  return useR6SessionDetailMutation(sessionId, updateR6Match);
}

export function useDeleteR6Match(sessionId: string) {
  return useR6SessionDetailMutation(sessionId, deleteR6Match);
}

export function useAddR6SessionPlayer(sessionId: string) {
  return useR6SessionDetailMutation(sessionId, (playerName: string) => addR6SessionPlayer(sessionId, playerName));
}

export function useRemoveR6SessionPlayer(sessionId: string) {
  return useR6SessionDetailMutation(sessionId, (playerId: string) => removeR6SessionPlayer(sessionId, playerId));
}
