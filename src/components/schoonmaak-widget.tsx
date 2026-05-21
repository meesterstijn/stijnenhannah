import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Sparkles, ArrowRight } from "lucide-react";

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
      className="group rounded-2xl bg-card border border-border/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3 sm:min-h-[100px]"
    >
      <Sparkles className="h-5 w-5 text-primary shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <p className="font-serif text-base font-semibold leading-tight">Schoonmaak</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{desc}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}
