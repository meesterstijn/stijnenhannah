import { useState } from "react";
import { Link } from "react-router-dom";
import { diagnoses, diagnoseCategories } from "@/features/tuingids/data/diagnoses";

export default function TuingidsDokter() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered = diagnoses.filter((d) => {
    const matchCat = activeCategory === "all" || d.category === activeCategory;
    const matchQuery =
      !query ||
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      d.description.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="sv-muted text-sm">Kies een symptoom en ontdek mogelijke oorzaken en oplossingen.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Beschrijf het symptoom..."
        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
      />

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`sv-chip px-3 py-1.5 text-sm font-medium${activeCategory === "all" ? " active" : ""}`}
        >
          Alles
        </button>
        {diagnoseCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`sv-chip px-3 py-1.5 text-sm font-medium${activeCategory === cat.id ? " active" : ""}`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm sv-muted text-center py-8">Geen resultaten</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <Link
              key={d.id}
              to={`/tuingids/dokter/${d.id}`}
              className="sv-panel p-4 hover:opacity-90 transition-opacity flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{d.emoji}</span>
                <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5 capitalize">
                  {diagnoseCategories.find((c) => c.id === d.category)?.label ?? d.category}
                </span>
              </div>
              <p className="sv-heading text-xl">{d.title}</p>
              <p className="text-xs sv-muted leading-snug line-clamp-2">{d.description}</p>
              <p className="text-xs sv-muted mt-auto">{d.oorzaken.length} mogelijke oorzaken →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
