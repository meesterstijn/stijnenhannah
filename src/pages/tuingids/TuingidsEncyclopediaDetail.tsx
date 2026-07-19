import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getCategory } from "@/features/tuingids/data/encyclopedia";
import { EmptyState } from "@/features/tuingids/components/EmptyState";

export default function TuingidsEncyclopediaDetail() {
  const { id } = useParams<{ id: string }>();
  const cat = id ? getCategory(id) : undefined;

  if (!cat) {
    return <EmptyState emoji="❓" title="Onderwerp niet gevonden" description="Keer terug naar de encyclopedie." />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/tuingids/encyclopedie"
        className="inline-flex items-center gap-1 text-sm sv-muted hover:opacity-80 transition-opacity"
      >
        <ChevronLeft className="h-4 w-4" /> Encyclopedie
      </Link>

      <div>
        <span className="text-4xl">{cat.emoji}</span>
        <h1 className="sv-heading text-3xl mt-2">{cat.title}</h1>
        <p className="sv-muted mt-1">{cat.description}</p>
      </div>

      <div className="space-y-5">
        {cat.sections.map((section, i) => (
          <div key={i} className="sv-panel p-5 space-y-3">
            <h2 className="sv-heading text-xl">{section.heading}</h2>
            <p className="text-sm sv-muted leading-relaxed">{section.content}</p>
            {section.tips && section.tips.length > 0 && (
              <ul className="space-y-1.5 mt-2">
                {section.tips.map((tip, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 shrink-0">✓</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
