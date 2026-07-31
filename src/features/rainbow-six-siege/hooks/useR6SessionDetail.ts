import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addR6SessionPlayer,
  createR6Match,
  deleteR6Match,
  fetchR6SessionDetail,
  removeR6SessionPlayer,
  undoR6MatchMvp,
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

/**
 * Undo van een MVP-toekenning (zie useR6UndoLastAction). Net als
 * useR6SessionDetailMutation hierboven invalideert dit r6_session_detail/
 * r6_sessions/r6_history, maar bovendien ook r6_latest_match: in de normale
 * "Gimma afronden"-flow is de match met de MVP nooit meer de actieve/
 * laatste game (die wordt vlak daarna automatisch aangemaakt), maar bij een
 * heropende sessie waarin de MVP handmatig aan de dan-actieve match is
 * gekoppeld via het klassieke matchformulier zou anders `useLatestR6Match`
 * (Tablet Controller/Live LAN) een verouderde mvp_player_id blijven tonen.
 */
export function useUndoR6MatchMvp(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: undoR6MatchMvp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["r6_session_detail", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["r6_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["r6_history"] });
      queryClient.invalidateQueries({ queryKey: ["r6_latest_match", sessionId] });
    },
  });
}

export function useAddR6SessionPlayer(sessionId: string) {
  return useR6SessionDetailMutation(sessionId, (playerName: string) => addR6SessionPlayer(sessionId, playerName));
}

export function useRemoveR6SessionPlayer(sessionId: string) {
  return useR6SessionDetailMutation(sessionId, (playerId: string) => removeR6SessionPlayer(sessionId, playerId));
}
