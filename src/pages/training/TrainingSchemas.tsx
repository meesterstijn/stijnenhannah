import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  BookMarked,
  Check,
  Copy,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ProgramSetup } from "@/features/training/components/ProgramSetup";
import { Loading, PageHeader, Sheet } from "@/features/training/components/ui";
import {
  archiveProgram,
  createProgram,
  deleteProgram,
  duplicateProgram,
} from "@/features/training/db/repository";
import { estimateMinutes } from "@/features/training/domain/generator";
import {
  PROGRAM_TEMPLATES,
  type ProgramTemplate,
} from "@/features/training/domain/templates";
import type { Program } from "@/features/training/domain/types";
import { WEEKDAY_SHORT } from "@/features/training/domain/units";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import {
  usePrograms,
  useProfile,
} from "@/features/training/hooks/useTrainingData";
import { useWorkoutActions } from "@/features/training/hooks/useWorkoutActions";

export function TemplateCard({
  template,
  onUse,
  recommended,
}: {
  template: ProgramTemplate;
  onUse: () => void;
  recommended?: boolean;
}) {
  return (
    <article className="tr-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="tr-h2">{template.name}</h3>
        {recommended && (
          <span className="tr-chip tr-chip-aqua">Past bij jouw dagen</span>
        )}
      </div>
      <p className="tr-ink-2 text-sm">{template.description}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="tr-chip">{template.daysPerWeek} dagen per week</span>
        <span className="tr-chip tr-chip-wrap">{template.recommendedLevel}</span>
      </div>
      <p className="tr-muted text-xs">
        {template.days.map((d) => d.name).join(" · ")}
      </p>
      <button
        type="button"
        className="tr-btn tr-btn-primary mt-auto self-start"
        onClick={onUse}
      >
        Kiezen
      </button>
    </article>
  );
}

export default function TrainingSchemas() {
  const programs = usePrograms();
  const profile = useProfile();
  const { db, userId } = useTraining();
  const { activate } = useWorkoutActions();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<ProgramTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Program | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (!programs) return <Loading />;
  const activeId = profile.settings.activeProgramId;
  const own = programs.filter((p) =>
    showArchived ? p.archivedAt : !p.archivedAt,
  );
  const archivedCount = programs.filter((p) => p.archivedAt).length;

  const newProgram = async () => {
    const program = await createProgram(db, userId, {
      name: "Mijn schema",
      content: {
        scheduleMode: "weekly",
        days: [{ id: "dag-1", name: "Dag 1", weekdays: [0], exercises: [] }],
      },
    });
    navigate(`/training/schemas/${program.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schema's"
        subtitle="Kies een schema of maak er zelf een. Wisselen kan altijd; je historie blijft bewaard."
        actions={
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={() => void newProgram()}
          >
            <Plus className="h-4 w-4" /> Eigen schema
          </button>
        }
      />

      {programs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="tr-h2">Mijn schema's</h2>
            {archivedCount > 0 && (
              <button
                type="button"
                className="tr-btn tr-btn-quiet"
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived
                  ? "Actieve tonen"
                  : `Gearchiveerd (${archivedCount})`}
              </button>
            )}
          </div>
          {own.map((p) => {
            const active = p.id === activeId;
            return (
              <article
                key={p.id}
                className="tr-card p-4"
                style={
                  active
                    ? { borderColor: "var(--tr-aqua)", borderWidth: 2 }
                    : undefined
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="tr-h2 flex items-center gap-2">
                      {p.name}
                      {active && (
                        <span className="tr-chip tr-chip-aqua">
                          <Check className="h-3.5 w-3.5" /> Actief
                        </span>
                      )}
                    </h3>
                    <p className="tr-muted text-sm">
                      {p.content.days.length} trainingen ·{" "}
                      {p.content.scheduleMode === "weekly"
                        ? "vaste weekdagen"
                        : "doorlopende volgorde"}
                    </p>
                  </div>
                  {!active && !p.archivedAt && (
                    <button
                      type="button"
                      className="tr-btn tr-btn-secondary"
                      onClick={() => void activate(p.id)}
                    >
                      Activeren
                    </button>
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {p.content.days.map((d) => (
                    <li key={d.id} className="flex justify-between gap-3">
                      <span className="font-medium">{d.name}</span>
                      <span className="tr-muted shrink-0">
                        {p.content.scheduleMode === "weekly" &&
                          d.weekdays
                            .map((w) => WEEKDAY_SHORT[w])
                            .join(", ")}{" "}
                        · {d.exercises.length} oef. · ~
                        {estimateMinutes(d.exercises)} min
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Link
                    to={`/training/schemas/${p.id}`}
                    className="tr-btn tr-btn-quiet"
                  >
                    <Pencil className="h-4 w-4" /> Bewerken
                  </Link>
                  <button
                    type="button"
                    className="tr-btn tr-btn-quiet"
                    onClick={() => void duplicateProgram(db, userId, p.id)}
                  >
                    <Copy className="h-4 w-4" /> Dupliceren
                  </button>
                  <button
                    type="button"
                    className="tr-btn tr-btn-quiet"
                    onClick={async () => {
                      await archiveProgram(db, p.id, !p.archivedAt);
                      if (active) await activate(null);
                    }}
                  >
                    {p.archivedAt ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    {p.archivedAt ? "Terugzetten" : "Archiveren"}
                  </button>
                  {p.archivedAt && (
                    <button
                      type="button"
                      className="tr-btn tr-btn-quiet tr-danger-text"
                      onClick={() => setConfirmDelete(p)}
                    >
                      <Trash2 className="h-4 w-4" /> Verwijderen
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="tr-h2">Standaardschema's</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {PROGRAM_TEMPLATES.filter((t) => t.category === "standard").map(
            (t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onUse={() => setTemplate(t)}
                recommended={t.daysPerWeek === profile.settings.daysPerWeek}
              />
            ),
          )}
        </div>
        <Link
          to="/training/bibliotheek"
          className="tr-card flex items-center gap-3 p-4"
        >
          <BookMarked className="tr-aqua-text h-6 w-6" />
          <span className="flex-1">
            <span className="block font-semibold">Trainingsbibliotheek</span>
            <span className="tr-muted text-sm">
              Meer schema's met hun uitgangspunten en bronnen
            </span>
          </span>
          <span className="tr-aqua-text font-semibold">→</span>
        </Link>
      </section>

      <ProgramSetup template={template} onClose={() => setTemplate(null)} />

      <Sheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Schema verwijderen?"
      >
        <p>
          Je trainingshistorie blijft volledig bewaard; alleen het schema zelf
          verdwijnt.
        </p>
        <button
          type="button"
          className="tr-btn tr-btn-danger tr-btn-block"
          onClick={async () => {
            if (confirmDelete) await deleteProgram(db, confirmDelete.id);
            setConfirmDelete(null);
          }}
        >
          Verwijderen
        </button>
      </Sheet>
    </div>
  );
}
