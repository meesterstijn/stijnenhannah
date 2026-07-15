import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Luggage } from "lucide-react";

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
      className="group rounded-2xl bg-card border border-border/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3 sm:min-h-[100px]"
    >
      <Luggage className="h-5 w-5 text-primary shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <p className="font-serif text-base font-semibold leading-tight truncate">Vakantie</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight truncate">{desc}</p>
      </div>
    </Link>
  );
}
