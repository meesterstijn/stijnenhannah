import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getDiagnose, diagnoseCategories } from "@/features/tuingids/data/diagnoses";
import { ProbabilityBar } from "@/features/tuingids/components/ProbabilityBar";
import { EmptyState } from "@/features/tuingids/components/EmptyState";
import type { Diagnose } from "@/features/tuingids/types";

const SEVERITY_LABEL: Record<Diagnose["severity"], string> = {
  laag: "Laag risico",
  gemiddeld: "Gemiddeld risico",
  hoog: "Hoog risico",
  kritiek: "Kritiek",
};

const SEVERITY_CLASS: Record<Diagnose["severity"], string> = {
  laag: "sv-badge-ok",
  gemiddeld: "sv-badge-water",
  hoog: "sv-badge-warn",
  kritiek: "sv-badge-error",
};

export default function TuingidsDokterDetail() {
  const { id } = useParams<{ id: string }>();
  const diagnose = id ? getDiagnose(id) : undefined;

  if (!diagnose) {
    return <EmptyState emoji="❓" title="Diagnose niet gevonden" />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/tuingids/dokter"
        className="inline-flex items-center gap-1 text-sm sv-muted hover:opacity-80 transition-opacity"
      >
        <ChevronLeft className="h-4 w-4" /> Plantendokter
      </Link>

      <div>
        <span className="text-4xl">{diagnose.emoji}</span>
        <h1 className="sv-heading text-3xl mt-2">{diagnose.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={`${SEVERITY_CLASS[diagnose.severity]} text-xs rounded-full px-2.5 py-0.5`}>
            {SEVERITY_LABEL[diagnose.severity]}
          </span>
          <span className="sv-badge-ok text-xs rounded-full px-2.5 py-0.5">
            {diagnoseCategories.find((c) => c.id === diagnose.category)?.emoji}{" "}
            {diagnoseCategories.find((c) => c.id === diagnose.category)?.label ?? diagnose.category}
          </span>
        </div>
        <p className="sv-muted mt-2">{diagnose.description}</p>
      </div>

      <div className="space-y-3">
        <h2 className="sv-heading text-xl">Mogelijke oorzaken</h2>
        {diagnose.oorzaken.map((oorzaak, i) => (
          <div key={i} className="sv-panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="sv-heading text-xl">{oorzaak.title}</p>
              <span className="text-xs sv-muted shrink-0">{"★".repeat(oorzaak.probability)}{"☆".repeat(5 - oorzaak.probability)}</span>
            </div>
            <ProbabilityBar value={oorzaak.probability} />

            {oorzaak.symptoms.length > 0 && (
              <div>
                <p className="text-xs font-medium sv-muted uppercase tracking-wider mb-1.5">Symptomen</p>
                <ul className="space-y-1">
                  {oorzaak.symptoms.map((s, j) => (
                    <li key={j} className="text-xs flex items-start gap-1.5">
                      <span className="sv-muted mt-0.5">·</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {oorzaak.solution.length > 0 && (
              <div>
                <p className="text-xs font-medium sv-muted uppercase tracking-wider mb-1.5">Oplossing</p>
                <ul className="space-y-1">
                  {oorzaak.solution.map((s, j) => (
                    <li key={j} className="text-xs flex items-start gap-1.5">
                      <span className="mt-0.5">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {oorzaak.recoveryTime && (
              <p className="text-xs sv-muted">
                <span className="font-medium">Hersteltijd:</span> {oorzaak.recoveryTime}
              </p>
            )}
          </div>
        ))}
      </div>

      {diagnose.prevention.length > 0 && (
        <div className="sv-panel p-4 space-y-2">
          <p className="sv-heading text-xl">Preventie</p>
          <ul className="space-y-1.5">
            {diagnose.prevention.map((p, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="mt-0.5 shrink-0">✓</span> {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnose.related.length > 0 && (
        <div>
          <p className="text-xs font-medium sv-muted uppercase tracking-wider mb-2">Gerelateerde diagnoses</p>
          <div className="flex flex-wrap gap-2">
            {diagnose.related.map((relId) => (
              <Link
                key={relId}
                to={`/tuingids/dokter/${relId}`}
                className="sv-chip text-xs px-3 py-1"
              >
                {relId.replace(/-/g, " ")}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
