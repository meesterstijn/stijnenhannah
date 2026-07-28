import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptR6ChaosEffectForMatch,
  createR6ChaosEffect,
  deleteR6ChaosEffect,
  fetchR6ChaosEffects,
  fetchR6SessionChaosEffects,
  updateR6ChaosEffect,
} from "@/features/rainbow-six-siege/lib/chaosWheel";

const REFERENCE_STALE_TIME = 5 * 60 * 1000;

/** De catalogus met chaosregels (wheel-segmenten) — wijzigt zelden, zelfde
 * lange staleTime als maps/operators/challenges. */
export function useR6ChaosEffects() {
  return useQuery({
    queryKey: ["r6_chaos_effects"],
    queryFn: fetchR6ChaosEffects,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useCreateR6ChaosEffect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createR6ChaosEffect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_chaos_effects"] }),
  });
}

export function useUpdateR6ChaosEffect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof updateR6ChaosEffect>[1] }) => updateR6ChaosEffect(input.id, input.patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_chaos_effects"] }),
  });
}

export function useDeleteR6ChaosEffect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteR6ChaosEffect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_chaos_effects"] }),
  });
}

/** De geaccepteerde chaosregel(s) van een sessie — gefilterd op match_id
 * geeft de actieve regel van één specifieke game. */
export function useR6SessionChaosEffects(sessionId: string) {
  return useQuery({
    queryKey: ["r6_session_chaos_effects", sessionId],
    queryFn: () => fetchR6SessionChaosEffects(sessionId),
    enabled: !!sessionId,
  });
}

export function useAcceptR6ChaosEffect(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { matchId: string; chaosEffectId: string }) => acceptR6ChaosEffectForMatch({ sessionId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_session_chaos_effects", sessionId] }),
  });
}
