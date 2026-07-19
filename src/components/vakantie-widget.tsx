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
      className="sv-panel group p-4 hover:-translate-y-0.5 transition-transform flex items-center gap-3 sm:min-h-[100px]"
    >
      <div className="sv-icon-slot h-10 w-10 flex items-center justify-center shrink-0">
        <Luggage className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="sv-heading text-2xl leading-tight truncate">Vakantie</p>
        <p className="text-xs sv-muted mt-0.5 leading-tight truncate">{desc}</p>
      </div>
    </Link>
  );
}
