import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Crosshair,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Panel,
  PanelEmpty,
  StatCard,
} from "@/features/schietsport/components/SchietsportSurface";
import {
  Button,
  ConfirmDialog,
  FormSheet,
} from "@/features/schietsport/components/form";
import { WeaponForm } from "@/features/schietsport/components/WeaponForm";
import {
  WeaponThumb,
  weaponSubtitle,
} from "@/features/schietsport/components/WeaponCard";
import { SessionRow } from "@/features/schietsport/components/SessionRow";
import {
  RangeRows,
  ScoreTrendChart,
} from "@/features/schietsport/components/charts";
import {
  personalBest,
  splitByScale,
  summarize,
} from "@/features/schietsport/domain/stats";
import { groupRows, trendSeries } from "@/features/schietsport/domain/insights";
import { softDelete, updateWeapon } from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useDisciplines,
  useSessions,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import { formatMean } from "@/features/schietsport/lib/format";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

const NONE: never[] = [];

export default function SchietsportWapenDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db } = useSchietsport();
  const weapons = useWeapons({ includeArchived: true });
  const disciplines = useDisciplines({ includeArchived: true }) ?? NONE;
  const sessions = useSessions();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const weapon = weapons?.find((w) => w.id === id);
  const own = useMemo(
    () => (sessions ?? NONE).filter((s) => s.weaponId === id),
    [sessions, id],
  );
  const { 300: big, 50: small } = splitByScale(own);
  const matches = own.filter((s) => s.type === "match");
  const matchSummary = summarize(matches);
  const bigSummary = summarize(big);
  const smallSummary = summarize(small);
  const best = big.length > 0 ? personalBest(big) : null;
  const trend = useMemo(() => trendSeries(big), [big]);

  if (weapons === undefined || sessions === undefined) {
    return <div className="ss-card h-64 animate-pulse" />;
  }
  if (!weapon) {
    return (
      <Panel title="Wapen niet gevonden">
        <PanelEmpty
          icon={Crosshair}
          text="Dit wapen bestaat niet (meer)."
          action={{
            to: `${SCHIETSPORT_BASE}/wapens`,
            label: "Naar mijn wapens",
          }}
        />
      </Panel>
    );
  }

  const disciplineName = (key: string) =>
    disciplines.find((d) => d.id === key)?.name ?? "—";

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Terug
      </button>

      <section className="ss-hero">
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          <WeaponThumb weapon={weapon} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="ss-eyebrow">
              {weapon.ownership === "geleend" ? "Geleend wapen" : "Eigen wapen"}
              {weapon.archivedAt ? " · gearchiveerd" : ""}
            </p>
            <h1 className="mt-0.5 truncate text-2xl font-semibold sm:text-3xl">
              {weapon.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {weaponSubtitle(weapon)}
            </p>
            {weapon.notes && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {weapon.notes}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Bewerken
            </Button>
            <Button
              onClick={async () => {
                await updateWeapon(db, weapon.id, {
                  archivedAt: weapon.archivedAt
                    ? null
                    : new Date().toISOString(),
                });
                toast.success(
                  weapon.archivedAt ? "Wapen hersteld" : "Wapen gearchiveerd",
                );
              }}
            >
              {weapon.archivedAt ? (
                <>
                  <ArchiveRestore className="h-4 w-4" /> Herstellen
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Archiveren
                </>
              )}
            </Button>
            {own.length === 0 && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Verwijderen
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Schietbeurten"
          value={own.length}
          detail={`${matches.length} wedstr. · ${own.filter((s) => s.type === "practice_match").length} oefen · ${small.length} kaart`}
        />
        <StatCard
          label="Gem. wedstrijd"
          value={matchSummary ? formatMean(matchSummary.mean) : "—"}
          suffix={matchSummary ? "/300" : undefined}
          detail="officiële wedstrijden"
        />
        <StatCard
          label="Record"
          tone="copper"
          value={best ? best.totalScore : "—"}
          suffix={best ? "/300" : undefined}
          detail="wedstrijd of oefenwedstrijd"
        />
        <StatCard
          label="Gem. vrije kaart"
          value={smallSummary ? formatMean(smallSummary.mean) : "—"}
          suffix={smallSummary ? "/50" : undefined}
          detail={
            smallSummary ? `record ${smallSummary.max}` : "nog geen kaarten"
          }
        />
      </div>

      {own.length === 0 ? (
        <Panel title="Nog niet mee geschoten">
          <PanelEmpty
            icon={Crosshair}
            text="Zodra je met dit wapen een schietbeurt vastlegt, zie je hier de statistieken."
          />
        </Panel>
      ) : (
        <>
          {trend.length > 0 && (
            <Panel title="Scoreontwikkeling">
              <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                Wedstrijden en oefenwedstrijden, schaal 300
                {bigSummary
                  ? ` · spreiding ${formatMean(bigSummary.stdDev)}`
                  : ""}
              </p>
              <ScoreTrendChart points={trend} scale={300} />
            </Panel>
          )}
          {big.length > 0 && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel title="Per afstand">
                <RangeRows
                  rows={groupRows(
                    big,
                    (s) => String(s.distance),
                    (k) => `${k} meter`,
                  )}
                  scale={300}
                />
              </Panel>
              <Panel title="Per discipline">
                <RangeRows
                  rows={groupRows(big, (s) => s.disciplineId, disciplineName)}
                  scale={300}
                />
              </Panel>
            </div>
          )}
          <Panel
            title="Recente schietbeurten"
            action={{
              to: `${SCHIETSPORT_BASE}/logboek?w=${weapon.id}`,
              label: "Alles in logboek",
            }}
          >
            <div className="-mx-2 divide-y divide-white/5">
              {[...own]
                .reverse()
                .slice(0, 6)
                .map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    weapons={weapons}
                    disciplines={disciplines}
                  />
                ))}
            </div>
          </Panel>
        </>
      )}

      {weapons.filter((w) => !w.archivedAt).length >= 2 && (
        <Link
          to={`${SCHIETSPORT_BASE}/wapens/vergelijken?wapens=${weapon.id}`}
          className="inline-flex text-sm text-muted-foreground hover:text-foreground"
        >
          Vergelijk met een ander wapen →
        </Link>
      )}

      <FormSheet
        open={editing}
        onOpenChange={setEditing}
        title="Wapen bewerken"
      >
        <WeaponForm weapon={weapon} onDone={() => setEditing(false)} />
      </FormSheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Wapen verwijderen?"
        description="Er zijn nog geen schietbeurten met dit wapen. Het profiel verdwijnt, ook op je andere apparaten."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={async () => {
          await softDelete(db, "weapon", weapon.id);
          navigate(`${SCHIETSPORT_BASE}/wapens`, { replace: true });
          toast.success("Wapen verwijderd");
        }}
      />
    </div>
  );
}
