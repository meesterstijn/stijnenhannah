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
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tuingids</p>
        <h1 className="font-serif text-3xl font-semibold mt-1">Plantendokter</h1>
        <p className="text-muted-foreground text-sm mt-1">Kies een symptoom en ontdek mogelijke oorzaken en oplossingen.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Beschrijf het symptoom..."
        className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            activeCategory === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          Alles
        </button>
        {diagnoseCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Geen resultaten</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <Link
              key={d.id}
              to={`/tuingids/dokter/${d.id}`}
              className="rounded-2xl border border-border/60 bg-card p-4 hover:bg-accent/30 transition-colors flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{d.emoji}</span>
                <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground capitalize">
                  {diagnoseCategories.find((c) => c.id === d.category)?.label ?? d.category}
                </span>
              </div>
              <p className="font-semibold text-sm">{d.title}</p>
              <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{d.description}</p>
              <p className="text-xs text-primary mt-auto">{d.oorzaken.length} mogelijke oorzaken →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
