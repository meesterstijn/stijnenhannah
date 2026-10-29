import type { CompetitionPeriod } from "@/features/schietsport/domain/model";
import { todayYmd } from "@/features/schietsport/lib/format";

// Status en voortgang (in tijd) van een competitieperiode.
export function competitionStatus(c: CompetitionPeriod, today = todayYmd()) {
  if (today < c.startDate) return { label: "Gepland", progress: 0 };
  if (today > c.endDate) return { label: "Afgelopen", progress: 1 };
  const start = Date.parse(c.startDate);
  const end = Date.parse(c.endDate);
  const now = Date.parse(today);
  return {
    label: "Lopend",
    progress: end > start ? (now - start) / (end - start) : 1,
  };
}
