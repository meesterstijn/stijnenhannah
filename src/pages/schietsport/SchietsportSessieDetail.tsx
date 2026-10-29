import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Panel,
  PanelEmpty,
} from "@/features/schietsport/components/SchietsportSurface";
import { Button, ConfirmDialog } from "@/features/schietsport/components/form";
import {
  SyncBadge,
  TypeIcon,
} from "@/features/schietsport/components/SessionRow";
import { CompetitionLinks } from "@/features/schietsport/components/CompetitionLinks";
import {
  SESSION_TYPE_LABELS,
  SHOT_MAX,
  layoutLabel,
} from "@/features/schietsport/domain/rules";
import {
  deleteSession,
  writeRecord,
} from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useDisciplines,
  useSession,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import {
  formatDateLong,
  formatPercent,
} from "@/features/schietsport/lib/format";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

export default function SchietsportSessieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db } = useSchietsport();
  const session = useSession(id);
  const weapons = useWeapons({ includeArchived: true }) ?? [];
  const disciplines = useDisciplines({ includeArchived: true }) ?? [];
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (session === undefined) {
    return <div className="ss-card h-64 animate-pulse" />;
  }
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

  const weapon = weapons.find((w) => w.id === session.weaponId);
  const discipline = disciplines.find((d) => d.id === session.disciplineId);
  const percent = (session.totalScore / session.maxScore) * 100;

  async function remove() {
    const snapshot = session!;
    await deleteSession(db, snapshot.id);
    navigate(`${SCHIETSPORT_BASE}/logboek`, { replace: true });
    toast("Schietbeurt verwijderd", {
      action: {
        label: "Ongedaan maken",
        onClick: () =>
          void writeRecord(db, "session", {
            ...snapshot,
            deletedAt: null,
            updatedAt: new Date().toISOString(),
          }),
      },
    });
  }

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
        <div className="relative flex flex-wrap items-end justify-between gap-5 p-5 sm:p-7">
          <div className="flex items-center gap-3.5">
            <TypeIcon type={session.type} />
            <div>
              <p className="ss-eyebrow">{SESSION_TYPE_LABELS[session.type]}</p>
              <h1 className="mt-0.5 text-xl font-semibold first-letter:uppercase sm:text-2xl">
                {formatDateLong(session.sessionDate)}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <p className="ss-number leading-none">
              <span className="text-5xl font-semibold text-[var(--ss-copper)]">
                {session.totalScore}
              </span>
              <span className="text-lg text-muted-foreground">
                {" "}
                / {session.maxScore}
              </span>
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {formatPercent(percent)} van het maximum
            </p>
          </div>
        </div>
      </section>

      <section className="ss-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:p-5">
        <Meta label="Wapen">
          {weapon ? (
            <Link
              to={`${SCHIETSPORT_BASE}/wapens/${weapon.id}`}
              className="hover:text-[var(--ss-copper)]"
            >
              {weapon.name}
            </Link>
          ) : (
            "Onbekend wapen"
          )}
        </Meta>
        <Meta label="Discipline">{discipline?.name ?? "—"}</Meta>
        <Meta label="Afstand">{session.distance} meter</Meta>
        <Meta label="Indeling">
          {session.cards.length > 0
            ? layoutLabel(session.cards.map((c) => c.shotCount))
            : "Alleen totaal"}
        </Meta>
      </section>

      {session.cards.length > 0 ? (
        <Panel title={session.cards.length === 1 ? "Kaart" : "Kaarten"}>
          <div className="space-y-2">
            {session.cards.map((card) => {
              const max = card.shotCount * SHOT_MAX;
              return (
                <div
                  key={card.cardNumber}
                  className="rounded-xl bg-black/20 p-3"
                >
                  <div className="flex items-center gap-3">
                    <p className="w-16 shrink-0 text-sm text-muted-foreground">
                      Kaart {card.cardNumber}
                    </p>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-[var(--ss-copper)]"
                        style={{ width: `${(card.score / max) * 100}%` }}
                      />
                    </div>
                    <p className="ss-number w-16 text-right">
                      <span className="font-semibold">{card.score}</span>
                      <span className="text-xs text-muted-foreground">
                        /{max}
                      </span>
                    </p>
                  </div>
                  {card.shots && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {card.shots.map((shot, i) => (
                        <span
                          key={i}
                          className={`ss-number flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-xs font-semibold ${
                            shot === SHOT_MAX ? "text-[var(--ss-amber)]" : ""
                          }`}
                        >
                          {shot}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ) : (
        <Panel title="Schoten">
          <p className="text-sm text-muted-foreground">
            Alleen de totaalscore is ingevoerd; de losse schoten zijn onbekend.
          </p>
        </Panel>
      )}

      <CompetitionLinks session={session} />

      {session.notes && (
        <Panel title="Opmerkingen">
          <p className="whitespace-pre-wrap text-sm">{session.notes}</p>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`${SCHIETSPORT_BASE}/logboek/${session.id}/bewerken`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10"
        >
          <Pencil className="h-4 w-4" /> Bewerken
        </Link>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" /> Verwijderen
        </Button>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <SyncBadge session={session} />
          {session.syncState === "synced"
            ? "Gesynchroniseerd"
            : session.syncState === "pending"
              ? "Nog niet gesynchroniseerd"
              : `Geweigerd: ${session.syncError ?? ""}`}
        </span>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Schietbeurt verwijderen?"
        description="Deze schietbeurt verdwijnt uit je logboek en statistieken, ook op je andere apparaten."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="ss-eyebrow">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{children}</p>
    </div>
  );
}
