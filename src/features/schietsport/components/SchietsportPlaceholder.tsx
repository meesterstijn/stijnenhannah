import { Hammer, type LucideIcon } from "lucide-react";
import {
  Panel,
  PanelEmpty,
  SchietsportPageHeader,
} from "@/features/schietsport/components/SchietsportSurface";

// Tijdelijke inhoud voor schermen die in een latere fase gebouwd worden.
export function SchietsportPlaceholder({
  icon,
  title,
  description,
  comingIn,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  comingIn: string;
}) {
  return (
    <div className="space-y-6">
      <SchietsportPageHeader
        icon={icon}
        title={title}
        description={description}
      />
      <Panel title="Nog in aanbouw">
        <PanelEmpty icon={Hammer} text={`Dit onderdeel komt in ${comingIn}.`} />
      </Panel>
    </div>
  );
}
