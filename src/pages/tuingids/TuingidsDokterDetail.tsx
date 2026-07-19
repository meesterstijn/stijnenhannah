import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getDiagnose } from "@/features/tuingids/data/diagnoses";
import { ProbabilityBar } from "@/features/tuingids/components/ProbabilityBar";
import { EmptyState } from "@/features/tuingids/components/EmptyState";

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
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Plantendokter
      </Link>

      <div>
        <span className="text-4xl">{diagnose.emoji}</span>
        <h1 className="font-serif text-3xl font-semibold mt-2">{diagnose.title}</h1>
        <p className="text-muted-foreground mt-1">{diagnose.description}</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-base">Mogelijke oorzaken</h2>
        {diagnose.oorzaken.map((oorzaak, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-sm">{oorzaak.title}</p>
              <span className="text-xs text-muted-foreground shrink-0">{"★".repeat(oorzaak.probability)}{"☆".repeat(5 - oorzaak.probability)}</span>
            </div>
            <ProbabilityBar value={oorzaak.probability} />

            {oorzaak.symptoms.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Symptomen</p>
                <ul className="space-y-1">
                  {oorzaak.symptoms.map((s, j) => (
                    <li key={j} className="text-xs flex items-start gap-1.5">
                      <span className="text-muted-foreground mt-0.5">·</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {oorzaak.solution.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Oplossing</p>
                <ul className="space-y-1">
                  {oorzaak.solution.map((s, j) => (
                    <li key={j} className="text-xs flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {diagnose.prevention.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
          <p className="font-semibold text-sm">Preventie</p>
          <ul className="space-y-1.5">
            {diagnose.prevention.map((p, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">✓</span> {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnose.related.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Gerelateerde diagnoses</p>
          <div className="flex flex-wrap gap-2">
            {diagnose.related.map((relId) => (
              <Link
                key={relId}
                to={`/tuingids/dokter/${relId}`}
                className="text-xs border border-border rounded-full px-3 py-1 hover:bg-accent/30 transition-colors"
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
