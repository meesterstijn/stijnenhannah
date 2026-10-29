import { useEffect } from "react";
import {
  periodStandings,
  periodsToFreeze,
  ruleTypeOf,
} from "@/features/schietsport/domain/competition";
import { updateCompetition } from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useCompetitions,
  useSessions,
} from "@/features/schietsport/hooks/useSchietsportData";
import { todayYmd } from "@/features/schietsport/lib/format";

// Zet afgelopen puntenbordperiodes vast zodra de module open is: de score
// van zo'n periode wordt opgeslagen in de competitie (en gesynchroniseerd),
// zodat latere invoer of bewerkingen die niet meer veranderen. Twee
// apparaten die tegelijk vastzetten schrijven dezelfde inhoud; de sync ziet
// dat als gelijk, dus geen conflict.
export function CompetitionFreezer() {
  const { db } = useSchietsport();
  const competitions = useCompetitions({ includeArchived: true });
  const sessions = useSessions();

  useEffect(() => {
    if (!competitions || !sessions) return;
    const today = todayYmd();
    for (const competition of competitions) {
      if (ruleTypeOf(competition) !== "periods") continue;
      const toFreeze = periodsToFreeze(
        competition,
        periodStandings(competition, sessions, today),
      );
      if (toFreeze.length === 0) continue;
      void updateCompetition(db, competition.id, {
        rules: {
          ...competition.rules,
          frozen: [...(competition.rules?.frozen ?? []), ...toFreeze].sort(
            (a, b) => a.period - b.period,
          ),
        },
      });
    }
  }, [db, competitions, sessions]);

  return null;
}
