import { useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import {
  Panel,
  PanelEmpty,
  SchietsportPageHeader,
} from "@/features/schietsport/components/SchietsportSurface";
import { SessionForm } from "@/features/schietsport/entry/SessionForm";
import { useSession } from "@/features/schietsport/hooks/useSchietsportData";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

export default function SchietsportSessieBewerken() {
  const { id } = useParams();
  const session = useSession(id);
  if (session === undefined)
    return <div className="ss-card h-64 animate-pulse" />;
  if (!session || session.deletedAt) {
    return (
      <Panel title="Schietbeurt niet gevonden">
        <PanelEmpty
          icon={Trash2}
          text="Deze schietbeurt bestaat niet (meer)."
          action={{
            to: `${SCHIETSPORT_BASE}/logboek`,
            label: "Naar het logboek",
          }}
        />
      </Panel>
    );
  }
  return (
    <div className="space-y-5">
      <SchietsportPageHeader icon={Pencil} title="Schietbeurt bewerken" />
      <SessionForm key={session.id} editing={session} />
    </div>
  );
}
