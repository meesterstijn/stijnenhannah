import { useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  PartyPopper,
  Pencil,
  Trash2,
  Trophy,
} from "lucide-react";
import { shortDate } from "@/features/training/components/charts";
import {
  EmptyState,
  Loading,
  Sheet,
  Stat,
} from "@/features/training/components/ui";
import {
  deleteSession,
  editSet,
  undoSet,
  updateSession,
} from "@/features/training/db/repository";
import {
  latestRecords,
  sessionSummary,
} from "@/features/training/domain/stats";
import { buildHistoryIndex } from "@/features/training/domain/performance";
import type {
  SetValues,
  Tracking,
  TrainingSet,
} from "@/features/training/domain/types";
import { STATUS_LABELS, formatKg } from "@/features/training/domain/units";
import { validateSetValues } from "@/features/training/domain/workout";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import {
  useExercises,
  useSessions,
  useSets,
} from "@/features/training/hooks/useTrainingData";
import { useWorkoutActions } from "@/features/training/hooks/useWorkoutActions";
import {
  SetValueFields,
  describeValues,
} from "@/features/training/workout/SetControls";

// Eén training terugkijken: precies wat er toen gedaan is (de momentopname
// van toen, niet het huidige schema), met gecontroleerde correcties.
export default function TrainingSessieDetail() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const sessions = useSessions();
  const sets = useSets();
  const { db } = useTraining();
  const { get } = useExercises();
  const { repeat } = useWorkoutActions();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<TrainingSet | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const session = sessions?.find((s) => s.id === id);
  const own = useMemo(
    () => (sets ?? []).filter((s) => s.sessionId === id && !s.deletedAt),
    [sets, id],
  );
  const records = useMemo(() => {
    if (!sessions || !sets || !session) return [];
    // Records die in déze training gezet zijn (vergeleken met alles ervoor).
    const before = sessions.filter(
      (s) =>
        (s.endedAt ?? s.startedAt) <= (session.endedAt ?? session.startedAt),
    );
    return latestRecords(
      buildHistoryIndex(before, sets),
      (x) => get(x).tracking,
    ).filter((r) => r.sessionId === id);
  }, [sessions, sets, session, id, get]);

  if (!sessions || !sets) return <Loading />;
  if (!session)
    return (
      <EmptyState
        title="Training niet gevonden"
        action={
          <Link to="/training/historie" className="tr-btn tr-btn-ghost">
            Naar historie
          </Link>
        }
      />
    );

  const summary = sessionSummary(session, sets);
  const justFinished = params.get("klaar") === "1";
  const exercises = session.snapshot.exercises.filter(
    (e) => !e.removed || own.some((s) => s.slot === e.slot),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="tr-icon-btn -ml-2"
          onClick={() => (justFinished ? navigate("/training") : navigate(-1))}
          aria-label="Terug"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="tr-h1 truncate">{session.name}</h1>
          <p className="tr-muted text-sm">
            {new Date(`${session.localDate}T12:00:00`).toLocaleDateString(
              "nl-NL",
              {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              },
            )}
            {session.snapshot.programName &&
              ` · ${session.snapshot.programName}`}
            {session.status !== "completed" &&
              ` · ${STATUS_LABELS[session.status]}`}
          </p>
        </div>
      </div>

      {justFinished && (
        <div className="tr-banner tr-banner-info items-center">
          <PartyPopper className="h-5 w-5 shrink-0" />
          <span>
            <strong>Training opgeslagen.</strong> Je prestaties van vandaag zijn
            de opdracht voor de volgende keer.
            {session.snapshot.endedEarly &&
              " Je stopte eerder: de sets die je niet deed houden hun doel."}
          </span>
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Duur"
          value={
            summary.durationMin !== null ? `${summary.durationMin} min` : "–"
          }
        />
        <Stat
          label="Werksets"
          value={summary.workSets}
          hint={
            summary.warmupSets
              ? `+ ${summary.warmupSets} opwarmsets`
              : undefined
          }
        />
        <Stat
          label="Volume"
          value={`${formatKg(summary.volumeKg)} kg`}
          hint="kg × herhalingen"
        />
        <Stat label="Herhalingen" value={summary.totalReps} />
      </section>

      {records.length > 0 && (
        <section className="tr-card p-4">
          <h2 className="tr-h2 mb-2">Persoonlijke records</h2>
          <ul className="space-y-1 text-sm">
            {records.map((r) => (
              <li
                key={`${r.exerciseId}-${r.kind}`}
                className="flex items-center gap-2"
              >
                <Trophy className="tr-aqua-text h-4 w-4" />
                {get(r.exerciseId).name}:{" "}
                <span className="tr-num font-semibold">
                  {r.kind === "duration"
                    ? `${r.value} s`
                    : r.kind === "reps"
                      ? `${r.value} herh.`
                      : `${formatKg(r.value)} kg`}
                </span>
                <span className="tr-muted">
                  (
                  {r.kind === "heaviest"
                    ? "zwaarste set"
                    : r.kind === "e1rm"
                      ? "geschat 1RM"
                      : r.kind === "reps"
                        ? "meeste herhalingen"
                        : r.kind === "duration"
                          ? "langste"
                          : "volume"}
                  )
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exercises.map((e) => {
        const done = own
          .filter((s) => s.slot === e.slot)
          .sort((a, b) =>
            a.kind === b.kind
              ? a.setIndex - b.setIndex
              : a.kind === "warmup"
                ? -1
                : 1,
          );
        return (
          <section key={e.slot} className="tr-card p-4">
            <Link
              to={`/training/oefeningen/${e.exerciseId}`}
              className="tr-h2 block"
            >
              {e.name}
            </Link>
            {e.replacedFrom && (
              <p className="tr-muted text-xs">
                In plaats van {get(e.replacedFrom).name}
              </p>
            )}
            {done.length === 0 ? (
              <p className="tr-muted mt-1 text-sm">Niet gedaan</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {done.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="tr-set-row w-full text-left"
                      data-state="done"
                      onClick={() => setEditing(s)}
                    >
                      <span className="tr-set-dot">
                        {s.kind === "warmup"
                          ? `W${s.setIndex + 1}`
                          : s.setIndex + 1}
                      </span>
                      <span className="tr-num font-semibold">
                        {describeValues(e.tracking, s, e.perSide)}
                      </span>
                      <Pencil className="tr-muted h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="tr-card space-y-2 p-4">
        <h2 className="tr-h2">Notitie</h2>
        {notes === null ? (
          <button
            type="button"
            className="block w-full text-left"
            onClick={() => setNotes(session.notes ?? "")}
          >
            {session.notes ? (
              <p className="whitespace-pre-wrap">{session.notes}</p>
            ) : (
              <span className="tr-muted">Tik om een notitie toe te voegen</span>
            )}
          </button>
        ) : (
          <>
            <textarea
              className="tr-textarea"
              value={notes}
              maxLength={4000}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="tr-btn tr-btn-primary"
              onClick={async () => {
                await updateSession(db, session.id, {
                  notes: notes.trim() || null,
                });
                setNotes(null);
              }}
            >
              Opslaan
            </button>
          </>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="tr-btn tr-btn-secondary"
          onClick={() => void repeat(session)}
        >
          <Copy className="h-4 w-4" /> Deze training opnieuw doen
        </button>
        <button
          type="button"
          className="tr-btn tr-btn-quiet tr-danger-text"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-4 w-4" /> Verwijderen
        </button>
      </div>

      {editing && (
        <EditSet
          set={editing}
          tracking={
            session.snapshot.exercises.find((e) => e.slot === editing.slot)
              ?.tracking ?? get(editing.exerciseId).tracking
          }
          onClose={() => setEditing(null)}
          onSave={async (tracking, v) => {
            await editSet(db, editing.id, tracking, v);
            setEditing(null);
          }}
          onDelete={async () => {
            await undoSet(db, editing.id);
            setEditing(null);
          }}
        />
      )}

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Training verwijderen?"
      >
        <p>
          De training van {shortDate(session.localDate)} verdwijnt uit je
          historie en statistieken. Je vorige prestatie wordt dan weer de
          training daarvoor.
        </p>
        <button
          type="button"
          className="tr-btn tr-btn-danger tr-btn-block"
          onClick={async () => {
            await deleteSession(db, session.id);
            navigate("/training/historie", { replace: true });
          }}
        >
          Ja, verwijderen
        </button>
      </Sheet>
    </div>
  );
}

function EditSet({
  set,
  tracking,
  onClose,
  onSave,
  onDelete,
}: {
  set: TrainingSet;
  tracking: Tracking;
  onClose: () => void;
  onSave: (tracking: Tracking, v: SetValues) => void;
  onDelete: () => void;
}) {
  const [v, setV] = useState<SetValues>({
    weightKg: set.weightKg,
    reps: set.reps,
    durationSec: set.durationSec,
    jumps: set.jumps,
  });
  const problem = validateSetValues(tracking, v);
  return (
    <Sheet
      open
      onClose={onClose}
      title="Set corrigeren"
      footer={
        <>
          <button
            type="button"
            className="tr-btn tr-btn-danger"
            onClick={onDelete}
          >
            Set verwijderen
          </button>
          <button
            type="button"
            className="tr-btn tr-btn-primary"
            disabled={!!problem}
            onClick={() => onSave(tracking, v)}
          >
            Opslaan
          </button>
        </>
      }
    >
      <p className="tr-muted text-sm">
        Een correctie werkt door in je statistieken, records en de volgende
        opdracht.
      </p>
      <SetValueFields tracking={tracking} value={v} onChange={setV} />
      {problem && <p className="tr-danger-text text-sm">{problem}</p>}
    </Sheet>
  );
}
