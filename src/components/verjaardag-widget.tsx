import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Cake, ArrowRight } from "lucide-react";

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
    .slice(0, 3);

  return (
    <Link
      to="/verjaardagen"
      className="group rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-3 sm:min-h-[200px]"
    >
      <div className="flex items-center justify-between">
        <Cake className="h-7 w-7 text-primary" strokeWidth={1.6} />
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>

      <div className="flex-1">
        <p className="font-serif text-xl font-semibold">Verjaardagen</p>
        {isLoading && <p className="text-sm text-muted-foreground mt-1">Laden…</p>}
        {!isLoading && birthdays.length === 0 && (
          <p className="text-sm text-muted-foreground mt-1">Nog geen verjaardagen</p>
        )}
        {sorted.length > 0 && (
          <ul className="mt-2 space-y-2">
            {sorted.map((b) => {
              const nextYear = new Date().getFullYear() + (b.days === 0 ? 0 : (new Date(new Date().getFullYear(), b.month - 1, b.day) < new Date() ? 1 : 0));
              const age = b.year ? nextYear - b.year : null;
              const daysLabel = b.days === 0 ? "Vandaag! 🎂" : b.days === 1 ? "Morgen" : `Over ${b.days} dagen`;
              return (
                <li key={b.id} className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-tight">{b.name}</span>
                  <div className={`text-right shrink-0 ${b.days <= 1 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    <p className="text-xs">{daysLabel}</p>
                    {age && <p className="text-xs">{b.days === 0 ? `${age} jaar` : `wordt ${age}`}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Link>
  );
}
