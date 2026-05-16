import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Sparkles, ArrowRight } from "lucide-react";

type CleaningTask = {
  id: string;
  last_done_at: string | null;
  interval_days: number;
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
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

  const overdue = tasks.filter((t) => {
    const days = daysSince(t.last_done_at);
    return days === null || days >= t.interval_days;
  });

  const desc =
    overdue.length === 0
      ? "Alles bijgewerkt"
      : `${overdue.length} ${overdue.length === 1 ? "taak" : "taken"} te doen`;

  return (
    <Link
      to="/schoonmaak"
      className="group rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 sm:min-h-[200px]"
    >
      <Sparkles className="h-7 w-7 text-primary shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <p className="font-serif text-xl font-semibold">Schoonmaak</p>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}
