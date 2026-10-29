import { LayoutDashboard } from "lucide-react";
import { SchietsportPlaceholder } from "@/features/schietsport/components/SchietsportPlaceholder";

export default function SchietsportDashboard() {
  return (
    <SchietsportPlaceholder
      icon={LayoutDashboard}
      title="Dashboard"
      description="Je laatste resultaten, records en trends."
      comingIn="fase 5"
    />
  );
}
