import { Crosshair } from "lucide-react";
import { SchietsportPlaceholder } from "@/features/schietsport/components/SchietsportPlaceholder";

export default function SchietsportWapens() {
  return (
    <SchietsportPlaceholder
      icon={Crosshair}
      title="Mijn wapens"
      description="Een profiel en statistieken per wapen."
      comingIn="fase 4"
    />
  );
}
