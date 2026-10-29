import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Info,
  Link2,
  Pencil,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Panel,
  PanelEmpty,
  StatCard,
} from "@/features/schietsport/components/SchietsportSurface";
import {
  Button,
  ConfirmDialog,
  FormSheet,
} from "@/features/schietsport/components/form";
import { CompetitionForm } from "@/features/schietsport/components/CompetitionForm";
import { SessionRow } from "@/features/schietsport/components/SessionRow";
import { ScoreTrendChart } from "@/features/schietsport/components/charts";
import { latestSession, summarize } from "@/features/schietsport/domain/stats";
import { trendSeries } from "@/features/schietsport/domain/insights";
import {
  linkSessionToCompetition,
  softDelete,
  unlinkSessionFromCompetition,
  updateCompetition,
} from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useCompetitionEntries,
  useCompetitions,
  useDisciplines,
  useSessions,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import { formatDate, formatMean } from "@/features/schietsport/lib/format";
import { competitionStatus } from "@/features/schietsport/lib/competition";
import {
  RULE_TYPE_LABELS,
  bestCountOf,
  ruleTypeOf,
  sessionTypeOf,
} from "@/features/schietsport/domain/competition";
import {
  BestOfView,
  PeriodsView,
} from "@/features/schietsport/components/CompetitionViews";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

const NONE: never[] = [];

export default function SchietsportCompetitieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db, userId } = useSchietsport();
  const competitions = useCompetitions({ includeArchived: true });
  const entries = useCompetitionEntries() ?? NONE;
  const sessions = useSessions() ?? NONE;
  const weapons = useWeapons({ includeArchived: true }) ?? NONE;
  const disciplines = useDisciplines({ includeArchived: true }) ?? NONE;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (competitions === undefined)
    return <div className="ss-card h-64 animate-pulse" />;
  const competition = competitions.find((c) => c.id === id);
  if (!competition) {
    return (
      <Panel title="Competitie niet gevonden">
        <PanelEmpty
          icon={Trophy}
          text="Deze competitie bestaat niet (meer)."
          action={{
            to: `${SCHIETSPORT_BASE}/competities`,
            label: "Naar competities",
          }}
        />
      </Panel>
    );
  }

  const linkedIds = new Set(
    entries
      .filter((e) => e.competitionId === competition.id)
      .map((e) => e.sessionId),
  );
  const linked = sessions.filter((s) => linkedIds.has(s.id));
  const summary = summarize(linked);
  const latest = latestSession(linked);
  const status = competitionStatus(competition);
  const ruleType = ruleTypeOf(competition);
  // Voorstellen: officiële wedstrijden binnen de periode (en discipline),
  // nog niet gekoppeld. Nooit oefenwedstrijden of vrije kaarten.
  const suggestions = sessions
    .filter(
      (s) =>
        s.type === "match" &&
        !linkedIds.has(s.id) &&
        s.sessionDate >= competition.startDate &&
        s.sessionDate <= competition.endDate &&
        (!competition.disciplineId ||
          s.disciplineId === competition.disciplineId),
    )
    .reverse();

  const link = async (sessionIds: string[]) => {
    for (const sessionId of sessionIds) {
      await linkSessionToCompetition(db, userId, competition.id, sessionId);
    }
    toast.success(
      sessionIds.length === 1
        ? "Wedstrijd gekoppeld"
        : `${sessionIds.length} wedstrijden gekoppeld`,
    );
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Terug
      </button>

      <section className="ss-hero">
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
          <div className="min-w-0 flex-1">
            <p className="ss-eyebrow">
              Competitie ·{" "}
              {competition.archivedAt
                ? "gearchiveerd"
                : status.label.toLowerCase()}
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold sm:text-3xl">
              {competition.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(competition.startDate)} –{" "}
              {formatDate(competition.endDate)}
              {competition.disciplineId &&
                ` · ${disciplines.find((d) => d.id === competition.disciplineId)?.name ?? ""}`}
            </p>
            <div
              className="mt-3 h-1 max-w-sm overflow-hidden rounded-full bg-white/5"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-[var(--ss-copper)]"
                style={{ width: `${status.progress * 100}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Bewerken
            </Button>
            <Button
              onClick={() =>
                void updateCompetition(db, competition.id, {
                  archivedAt: competition.archivedAt
                    ? null
                    : new Date().toISOString(),
                })
              }
            >
              {competition.archivedAt ? (
                <>
                  <ArchiveRestore className="h-4 w-4" /> Herstellen
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Archiveren
                </>
              )}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {ruleType !== "manual" ? (
        <>
          <p className="text-sm text-muted-foreground">
            {RULE_TYPE_LABELS[ruleType]} · telt mee:{" "}
            {sessionTypeOf(competition) === "match"
              ? "officiële wedstrijden"
              : "vrije kaarten"}
            {competition.rules?.distance
              ? ` · ${competition.rules.distance} m`
              : ""}
            {ruleType === "best_of"
              ? ` · beste ${bestCountOf(competition)}`
              : ""}
          </p>
          {ruleType === "periods" ? (
            <PeriodsView
              competition={competition}
              sessions={sessions}
              weapons={weapons}
              disciplines={disciplines}
            />
          ) : (
            <BestOfView
              competition={competition}
              sessions={sessions}
              weapons={weapons}
              disciplines={disciplines}
            />
          )}
          {competition.notes && (
            <Panel title="Opmerkingen">
              <p className="whitespace-pre-wrap text-sm">{competition.notes}</p>
            </Panel>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Wedstrijden" value={linked.length} />
            <StatCard
              label="Gemiddelde"
              value={summary ? formatMean(summary.mean) : "—"}
              suffix={summary ? "/300" : undefined}
            />
            <StatCard
              label="Hoogste"
              tone="copper"
              value={summary ? summary.max : "—"}
              suffix={summary ? "/300" : undefined}
            />
            <StatCard
              label="Laatste"
              value={latest ? latest.totalScore : "—"}
              suffix={latest ? "/300" : undefined}
              detail={latest ? formatDate(latest.sessionDate) : undefined}
            />
          </div>

          <div className="ss-card flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ss-amber)]" />
            <p>
              Handmatige competitie: je koppelt zelf officiële wedstrijden. Kies
              bij Bewerken “Puntenbord” of “Beste scores” om de regels van de
              vereniging automatisch te laten rekenen.
              {competition.notes && (
                <span className="mt-2 block whitespace-pre-wrap text-foreground/80">
                  {competition.notes}
                </span>
              )}
            </p>
          </div>

          {linked.length > 1 && (
            <Panel title="Verloop in deze competitie">
              <ScoreTrendChart points={trendSeries(linked)} scale={300} />
            </Panel>
          )}

          <Panel title="Gekoppelde wedstrijden">
            {linked.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen wedstrijden gekoppeld.
              </p>
            ) : (
              <div className="-mx-2 divide-y divide-white/5">
                {[...linked].reverse().map((session) => (
                  <div key={session.id} className="flex items-center">
                    <div className="min-w-0 flex-1">
                      <SessionRow
                        session={session}
                        weapons={weapons}
                        disciplines={disciplines}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="Ontkoppelen"
                      onClick={() =>
                        void unlinkSessionFromCompetition(
                          db,
                          competition.id,
                          session.id,
                        )
                      }
                      className="p-3 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {suggestions.length > 0 && (
            <Panel title="Voorstellen">
              <div className="-mt-2 mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Officiële wedstrijden in deze periode die nog niet meetellen.
                </p>
                {suggestions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void link(suggestions.map((s) => s.id))}
                    className="shrink-0 text-xs text-[var(--ss-copper)] hover:underline"
                  >
                    Alles koppelen
                  </button>
                )}
              </div>
              <div className="-mx-2 divide-y divide-white/5">
                {suggestions.map((session) => (
                  <div key={session.id} className="flex items-center">
                    <div className="min-w-0 flex-1">
                      <SessionRow
                        session={session}
                        weapons={weapons}
                        disciplines={disciplines}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void link([session.id])}
                      className="inline-flex items-center gap-1 p-3 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Link2 className="h-4 w-4" /> Koppel
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}

      <FormSheet
        open={editing}
        onOpenChange={setEditing}
        title="Competitie bewerken"
      >
        <CompetitionForm
          competition={competition}
          onDone={() => setEditing(false)}
        />
      </FormSheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Competitie verwijderen?"
        description="De competitie en de koppelingen verdwijnen. Je wedstrijden zelf blijven gewoon bestaan."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={async () => {
          for (const entry of entries.filter(
            (e) => e.competitionId === competition.id,
          )) {
            await softDelete(db, "competition_entry", entry.id);
          }
          await softDelete(db, "competition", competition.id);
          navigate(`${SCHIETSPORT_BASE}/competities`, { replace: true });
          toast.success("Competitie verwijderd");
        }}
      />
    </div>
  );
}
