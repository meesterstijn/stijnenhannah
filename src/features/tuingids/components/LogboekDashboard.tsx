import { EVENT_META, EVENT_TYPE_ORDER, eventSentence, type LogboekEvent } from "@/features/tuingids/lib/events";

export function LogboekDashboard({ events }: { events: LogboekEvent[] }) {
  const total = events.length;
  const mostRecent = events[0];

  const counts = EVENT_TYPE_ORDER.map((type) => ({
    type,
    ...EVENT_META[type],
    count: events.reduce((n, e) => (e.type === type ? n + 1 : n), 0),
  }));

  return (
    <div className="sv-panel p-4 space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <p className="sv-heading text-xl">Overzicht</p>
        <p className="text-sm sv-muted">{total} gebeurtenis{total === 1 ? "" : "sen"} totaal</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {counts.map((c) => (
          <div key={c.type} className="sv-inset rounded-lg px-3 py-2 text-center">
            <p className="text-lg leading-none">{c.emoji}</p>
            <p className="sv-heading text-lg leading-tight">{c.count}</p>
            <p className="text-xs sv-muted">{c.label}</p>
          </div>
        ))}
      </div>

      {mostRecent && (
        <p className="text-xs sv-muted">
          Meest recent: {eventSentence(mostRecent)} ·{" "}
          {new Date(mostRecent.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
