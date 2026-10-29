import { Plus } from "lucide-react";
import { SchietsportPlaceholder } from "@/features/schietsport/components/SchietsportPlaceholder";

export default function SchietsportNieuw() {
  return (
    <SchietsportPlaceholder
      icon={Plus}
      title="Nieuwe schietbeurt"
      description="Wedstrijd, vrije kaart of oefenwedstrijd vastleggen."
      comingIn="fase 4"
    />
  );
}
