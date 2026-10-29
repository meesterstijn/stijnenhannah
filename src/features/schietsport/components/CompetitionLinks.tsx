import { Link } from "react-router-dom";
import { Trophy, X } from "lucide-react";
import { toast } from "sonner";
import type { ShootingSession } from "@/features/schietsport/domain/model";
import {
  linkSessionToCompetition,
  unlinkSessionFromCompetition,
} from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useCompetitionEntries,
  useCompetitions,
} from "@/features/schietsport/hooks/useSchietsportData";
import { Panel } from "@/features/schietsport/components/SchietsportSurface";
import { NativeSelect } from "@/features/schietsport/components/form";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

// Koppelen van een officiële wedstrijd aan competitieperiodes. Oefen-
// wedstrijden en vrije kaarten tellen nooit automatisch mee.
export function CompetitionLinks({ session }: { session: ShootingSession }) {
  const { db, userId } = useSchietsport();
  const competitions = useCompetitions() ?? [];
  const entries = useCompetitionEntries() ?? [];
  const linkedIds = new Set(
    entries
      .filter((e) => e.sessionId === session.id)
      .map((e) => e.competitionId),
  );
  const linked = competitions.filter((c) => linkedIds.has(c.id));
  const inPeriod = (c: (typeof competitions)[number]) =>
    session.sessionDate >= c.startDate && session.sessionDate <= c.endDate;
  const candidates = competitions
    .filter((c) => !linkedIds.has(c.id))
    .sort((a, b) => Number(inPeriod(b)) - Number(inPeriod(a)));

  if (competitions.length === 0) return null;

  return (
    <Panel title="Competitie">
      <div className="space-y-3">
        {linked.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Niet gekoppeld aan een competitie.
          </p>
        )}
        {linked.map((competition) => (
          <div
            key={competition.id}
            className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5"
          >
            <Trophy className="h-4 w-4 text-[var(--ss-copper)]" />
            <Link
              to={`${SCHIETSPORT_BASE}/competities/${competition.id}`}
              className="flex-1 truncate text-sm hover:text-[var(--ss-copper)]"
            >
              {competition.name}
            </Link>
            <button
              type="button"
              aria-label={`Ontkoppelen van ${competition.name}`}
              onClick={() =>
                void unlinkSessionFromCompetition(
                  db,
                  competition.id,
                  session.id,
                )
              }
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {candidates.length > 0 && (
          <NativeSelect
            value=""
            onChange={async (e) => {
              const competitionId = e.target.value;
              if (!competitionId) return;
              try {
                await linkSessionToCompetition(
                  db,
                  userId,
                  competitionId,
                  session.id,
                );
                toast.success("Gekoppeld aan competitie");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Koppelen mislukt",
                );
              }
            }}
            aria-label="Koppelen aan competitie"
          >
            <option value="">Koppelen aan competitie…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {inPeriod(c) ? "" : " (buiten periode)"}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
    </Panel>
  );
}
