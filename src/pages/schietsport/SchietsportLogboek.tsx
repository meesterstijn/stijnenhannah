import { NotebookText } from "lucide-react";
import { SchietsportPlaceholder } from "@/features/schietsport/components/SchietsportPlaceholder";

export default function SchietsportLogboek() {
  return (
    <SchietsportPlaceholder
      icon={NotebookText}
      title="Logboek"
      description="Al je schietbeurten op een rij."
      comingIn="fase 4"
    />
  );
}
