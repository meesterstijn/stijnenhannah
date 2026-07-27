import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteR6Event, fetchLatestR6Match, fetchR6Events, recordR6Event, startR6Round } from "@/features/rainbow-six-siege/lib/events";
import type { R6Event } from "@/features/rainbow-six-siege/types";

function eventsKey(sessionId: string) {
  return ["r6_events", sessionId];
}

export function useR6Events(sessionId: string) {
  return useQuery({
    queryKey: eventsKey(sessionId),
    queryFn: () => fetchR6Events(sessionId),
    enabled: !!sessionId,
  });
}

/**
 * Eén tik = direct optimistisch in de lokale cache gezet ("binnen één
 * seconde" — niet wachten op de server-roundtrip), daarna stil verzoend
 * met de echte, door de database-trigger bevestigde rij. `optimisticPoints`
 * is puur voor de tussentijdse weergave (uit de al-geladen
 * r6_score_rules-lijst); de daadwerkelijke, leidende puntenwaarde komt
 * altijd van de server (zie set_r6_event_points-trigger).
 */
export function useRecordR6Event(sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = eventsKey(sessionId);

  return useMutation({
    mutationFn: (input: { matchId: string; playerId: string; scoreRuleCode: string; optimisticPoints: number }) =>
      recordR6Event({ sessionId, matchId: input.matchId, playerId: input.playerId, scoreRuleCode: input.scoreRuleCode }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<R6Event[]>(queryKey);
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      const optimisticEvent: R6Event = {
        id: optimisticId,
        session_id: sessionId,
        match_id: input.matchId,
        player_id: input.playerId,
        score_rule_code: input.scoreRuleCode,
        points_awarded: input.optimisticPoints,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<R6Event[]>(queryKey, (old) => [...(old ?? []), optimisticEvent]);
      return { previous, optimisticId };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (serverEvent, _input, context) => {
      queryClient.setQueryData<R6Event[]>(queryKey, (old) =>
        (old ?? []).map((e) => (e.id === context?.optimisticId ? serverEvent : e)),
      );
    },
  });
}

/** Ongedaan maken van een mistik — ook optimistisch (meteen uit de lijst),
 * met terugrollen als de server-delete onverhoopt faalt. */
export function useUndoR6Event(sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = eventsKey(sessionId);

  return useMutation({
    mutationFn: (eventId: string) => deleteR6Event(eventId),
    onMutate: async (eventId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<R6Event[]>(queryKey);
      queryClient.setQueryData<R6Event[]>(queryKey, (old) => (old ?? []).filter((e) => e.id !== eventId));
      return { previous };
    },
    onError: (_err, _eventId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
  });
}

/** De huidige (laatst gestarte) ronde van een sessie — of null als er nog
 * geen enkele is. */
export function useLatestR6Match(sessionId: string) {
  return useQuery({
    queryKey: ["r6_latest_match", sessionId],
    queryFn: () => fetchLatestR6Match(sessionId),
    enabled: !!sessionId,
  });
}

export function useStartR6Round(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startR6Round(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["r6_latest_match", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["r6_session_detail", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["r6_sessions"] });
    },
  });
}
