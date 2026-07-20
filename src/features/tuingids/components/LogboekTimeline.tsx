import { useState } from "react";
import { EVENT_META, EVENT_TYPE_ORDER, eventSentence, type EventType, type LogboekEvent } from "@/features/tuingids/lib/events";
import { EmptyState } from "@/features/tuingids/components/EmptyState";

function filterChipClass(active: boolean): string {
  return `sv-chip px-3 py-1.5 text-xs font-medium${active ? " active" : ""}`;
}

export function LogboekTimeline({ events }: { events: LogboekEvent[] }) {
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setFilter("all")} className={filterChipClass(filter === "all")}>
          Alles
        </button>
        {EVENT_TYPE_ORDER.map((type) => (
          <button key={type} type="button" onClick={() => setFilter(type)} className={filterChipClass(filter === type)}>
            {EVENT_META[type].emoji} {EVENT_META[type].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          emoji="📖"
          title="Nog geen gebeurtenissen"
          description="Zodra je water geeft, voeding geeft, groei registreert, oogst, snoeit of verpot, verschijnt dit hier."
        />
      ) : (
        <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
          {filtered.map((event) => {
            const Icon = EVENT_META[event.type].icon;
            return (
              <div key={event.id} className="sv-panel px-4 py-3 flex items-start gap-3">
                <Icon className="h-4 w-4 shrink-0 mt-0.5 sv-muted" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    {eventSentence(event)}
                    {event.detail && <span className="sv-muted"> ({event.detail})</span>}
                  </p>
                  <p className="text-xs sv-muted">
                    {new Date(event.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
