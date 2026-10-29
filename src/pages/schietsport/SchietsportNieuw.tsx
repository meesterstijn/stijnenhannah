import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { SchietsportPageHeader } from "@/features/schietsport/components/SchietsportSurface";
import { SessionForm } from "@/features/schietsport/entry/SessionForm";
import { isSessionType } from "@/features/schietsport/domain/rules";

export default function SchietsportNieuw() {
  const [params] = useSearchParams();
  const type = params.get("type");
  const initialType = isSessionType(type) ? type : undefined;
  return (
    <div className="space-y-5">
      <SchietsportPageHeader
        icon={Plus}
        title="Nieuwe schietbeurt"
        description="Kies het type, vul je score in en sla op."
        hideOnMobile
      />
      <SessionForm key={initialType ?? "standaard"} initialType={initialType} />
    </div>
  );
}
