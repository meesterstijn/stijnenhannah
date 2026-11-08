import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Undo2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/with-timeout";
import {
  EmptyState,
  Loading,
  PageHeader,
} from "@/features/training/components/ui";
import {
  refreshSharedExercises,
  sharedToExercise,
} from "@/features/training/hooks/useSharedExercises";
import {
  MUSCLE_LABELS,
  equipmentLabel,
} from "@/features/training/domain/units";
import { LOAD_LABELS, TRACKING_LABELS } from "./TrainingOefeningForm";

type Submission = {
  id: string;
  user_id: string;
  email: string | null;
  name: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  status: "approved" | "rejected" | null;
  shared_name: string | null;
  reviewed_at: string | null;
};

const dateFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// Owner: eigen oefeningen van anderen beoordelen. Goedkeuren maakt een kopie
// (naam en gegevens op dat moment) zichtbaar voor iedereen met Training;
// afwijzen houdt hem alleen bij de maker.
export default function TrainingOefeningReview() {
  const { isOwner } = useAuth();
  const [items, setItems] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await withTimeout(
      supabase.rpc("training_exercise_submissions"),
    );
    if (!response || response.error || !response.data) {
      setError("Laden lukte niet. Ben je online?");
      setItems((current) => current ?? []);
      return;
    }
    setItems(response.data as Submission[]);
  }, []);

  useEffect(() => {
    if (isOwner) void load();
  }, [isOwner, load]);

  if (!isOwner) {
    return (
      <EmptyState title="Geen toegang">
        Alleen de beheerder beoordeelt nieuwe oefeningen.
      </EmptyState>
    );
  }
  if (!items) return <Loading />;

  const review = async (item: Submission, approve: boolean, name?: string) => {
    setBusy(item.id);
    setError(null);
    const response = await withTimeout(
      supabase.rpc("training_review_exercise", {
        p_id: item.id,
        p_approve: approve,
        p_name: name ?? null,
      }),
    );
    setBusy(null);
    if (!response || response.error) {
      setError("Opslaan lukte niet. Probeer het opnieuw.");
      return;
    }
    await Promise.all([load(), refreshSharedExercises(true)]);
  };

  const pending = items.filter((i) => !i.status);
  const approved = items.filter((i) => i.status === "approved");
  const rejected = items.filter((i) => i.status === "rejected");

  const section = (title: string, list: Submission[]) =>
    list.length > 0 && (
      <section className="space-y-3">
        <h2 className="tr-label">
          {title} ({list.length})
        </h2>
        <ul className="space-y-3">
          {list.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              busy={busy === item.id}
              onReview={(approve, name) => void review(item, approve, name)}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nieuwe oefeningen"
        subtitle="Eigen oefeningen van anderen. Pas na goedkeuring kan iedereen ze kiezen; tot die tijd ziet alleen de maker ze."
        actions={
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" /> Vernieuwen
          </button>
        }
      />
      {error && <p className="tr-banner tr-banner-warn">{error}</p>}
      {items.length === 0 ? (
        <EmptyState title="Nog niets ingediend">
          Zodra iemand een eigen oefening aanmaakt, verschijnt die hier.
        </EmptyState>
      ) : (
        <>
          {pending.length === 0 && (
            <p className="tr-muted text-sm">Niets wacht op beoordeling.</p>
          )}
          {section("Wacht op beoordeling", pending)}
          {section("Gedeeld met iedereen", approved)}
          {section("Afgewezen (alleen bij de maker)", rejected)}
        </>
      )}
    </div>
  );
}

function ReviewCard({
  item,
  busy,
  onReview,
}: {
  item: Submission;
  busy: boolean;
  onReview: (approve: boolean, name?: string) => void;
}) {
  const [name, setName] = useState(item.shared_name ?? item.name);
  const exercise = sharedToExercise({
    id: item.id,
    name: item.name,
    data: item.data,
  });
  const changedSinceReview =
    item.status === "approved" &&
    item.reviewed_at !== null &&
    Date.parse(item.updated_at) > Date.parse(item.reviewed_at);
  const facts = [
    TRACKING_LABELS[exercise.tracking] ?? exercise.tracking,
    exercise.tracking === "weight_reps"
      ? (LOAD_LABELS[exercise.loadMode] ?? exercise.loadMode)
      : null,
    exercise.primary.map((m) => MUSCLE_LABELS[m] ?? m).join(", ") || null,
    exercise.equipment.length
      ? exercise.equipment.map(equipmentLabel).join(", ")
      : null,
  ].filter(Boolean);

  return (
    <li className="tr-card space-y-3 p-4">
      <label className="tr-field">
        <span>Naam voor iedereen</span>
        <input
          className="tr-input"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {name.trim() !== item.name && (
        <p className="tr-muted text-xs">Door de maker genoemd: {item.name}</p>
      )}
      <p className="text-sm">{facts.join(" · ")}</p>
      {exercise.summary && (
        <p className="tr-ink-2 text-sm">{exercise.summary}</p>
      )}
      {exercise.steps.length > 0 && (
        <ol className="list-decimal space-y-0.5 pl-5 text-sm">
          {exercise.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      <p className="tr-muted text-xs">
        {item.email ?? item.user_id.slice(0, 8)} ·{" "}
        {dateFormat.format(new Date(item.created_at))}
      </p>
      {changedSinceReview && (
        <p className="tr-banner tr-banner-info text-sm">
          De maker heeft de oefening na goedkeuring aangepast. Iedereen ziet nog
          de goedgekeurde versie.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {item.status !== "approved" ? (
          <>
            <button
              type="button"
              className="tr-btn tr-btn-primary"
              disabled={busy || !name.trim()}
              onClick={() => onReview(true, name)}
            >
              <Check className="h-4 w-4" /> Goedkeuren voor iedereen
            </button>
            {item.status !== "rejected" && (
              <button
                type="button"
                className="tr-btn tr-btn-ghost"
                disabled={busy}
                onClick={() => onReview(false)}
              >
                <X className="h-4 w-4" /> Afwijzen
              </button>
            )}
          </>
        ) : (
          <>
            {(changedSinceReview ||
              name.trim() !== (item.shared_name ?? item.name)) && (
              <button
                type="button"
                className="tr-btn tr-btn-primary"
                disabled={busy || !name.trim()}
                onClick={() => onReview(true, name)}
              >
                <Check className="h-4 w-4" /> Deze versie delen
              </button>
            )}
            <button
              type="button"
              className="tr-btn tr-btn-ghost"
              disabled={busy}
              onClick={() => onReview(false)}
            >
              <Undo2 className="h-4 w-4" /> Niet meer delen
            </button>
          </>
        )}
      </div>
    </li>
  );
}
