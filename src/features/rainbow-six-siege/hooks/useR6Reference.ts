import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createR6ScoreRule,
  deleteR6ScoreRule,
  fetchR6Challenges,
  fetchR6Maps,
  fetchR6Operators,
  fetchR6ScoreRules,
  updateR6ScoreRule,
} from "@/features/rainbow-six-siege/lib/reference";
import { FALLBACK_SCORE_RULES } from "@/features/rainbow-six-siege/lib/scoring";

// Lookup-tabellen wijzigen zelden (alleen als iemand handmatig een nieuwe
// map/operator/challenge toevoegt), dus een lange staleTime voorkomt
// onnodige herhaalde fetches zonder dat het ooit stale-in-de-praktijk voelt.
const REFERENCE_STALE_TIME = 5 * 60 * 1000;

export function useR6Maps() {
  return useQuery({
    queryKey: ["r6_maps"],
    queryFn: fetchR6Maps,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useR6Operators() {
  return useQuery({
    queryKey: ["r6_operators"],
    queryFn: fetchR6Operators,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useR6Challenges() {
  return useQuery({
    queryKey: ["r6_challenges"],
    queryFn: fetchR6Challenges,
    staleTime: REFERENCE_STALE_TIME,
  });
}

/**
 * Databasegestuurde puntregels (fase 2.2) — Supabase (`r6_score_rules`) is
 * de bron van waarheid. Alleen wanneer die niet geladen kon worden (fout,
 * of leeg omdat de tabel nog niet geseed is) valt dit terug op
 * FALLBACK_SCORE_RULES, en dat wordt expliciet gemeld via `usingFallback` —
 * nooit stilzwijgend, zodat de gebruiker kan zien dat de getoonde punten
 * mogelijk niet de actuele, door de beheerder ingestelde waarden zijn.
 */
export function useR6ScoreRules() {
  const query = useQuery({
    queryKey: ["r6_score_rules"],
    queryFn: fetchR6ScoreRules,
    staleTime: REFERENCE_STALE_TIME,
  });
  const usingFallback = !query.isLoading && (query.isError || (query.data?.length ?? 0) === 0);
  return {
    ...query,
    rules: usingFallback ? FALLBACK_SCORE_RULES : (query.data ?? []),
    usingFallback,
  };
}

/** Beheer van een puntregel/actietegel: naam, punten, icoon, kleur,
 * volgorde, actief/inactief — alles wat de instellingen-UI configureerbaar
 * moet maken (zie R6QuickActionSettings). */
export function useUpdateR6ScoreRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof updateR6ScoreRule>[1] }) => updateR6ScoreRule(input.id, input.patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_score_rules"] }),
  });
}

/** Nieuwe, zelfgedefinieerde actietegel toevoegen (zie R6QuickActionSettings)
 * — altijd meteen zichtbaar op het live dashboard, geen aparte publiceerstap. */
export function useCreateR6ScoreRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createR6ScoreRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_score_rules"] }),
  });
}

/** Actietegel definitief verwijderen — zie deleteR6ScoreRule voor de
 * foreign-key-achtervang wanneer de actie al gebruikt is. */
export function useDeleteR6ScoreRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteR6ScoreRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["r6_score_rules"] }),
  });
}
