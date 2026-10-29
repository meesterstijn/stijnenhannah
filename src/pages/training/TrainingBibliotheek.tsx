import { useState } from "react";
import { ProgramSetup } from "@/features/training/components/ProgramSetup";
import { PageHeader } from "@/features/training/components/ui";
import {
  PROGRAM_TEMPLATES,
  type ProgramTemplate,
} from "@/features/training/domain/templates";
import { useExercises } from "@/features/training/hooks/useTrainingData";

// Trainingsbibliotheek / coachprogramma's. Nieuwe schema's toevoegen = een
// nieuw sjabloon in domain/templates.ts (category "library").
export default function TrainingBibliotheek() {
  const [template, setTemplate] = useState<ProgramTemplate | null>(null);
  const { lookup } = useExercises();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Trainingsbibliotheek"
        subtitle="Zelf samengestelde schema's op basis van algemeen beschreven trainingsprincipes. Geen kopie van betaalde of exclusieve programma's, en niet naar een coach vernoemd."
      />
      {PROGRAM_TEMPLATES.map((t) => (
        <article key={t.id} className="tr-card space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="tr-h2">{t.name}</h2>
              <p className="tr-muted text-sm">
                {t.daysPerWeek} dagen per week · {t.recommendedLevel}
              </p>
            </div>
            <button
              type="button"
              className="tr-btn tr-btn-primary"
              onClick={() => setTemplate(t)}
            >
              Gebruiken
            </button>
          </div>
          <p className="tr-ink-2 text-sm">{t.description}</p>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Opbouw, uitgangspunten en bronnen
            </summary>
            <div className="mt-3 space-y-3 text-sm">
              {t.days.map((d) => (
                <div key={d.key}>
                  <span className="font-semibold">{d.name}</span>
                  <span className="tr-muted"> · {d.focus}</span>
                  <div className="tr-ink-2">
                    {d.exercises
                      .map((e) => lookup(e.exerciseId)?.name ?? e.exerciseId)
                      .join(", ")}
                  </div>
                </div>
              ))}
              <div>
                <h3 className="tr-label mb-1">Uitgangspunten</h3>
                <ul className="list-disc space-y-1 pl-5">
                  {t.principles.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="tr-label mb-1">
                  Gebaseerd op algemene principes uit
                </h3>
                <ul className="tr-muted list-disc space-y-1 pl-5 text-xs">
                  {t.sources.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <p className="tr-muted text-xs">
                Bron van het schema zelf: eigen samenstelling binnen Ons Huisje,
                afgestemd op thuisapparatuur zonder rek of spotter. Geen medisch
                advies en geen garantie tegen blessures.
              </p>
            </div>
          </details>
        </article>
      ))}
      <ProgramSetup template={template} onClose={() => setTemplate(null)} />
    </div>
  );
}
