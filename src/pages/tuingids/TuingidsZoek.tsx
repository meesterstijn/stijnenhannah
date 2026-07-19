import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Plant } from "@/lib/supabase";
import { Search } from "lucide-react";
import { encyclopediaCategories } from "@/features/tuingids/data/encyclopedia";
import { diagnoses } from "@/features/tuingids/data/diagnoses";

type ResultItem = {
  id: string;
  type: "plant" | "encyclopedie" | "diagnose";
  emoji: string;
  title: string;
  description: string;
  href: string;
};

function toResults(plants: Plant[], query: string): ResultItem[] {
  const q = query.toLowerCase();
  const results: ResultItem[] = [];

  plants
    .filter((p) => p.name.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q))
    .forEach((p) =>
      results.push({
        id: `plant-${p.id}`,
        type: "plant",
        emoji: "🌱",
        title: p.name,
        description: p.species ?? (p.category ?? "Plant"),
        href: "/tuinieren",
      }),
    );

  encyclopediaCategories
    .filter((c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) ||
      c.sections.some((s) => s.heading.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)))
    .forEach((c) =>
      results.push({
        id: `enc-${c.id}`,
        type: "encyclopedie",
        emoji: c.emoji,
        title: c.title,
        description: c.description,
        href: `/tuingids/encyclopedie/${c.id}`,
      }),
    );

  diagnoses
    .filter((d) => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) ||
      d.oorzaken.some((o) => o.title.toLowerCase().includes(q)))
    .forEach((d) =>
      results.push({
        id: `diag-${d.id}`,
        type: "diagnose",
        emoji: d.emoji,
        title: d.title,
        description: d.description,
        href: `/tuingids/dokter/${d.id}`,
      }),
    );

  return results;
}

const TYPE_LABELS: Record<ResultItem["type"], string> = {
  plant: "Plant",
  encyclopedie: "Encyclopedie",
  diagnose: "Diagnose",
};

export default function TuingidsZoek() {
  const [query, setQuery] = useState("");

  const { data: plants = [] } = useQuery({
    queryKey: ["plants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plants").select("id, name, species, category").order("name");
      if (error) throw error;
      return (data ?? []) as Plant[];
    },
  });

  const results = query.trim().length >= 2 ? toResults(plants, query) : [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] sv-muted">Tuingids</p>
        <h1 className="sv-heading text-3xl mt-1">Zoeken</h1>
        <p className="sv-muted text-sm mt-1">Zoek door planten, encyclopedie en diagnoses.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sv-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Typ minimaal 2 tekens..."
          autoFocus
          className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"
        />
      </div>

      {query.trim().length < 2 && (
        <p className="text-sm sv-muted text-center py-8">Begin te typen om te zoeken</p>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm sv-muted text-center py-8">Geen resultaten voor '{query}'</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs sv-muted">{results.length} resultaten</p>
          {results.map((r) => (
            <Link
              key={r.id}
              to={r.href}
              className="sv-panel flex items-center gap-3 p-3.5 hover:opacity-90 transition-opacity"
            >
              <span className="text-xl shrink-0">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="sv-heading text-xl truncate">{r.title}</p>
                <p className="text-xs sv-muted truncate">{r.description}</p>
              </div>
              <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5 shrink-0">
                {TYPE_LABELS[r.type]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
