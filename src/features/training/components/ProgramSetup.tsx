import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createProgram,
  updateProfile,
} from "@/features/training/db/repository";
import { generateProgram } from "@/features/training/domain/generator";
import type { ProgramTemplate } from "@/features/training/domain/templates";
import type {
  ScheduleMode,
  TrainingGoal,
  TrainingLevel,
} from "@/features/training/domain/types";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import {
  useExercises,
  useProfile,
} from "@/features/training/hooks/useTrainingData";
import { Segment, Sheet } from "./ui";

export const LEVEL_LABELS: Record<TrainingLevel, string> = {
  beginner: "Beginner",
  intermediate: "Gemiddeld",
  advanced: "Gevorderd",
};
export const GOAL_LABELS: Record<TrainingGoal, string> = {
  strength: "Kracht",
  hypertrophy: "Spiermassa",
  combined: "Combinatie",
};

// Sjabloon → eigen, bewerkbaar schema, afgestemd op voorkeuren.
export function ProgramSetup({
  template,
  onClose,
}: {
  template: ProgramTemplate | null;
  onClose: () => void;
}) {
  const { db, userId } = useTraining();
  const profile = useProfile();
  const { lookup } = useExercises();
  const navigate = useNavigate();
  const [level, setLevel] = useState<TrainingLevel>(profile.settings.level);
  const [goal, setGoal] = useState<TrainingGoal>(profile.settings.goal);
  const [minutes, setMinutes] = useState(profile.settings.sessionMinutes);
  const [mode, setMode] = useState<ScheduleMode>("weekly");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[] | null>(null);

  if (!template) return null;
  const preview = generateProgram(
    template,
    {
      level,
      goal,
      sessionMinutes: minutes,
      owned: new Set(profile.equipment.owned),
      scheduleMode: mode,
    },
    lookup,
  );
  const tooMany = template.daysPerWeek > profile.settings.daysPerWeek;

  const create = async () => {
    setBusy(true);
    try {
      const program = await createProgram(db, userId, {
        name: template.name,
        content: preview.content,
        source: template.id,
      });
      await updateProfile(db, userId, (p) => ({
        ...p,
        settings: {
          ...p.settings,
          level,
          goal,
          sessionMinutes: minutes,
          activeProgramId: program.id,
        },
      }));
      if (preview.notes.length) setNotes(preview.notes);
      else {
        onClose();
        navigate("/training");
      }
    } finally {
      setBusy(false);
    }
  };

  if (notes) {
    return (
      <Sheet
        open
        onClose={() => {
          onClose();
          navigate("/training");
        }}
        title="Schema staat klaar"
      >
        <p>Aangepast aan jouw voorkeuren en apparatuur:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="tr-muted text-sm">
          Alles is daarna nog aan te passen in de schema-editor.
        </p>
        <button
          type="button"
          className="tr-btn tr-btn-primary tr-btn-block"
          onClick={() => {
            onClose();
            navigate("/training");
          }}
        >
          Naar vandaag
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={template.name}
      footer={
        <button
          type="button"
          className="tr-btn tr-btn-primary tr-btn-lg"
          disabled={busy}
          onClick={() => void create()}
        >
          Dit schema gebruiken
        </button>
      }
    >
      <p className="tr-ink-2 text-sm">{template.description}</p>
      {tooMany && (
        <div className="tr-banner tr-banner-warn text-sm">
          Dit schema heeft {template.daysPerWeek} trainingsdagen; je hebt{" "}
          {profile.settings.daysPerWeek} dagen per week opgegeven.
        </div>
      )}
      <div className="space-y-1.5">
        <span className="tr-label">Trainingsniveau</span>
        <Segment
          label="Niveau"
          value={level}
          onChange={setLevel}
          options={(Object.keys(LEVEL_LABELS) as TrainingLevel[]).map((v) => ({
            value: v,
            label: LEVEL_LABELS[v],
          }))}
        />
      </div>
      <div className="space-y-1.5">
        <span className="tr-label">Doel</span>
        <Segment
          label="Doel"
          value={goal}
          onChange={setGoal}
          options={(Object.keys(GOAL_LABELS) as TrainingGoal[]).map((v) => ({
            value: v,
            label: GOAL_LABELS[v],
          }))}
        />
      </div>
      <div className="space-y-1.5">
        <span className="tr-label">Maximale duur per training</span>
        <Segment
          label="Duur"
          value={minutes}
          onChange={setMinutes}
          options={[30, 45, 60, 75, 90].map((v) => ({
            value: v,
            label: `${v} min`,
          }))}
        />
      </div>
      <div className="space-y-1.5">
        <span className="tr-label">Planning</span>
        <Segment
          label="Planning"
          value={mode}
          onChange={setMode}
          options={[
            { value: "weekly", label: "Vaste weekdagen" },
            { value: "sequence", label: "Doorlopende volgorde" },
          ]}
        />
        <p className="tr-muted text-xs">
          {mode === "weekly"
            ? "Elke training op vaste dagen (aan te passen). Gemist? Dan staat hij klaar om in te halen."
            : "Na A komt B, ongeacht de dag. Handig als je week wisselt."}
        </p>
      </div>
      <div className="tr-card-flat space-y-2 p-3">
        <span className="tr-label">Voorbeeld</span>
        {preview.content.days.map((d) => (
          <div key={d.id} className="text-sm">
            <span className="font-semibold">{d.name}</span>
            <span className="tr-muted">
              {" "}
              ·{" "}
              {d.exercises
                .map(
                  (e) =>
                    `${lookup(e.exerciseId)?.name ?? e.exerciseId} ${e.sets}×${e.repMin !== null ? `${e.repMin}–${e.repMax}` : `${e.durationSec}s`}`,
                )
                .join(", ")}
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
