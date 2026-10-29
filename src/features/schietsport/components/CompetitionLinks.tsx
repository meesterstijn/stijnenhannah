import { Link } from "react-router-dom";
import { Trophy, X } from "lucide-react";
import { toast } from "sonner";
import type { ShootingSession } from "@/features/schietsport/domain/model";
import {
  bestOfStandings,
  eligibleSessions,
  periodStandings,
  ruleTypeOf,
} from "@/features/schietsport/domain/competition";
import {
  linkSessionToCompetition,
  unlinkSessionFromCompetition,
} from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useCompetitionEntries,
  useCompetitions,
  useSessions,
} from "@/features/schietsport/hooks/useSchietsportData";
import { Panel } from "@/features/schietsport/components/SchietsportSurface";
import { NativeSelect } from "@/features/schietsport/components/form";
import { todayYmd } from "@/features/schietsport/lib/format";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

// Competities waar deze schietbeurt voor telt. Competities met regels
// (puntenbord, beste scores) rekenen automatisch; handmatige competities
// koppel je hier zelf (alleen officiële wedstrijden).
export function CompetitionLinks({ session }: { session: ShootingSession }) {
  const { db, userId } = useSchietsport();
  const competitions = useCompetitions() ?? [];
  const entries = useCompetitionEntries() ?? [];
  const sessions = useSessions() ?? [];

  const automatic = competitions
    .filter((c) => ruleTypeOf(c) !== "manual")
    .flatMap((c) => {
      if (!eligibleSessions(c, sessions).some((s) => s.id === session.id)) {
        return [];
      }
      let detail = "telt mee";
      if (ruleTypeOf(c) === "periods") {
        const period = periodStandings(c, sessions, todayYmd()).find(
          (p) => session.sessionDate >= p.start && session.sessionDate <= p.end,
        );
        if (period) {
          detail =
            period.best?.sessionId === session.id
              ? `beste score van periode ${period.index + 1}`
              : `periode ${period.index + 1}, telt niet als beste`;
        }
      } else if (bestOfStandings(c, sessions).counted.has(session.id)) {
        detail = "telt bij de beste scores";
      } else {
        detail = "telt niet bij de beste scores";
      }
      return [{ competition: c, detail }];
    });

  const manual = competitions.filter((c) => ruleTypeOf(c) === "manual");
  const linkedIds = new Set(
    entries
      .filter((e) => e.sessionId === session.id)
      .map((e) => e.competitionId),
  );
  const linked = manual.filter((c) => linkedIds.has(c.id));
  const inPeriod = (c: (typeof competitions)[number]) =>
    session.sessionDate >= c.startDate && session.sessionDate <= c.endDate;
  const candidates =
    session.type === "match"
      ? manual
          .filter((c) => !linkedIds.has(c.id))
          .sort((a, b) => Number(inPeriod(b)) - Number(inPeriod(a)))
      : [];

  if (
    automatic.length === 0 &&
    linked.length === 0 &&
    candidates.length === 0
  ) {
    return null;
  }

  const row = (
    id: string,
    name: string,
    detail: string | null,
    onRemove?: () => void,
  ) => (
    <div
      key={id}
      className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5"
    >
      <Trophy className="h-4 w-4 shrink-0 text-[var(--ss-copper)]" />
      <Link
        to={`${SCHIETSPORT_BASE}/competities/${id}`}
        className="min-w-0 flex-1 hover:text-[var(--ss-copper)]"
      >
        <span className="block truncate text-sm">{name}</span>
        {detail && (
          <span className="block truncate text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </Link>
      {onRemove && (
        <button
          type="button"
          aria-label={`Ontkoppelen van ${name}`}
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <Panel title="Competitie">
      <div className="space-y-3">
        {automatic.map(({ competition, detail }) =>
          row(competition.id, competition.name, detail),
        )}
        {linked.map((competition) =>
          row(
            competition.id,
            competition.name,
            "handmatig gekoppeld",
            () =>
              void unlinkSessionFromCompetition(db, competition.id, session.id),
          ),
        )}
        {automatic.length === 0 && linked.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Telt nog niet mee voor een competitie.
          </p>
        )}
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
            <option value="">Koppelen aan handmatige competitie…</option>
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
