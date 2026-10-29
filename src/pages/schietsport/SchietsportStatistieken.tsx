import { ChartLine } from "lucide-react";
import { SchietsportPlaceholder } from "@/features/schietsport/components/SchietsportPlaceholder";

export default function SchietsportStatistieken() {
  return (
    <SchietsportPlaceholder
      icon={ChartLine}
      title="Statistieken"
      description="Analyseer je prestaties per wapen, afstand en discipline."
      comingIn="fase 5"
    />
  );
}
