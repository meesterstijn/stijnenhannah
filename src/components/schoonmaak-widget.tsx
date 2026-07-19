import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Sparkles } from "lucide-react";

type CleaningTask = {
  id: string;
  last_done_at: string | null;
  interval_days: number;
};

function daysUntilDue(dateStr: string | null, intervalDays: number): number {
  if (!dateStr) return 0;
  const daysSince = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  return intervalDays - daysSince;
}

export function SchoonmaakWidget() {
  const { data: tasks = [] } = useQuery({
    queryKey: ["cleaning_tasks"],
    queryFn: async (): Promise<CleaningTask[]> => {
      const { data, error } = await supabase
        .from("cleaning_tasks")
        .select("id, last_done_at, interval_days");
      if (error) throw error;
      return data ?? [];
    },
  });

  const withDays = tasks.map((t) => ({ ...t, daysLeft: daysUntilDue(t.last_done_at, t.interval_days) }));
  const overdue = withDays.filter((t) => t.daysLeft <= 0);
  const soonest = withDays.filter((t) => t.daysLeft > 0).sort((a, b) => a.daysLeft - b.daysLeft)[0];

  const desc =
    overdue.length > 0
      ? `${overdue.length} ${overdue.length === 1 ? "taak" : "taken"} te doen`
      : soonest
      ? soonest.daysLeft === 1
        ? "Morgen weer aan de beurt"
        : `Volgende over ${soonest.daysLeft} dagen`
      : "Alles bijgewerkt";

  return (
    <Link
      to="/schoonmaak"
      className="sv-panel group p-4 hover:-translate-y-0.5 transition-transform flex items-center gap-3 sm:min-h-[100px]"
    >
      <div className="sv-icon-slot h-10 w-10 flex items-center justify-center shrink-0">
        <Sparkles className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="sv-heading text-2xl leading-tight truncate">Schoonmaak</p>
        <p className="text-xs sv-muted mt-0.5 leading-tight truncate">{desc}</p>
      </div>
    </Link>
  );
}
