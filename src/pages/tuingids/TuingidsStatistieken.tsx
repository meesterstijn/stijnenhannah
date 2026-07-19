import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useGrowthLog } from "@/features/tuingids/hooks/useGrowthLog";
import { EmptyState } from "@/features/tuingids/components/EmptyState";

const MONTH_LABELS = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];

export default function TuingidsStatistieken() {
  const { entries } = useGrowthLog();
  const [selectedPlant, setSelectedPlant] = useState<string>("all");

  const plantNames = [...new Set(entries.map((e) => e.plant_name))].sort();

  const filtered = selectedPlant === "all" ? entries : entries.filter((e) => e.plant_name === selectedPlant);

  if (entries.length === 0) {
    return (
      <EmptyState
        emoji="📊"
        title="Nog geen data"
        description="Voeg eerst groeinotities toe via het Logboek om hier statistieken te zien."
      />
    );
  }

  // Growth over time (height per entry, sorted by date)
  const growthData = [...filtered]
    .filter((e) => e.height_cm !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      date: new Date(e.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
      hoogte: e.height_cm,
      plant: e.plant_name,
    }));

  // Per month: water + fertilized count
  const monthData = MONTH_LABELS.map((label, i) => {
    const monthEntries = filtered.filter((e) => new Date(e.date).getMonth() === i);
    return {
      maand: label,
      watergiften: monthEntries.filter((e) => e.watered).length,
      bemestingen: monthEntries.filter((e) => e.fertilized).length,
      bloemen: monthEntries.reduce((s, e) => s + (e.flower_count ?? 0), 0),
      vruchten: monthEntries.reduce((s, e) => s + (e.fruit_count ?? 0), 0),
    };
  });

  // Photos per month
  const photoData = MONTH_LABELS.map((label, i) => ({
    maand: label,
    fotos: filtered.filter((e) => e.photo_url && new Date(e.date).getMonth() === i).length,
  }));

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    fontSize: "12px",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tuingids</p>
          <h1 className="font-serif text-3xl font-semibold mt-1">Statistieken</h1>
        </div>
        {plantNames.length > 1 && (
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none mt-1"
          >
            <option value="all">Alle planten</option>
            {plantNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>

      {growthData.length > 1 && (
        <ChartCard title="📏 Hoogte over de tijd">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={growthData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" cm" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} cm`, "Hoogte"]} />
              <Line type="monotone" dataKey="hoogte" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title="💧 Water & bemesting per maand">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="maand" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="watergiften" name="Water" fill="#60a5fa" radius={[4,4,0,0]} />
            <Bar dataKey="bemestingen" name="Bemest" fill="#4ade80" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="🌸 Bloemen & vruchten per maand">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="maand" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="bloemen" name="Bloemen" fill="#f472b6" radius={[4,4,0,0]} />
            <Bar dataKey="vruchten" name="Vruchten" fill="#f97316" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="📷 Foto's per maand">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={photoData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="maand" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Foto's"]} />
            <Bar dataKey="fotos" name="Foto's" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <p className="font-semibold text-sm">{title}</p>
      {children}
    </div>
  );
}
