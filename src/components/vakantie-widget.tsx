import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Luggage, ArrowRight } from "lucide-react";

type PackingItem = { id: string; checked_stijn: boolean; checked_hannah: boolean };

export function VakantieWidget() {
  const { data: items = [] } = useQuery({
    queryKey: ["packing_items"],
    queryFn: async (): Promise<PackingItem[]> => {
      const { data, error } = await supabase
        .from("packing_items")
        .select("id, checked_stijn, checked_hannah");
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = items.length;
  const stijn = items.filter((i) => i.checked_stijn).length;
  const hannah = items.filter((i) => i.checked_hannah).length;

  const desc =
    total === 0
      ? "Maak een paklijst"
      : `Stijn ${stijn}/${total} · Hannah ${hannah}/${total}`;

  return (
    <Link
      to="/vakantie"
      className="group rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 sm:min-h-[200px]"
    >
      <Luggage className="h-7 w-7 text-primary shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <p className="font-serif text-xl font-semibold">Vakantie</p>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}
