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
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Encyclopedie
      </Link>

      <div>
        <span className="text-4xl">{cat.emoji}</span>
        <h1 className="font-serif text-3xl font-semibold mt-2">{cat.title}</h1>
        <p className="text-muted-foreground mt-1">{cat.description}</p>
      </div>

      <div className="space-y-5">
        {cat.sections.map((section, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <h2 className="font-semibold text-base">{section.heading}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
            {section.tips && section.tips.length > 0 && (
              <ul className="space-y-1.5 mt-2">
                {section.tips.map((tip, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5 shrink-0">✓</span>
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
