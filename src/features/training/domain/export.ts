import type {
  BodyMetric,
  CustomExerciseRecord,
  Profile,
  Program,
  TrainingSession,
  TrainingSet,
} from "./types";

// Export van alle eigen trainingsgegevens: JSON (alles, volledig) en CSV
// (sets en lichaamsgewicht, voor Excel: puntkomma en decimale komma, net als
// bij Schietsport).

export type TrainingExport = {
  format: "onshuisje-training";
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  programs: Program[];
  exercises: CustomExerciseRecord[];
  sessions: TrainingSession[];
  sets: TrainingSet[];
  bodyMetrics: BodyMetric[];
};

export function buildJsonExport(
  data: Omit<TrainingExport, "format" | "version" | "exportedAt">,
  now: string,
): TrainingExport {
  const alive = <T extends { deletedAt: string | null }>(list: T[]) =>
    list.filter((r) => !r.deletedAt);
  return {
    format: "onshuisje-training",
    version: 1,
    exportedAt: now,
    profile: data.profile,
    programs: alive(data.programs),
    exercises: alive(data.exercises),
    sessions: alive(data.sessions),
    sets: alive(data.sets),
    bodyMetrics: alive(data.bodyMetrics),
  };
}

const cell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "number" ? String(value).replace(".", ",") : String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csv = (rows: unknown[][]) =>
  rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";

export function setsCsv(
  sessions: TrainingSession[],
  sets: TrainingSet[],
  exerciseName: (id: string) => string,
): string {
  const byId = new Map(
    sessions.filter((s) => !s.deletedAt).map((s) => [s.id, s]),
  );
  const rows = sets
    .filter((s) => !s.deletedAt && byId.has(s.sessionId))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  return csv([
    [
      "datum",
      "training",
      "schema",
      "status",
      "oefening",
      "soort",
      "set",
      "kg",
      "herhalingen",
      "duur_s",
      "sprongen",
      "voltooid_op",
    ],
    ...rows.map((s) => {
      const session = byId.get(s.sessionId)!;
      return [
        session.localDate,
        session.name,
        session.snapshot?.programName ?? "",
        session.status,
        exerciseName(s.exerciseId),
        s.kind === "work" ? "werkset" : "opwarmset",
        s.setIndex + 1,
        s.weightKg,
        s.reps,
        s.durationSec,
        s.jumps,
        s.completedAt,
      ];
    }),
  ]);
}

export function bodyCsv(metrics: BodyMetric[]): string {
  const keys = [
    ...new Set(metrics.flatMap((m) => Object.keys(m.measurements ?? {}))),
  ].sort();
  return csv([
    ["datum", "gewicht_kg", ...keys.map((k) => `${k}_cm`), "notitie"],
    ...metrics
      .filter((m) => !m.deletedAt)
      .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn))
      .map((m) => [
        m.measuredOn,
        m.weightKg,
        ...keys.map((k) => m.measurements?.[k] ?? null),
        m.notes,
      ]),
  ]);
}
