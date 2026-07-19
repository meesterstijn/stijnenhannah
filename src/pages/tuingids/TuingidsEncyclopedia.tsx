import { useState } from "react";
import { Link } from "react-router-dom";
import { encyclopediaCategories } from "@/features/tuingids/data/encyclopedia";

export default function TuingidsEncyclopedia() {
  const [query, setQuery] = useState("");

  const filtered = encyclopediaCategories.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tuingids</p>
        <h1 className="font-serif text-3xl font-semibold mt-1">Encyclopedie</h1>
        <p className="text-muted-foreground text-sm mt-1">Alles over tuinieren, van A tot Z.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Zoek een onderwerp..."
        className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Geen resultaten voor '{query}'</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((cat) => (
            <Link
              key={cat.id}
              to={`/tuingids/encyclopedie/${cat.id}`}
              className="rounded-2xl border border-border/60 bg-card p-4 hover:bg-accent/30 transition-colors flex flex-col gap-2"
            >
              <span className="text-2xl">{cat.emoji}</span>
              <p className="font-semibold text-sm leading-snug">{cat.title}</p>
              <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{cat.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
