import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trophy } from "lucide-react";
import {
  Panel,
  PanelEmpty,
  SchietsportPageHeader,
} from "@/features/schietsport/components/SchietsportSurface";
import { Button, FormSheet } from "@/features/schietsport/components/form";
import { CompetitionForm } from "@/features/schietsport/components/CompetitionForm";
import { summarize } from "@/features/schietsport/domain/stats";
import {
  useCompetitionEntries,
  useCompetitions,
  useDisciplines,
  useSessions,
} from "@/features/schietsport/hooks/useSchietsportData";
import { formatDate, formatMean } from "@/features/schietsport/lib/format";
import { competitionStatus } from "@/features/schietsport/lib/competition";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

export default function SchietsportCompetities() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const competitions = useCompetitions({ includeArchived: showArchived });
  const entries = useCompetitionEntries() ?? [];
  const sessions = useSessions() ?? [];
  const disciplines = useDisciplines({ includeArchived: true }) ?? [];

  return (
    <div className="space-y-5">
      <SchietsportPageHeader
        icon={Trophy}
        title="Competities"
        description="Competitieperiodes en de officiële wedstrijden die meetellen."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Competitie toevoegen
          </Button>
        }
      />

      {competitions && competitions.length === 0 ? (
        <Panel title="Nog geen competities">
          <PanelEmpty
            icon={Trophy}
            text="Maak een competitieperiode aan en koppel er je officiële wedstrijden aan. Oefenwedstrijden en vrije kaarten tellen nooit automatisch mee."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {competitions?.map((competition) => {
            const linkedIds = new Set(
              entries
                .filter((e) => e.competitionId === competition.id)
                .map((e) => e.sessionId),
            );
            const linked = sessions.filter((s) => linkedIds.has(s.id));
            const summary = summarize(linked);
            const status = competitionStatus(competition);
            return (
              <Link
                key={competition.id}
                to={`${SCHIETSPORT_BASE}/competities/${competition.id}`}
                className="ss-card ss-card-interactive block space-y-3 p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{competition.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(competition.startDate)} –{" "}
                      {formatDate(competition.endDate)}
                      {competition.disciplineId &&
                        ` · ${disciplines.find((d) => d.id === competition.disciplineId)?.name ?? ""}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[0.7rem] text-muted-foreground">
                    {competition.archivedAt ? "Gearchiveerd" : status.label}
                  </span>
                </div>
                <div
                  className="h-1 overflow-hidden rounded-full bg-white/5"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-[var(--ss-copper)]"
                    style={{ width: `${status.progress * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Wedstrijden</p>
                    <p className="ss-number text-base font-semibold">
                      {linked.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gemiddelde</p>
                    <p className="ss-number text-base font-semibold">
                      {summary ? formatMean(summary.mean) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Hoogste</p>
                    <p className="ss-number text-base font-semibold text-[var(--ss-copper)]">
                      {summary ? summary.max : "—"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowArchived((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {showArchived
          ? "Gearchiveerde competities verbergen"
          : "Gearchiveerde competities tonen"}
      </button>

      <FormSheet
        open={creating}
        onOpenChange={setCreating}
        title="Competitie toevoegen"
      >
        <CompetitionForm
          onDone={(competition) => {
            setCreating(false);
            navigate(`${SCHIETSPORT_BASE}/competities/${competition.id}`);
          }}
        />
      </FormSheet>
    </div>
  );
}
