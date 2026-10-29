import { Settings } from "lucide-react";
import { SchietsportPlaceholder } from "@/features/schietsport/components/SchietsportPlaceholder";

export default function SchietsportInstellingen() {
  return (
    <SchietsportPlaceholder
      icon={Settings}
      title="Instellingen"
      description="Disciplines, synchronisatie en back-ups."
      comingIn="fase 6"
    />
  );
}
