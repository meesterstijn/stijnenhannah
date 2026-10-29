import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crosshair, GitCompareArrows, Plus } from "lucide-react";
import {
  Panel,
  PanelEmpty,
  SchietsportPageHeader,
} from "@/features/schietsport/components/SchietsportSurface";
import { Button, FormSheet } from "@/features/schietsport/components/form";
import { WeaponForm } from "@/features/schietsport/components/WeaponForm";
import { WeaponCard } from "@/features/schietsport/components/WeaponCard";
import {
  useSessions,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

export default function SchietsportWapens() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const weapons = useWeapons({ includeArchived: showArchived });
  const sessions = useSessions() ?? [];
  const active = weapons?.filter((w) => !w.archivedAt) ?? [];
  const archived = weapons?.filter((w) => w.archivedAt) ?? [];

  return (
    <div className="space-y-6">
      <SchietsportPageHeader
        icon={Crosshair}
        title="Mijn wapens"
        description="Elk wapen een eigen profiel en eigen statistieken."
        actions={
          <>
            {active.length >= 2 && (
              <Link
                to={`${SCHIETSPORT_BASE}/wapens/vergelijken`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm hover:bg-white/10"
              >
                <GitCompareArrows className="h-4 w-4" />
                Vergelijken
              </Link>
            )}
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Wapen toevoegen
            </Button>
          </>
        }
      />

      {weapons && active.length === 0 ? (
        <Panel title="Nog geen wapens">
          <PanelEmpty
            icon={Crosshair}
            text="Voeg je eerste wapen toe. Je kunt ook schieten met een onbekend of geleend wapen zonder profiel."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {active.map((weapon) => (
            <WeaponCard key={weapon.id} weapon={weapon} sessions={sessions} />
          ))}
        </div>
      )}

      {showArchived && archived.length > 0 && (
        <section className="space-y-3">
          <p className="ss-eyebrow">Gearchiveerd</p>
          <div className="grid gap-3 opacity-80 lg:grid-cols-2">
            {archived.map((weapon) => (
              <WeaponCard key={weapon.id} weapon={weapon} sessions={sessions} />
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setShowArchived((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {showArchived
          ? "Gearchiveerde wapens verbergen"
          : "Gearchiveerde wapens tonen"}
      </button>

      <FormSheet
        open={creating}
        onOpenChange={setCreating}
        title="Wapen toevoegen"
      >
        <WeaponForm
          onDone={(weapon) => {
            setCreating(false);
            navigate(`${SCHIETSPORT_BASE}/wapens/${weapon.id}`);
          }}
        />
      </FormSheet>
    </div>
  );
}
