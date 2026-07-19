import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Cake } from "lucide-react";

type Birthday = { id: string; name: string; day: number; month: number; year: number | null };

const MONTHS = [
  "jan","feb","mrt","apr","mei","jun",
  "jul","aug","sep","okt","nov","dec",
];

async function fetchBirthdays(): Promise<Birthday[]> {
  const { data, error } = await supabase.from("birthdays").select("id, name, day, month, year");
  if (error) throw error;
  return data ?? [];
}

function nextOccurrence(day: number, month: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function VerjaarDagWidget() {
  const { data: birthdays = [], isLoading } = useQuery({
    queryKey: ["birthdays"],
    queryFn: fetchBirthdays,
  });

  const sorted = [...birthdays]
    .map((b) => ({ ...b, days: nextOccurrence(b.day, b.month) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 2);

  return (
    <Link
      to="/verjaardagen"
      className="sv-panel group p-4 hover:-translate-y-0.5 transition-transform flex items-center gap-3 sm:min-h-[100px]"
    >
      <div className="sv-icon-slot h-10 w-10 flex items-center justify-center shrink-0">
        <Cake className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="sv-heading text-2xl leading-tight truncate">Verjaardagen</p>
        {isLoading && <p className="text-xs sv-muted mt-0.5">Laden…</p>}
        {!isLoading && birthdays.length === 0 && (
          <p className="text-xs sv-muted mt-0.5">Nog geen verjaardagen</p>
        )}
        {sorted.length > 0 && (() => {
          const b = sorted[0];
          const daysLabel = b.days === 0 ? "Vandaag! 🎂" : b.days === 1 ? "Morgen" : `Over ${b.days} dagen`;
          return (
            <p className={`text-xs mt-0.5 leading-tight truncate ${b.days <= 1 ? "font-semibold" : "sv-muted"}`}>
              {b.name} · {daysLabel}
            </p>
          );
        })()}
      </div>
    </Link>
  );
}
