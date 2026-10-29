import { Trophy } from "lucide-react";
import { SchietsportPlaceholder } from "@/features/schietsport/components/SchietsportPlaceholder";

export default function SchietsportCompetities() {
  return (
    <SchietsportPlaceholder
      icon={Trophy}
      title="Competities"
      description="Competitieperiodes en gekoppelde wedstrijden."
      comingIn="fase 6"
    />
  );
}
