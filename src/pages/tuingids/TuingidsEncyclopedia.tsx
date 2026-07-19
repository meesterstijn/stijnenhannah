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
        <p className="text-xs uppercase tracking-[0.2em] sv-muted">Tuingids</p>
        <h1 className="sv-heading text-3xl mt-1">Encyclopedie</h1>
        <p className="sv-muted text-sm mt-1">Alles over tuinieren, van A tot Z.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Zoek een onderwerp..."
        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
      />

      {filtered.length === 0 ? (
        <p className="text-sm sv-muted text-center py-8">Geen resultaten voor '{query}'</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((cat) => (
            <Link
              key={cat.id}
              to={`/tuingids/encyclopedie/${cat.id}`}
              className="sv-panel p-4 hover:opacity-90 transition-opacity flex flex-col gap-2"
            >
              <span className="text-2xl">{cat.emoji}</span>
              <p className="sv-heading text-xl leading-snug">{cat.title}</p>
              <p className="text-xs sv-muted leading-snug line-clamp-2">{cat.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
