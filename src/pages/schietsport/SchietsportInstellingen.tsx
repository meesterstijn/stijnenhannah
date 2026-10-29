import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Database,
  Download,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Panel,
  SchietsportPageHeader,
} from "@/features/schietsport/components/SchietsportSurface";
import {
  Button,
  ConfirmDialog,
  Field,
  FormSheet,
  TextInput,
} from "@/features/schietsport/components/form";
import {
  createBackup,
  downloadFile,
  importBackup,
  parseBackup,
} from "@/features/schietsport/backup/json";
import { ENTITIES, type EntityName } from "@/features/schietsport/db/database";
import {
  createDiscipline,
  discardLocalChange,
  resolveConflict,
  softDelete,
  updateDiscipline,
} from "@/features/schietsport/db/repository";
import type { Discipline } from "@/features/schietsport/domain/model";
import {
  useSchietsport,
  useSyncStatus,
} from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useConflicts,
  useDisciplines,
  usePendingCount,
  useSessions,
} from "@/features/schietsport/hooks/useSchietsportData";
import { SESSION_TYPE_LABELS } from "@/features/schietsport/domain/rules";
import { formatDate, todayYmd } from "@/features/schietsport/lib/format";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

const ENTITY_LABELS: Record<EntityName, string> = {
  discipline: "Discipline",
  weapon: "Wapen",
  session: "Schietbeurt",
  competition: "Competitie",
  competition_entry: "Competitiekoppeling",
};

function describeRow(entity: EntityName, row: Record<string, unknown>) {
  if (entity === "session") {
    return `${SESSION_TYPE_LABELS[row.session_type as keyof typeof SESSION_TYPE_LABELS] ?? ""} · ${
      row.session_date ? formatDate(String(row.session_date)) : ""
    } · ${row.total_score}/${row.max_score ?? ""}`;
  }
  return String(row.name ?? row.id);
}

const IGNORED = new Set([
  "id",
  "user_id",
  "created_at",
  "updated_at",
  "version",
  "server_seq",
  "changed_at",
  "cards",
]);

const cardsKey = (cards: unknown) =>
  JSON.stringify(
    ((cards as Record<string, unknown>[] | undefined) ?? []).map((c) => [
      c.card_number,
      c.shot_count,
      c.score,
      c.shots ?? null,
    ]),
  );

// Welke velden verschillen tussen de eigen en de serverversie.
function differences(
  local: Record<string, unknown>,
  server: Record<string, unknown>,
) {
  const changed = Object.keys({ ...local, ...server })
    .filter((key) => !IGNORED.has(key))
    .filter(
      (key) =>
        JSON.stringify(local[key] ?? null) !==
        JSON.stringify(server[key] ?? null),
    );
  if ("cards" in local && cardsKey(local.cards) !== cardsKey(server.cards)) {
    changed.push("kaarten");
  }
  return changed;
}

export default function SchietsportInstellingen() {
  return (
    <div className="space-y-5">
      <SchietsportPageHeader
        icon={Settings}
        title="Instellingen"
        description="Synchronisatie, disciplines, back-ups en opslag."
      />
      <SyncSection />
      <DisciplinesSection />
      <BackupSection />
      <StorageSection />
    </div>
  );
}

// ── Synchronisatie ───────────────────────────────────────────────────

function SyncSection() {
  const { db, engine } = useSchietsport();
  const status = useSyncStatus();
  const pending = usePendingCount();
  const conflicts = useConflicts() ?? [];
  const rejected =
    useLiveQuery(async () => {
      const rows: {
        entity: EntityName;
        id: string;
        label: string;
        error: string;
      }[] = [];
      for (const entity of ENTITIES) {
        const records = await db
          .entityTable(entity)
          .where("syncState")
          .equals("rejected")
          .toArray();
        for (const record of records) {
          const r = record as unknown as Record<string, unknown>;
          rows.push({
            entity,
            id: String(r.id),
            label:
              entity === "session"
                ? `${formatDate(String(r.sessionDate))} · ${r.totalScore}/${r.maxScore}`
                : String(r.name ?? r.id),
            error: String(r.syncError ?? ""),
          });
        }
      }
      return rows;
    }, [db]) ?? [];

  const outcome =
    status.phase === "syncing"
      ? "Bezig met synchroniseren…"
      : status.lastOutcome === "offline"
        ? "Geen verbinding — wijzigingen staan veilig op dit apparaat."
        : status.lastOutcome === "auth"
          ? "Sync gepauzeerd: log opnieuw in als dit zo blijft."
          : status.lastOutcome === "error"
            ? `Sync mislukt: ${status.lastError ?? "onbekende fout"}`
            : status.lastSyncAt
              ? `Laatst gesynchroniseerd om ${new Date(status.lastSyncAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}.`
              : "Nog niet gesynchroniseerd in deze sessie.";

  return (
    <Panel title="Synchronisatie">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm">{outcome}</p>
          <p className="text-xs text-muted-foreground">
            {pending === 0
              ? "Alle wijzigingen zijn door Supabase bevestigd."
              : `${pending} ${pending === 1 ? "wijziging wacht" : "wijzigingen wachten"} op bevestiging.`}
          </p>
        </div>
        <Button
          onClick={() => void engine.sync()}
          disabled={status.phase === "syncing"}
        >
          <RefreshCw
            className={`h-4 w-4 ${status.phase === "syncing" ? "animate-spin" : ""}`}
          />
          Nu synchroniseren
        </Button>
      </div>

      {conflicts.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="ss-eyebrow flex items-center gap-1.5 text-[var(--ss-amber)]">
            <AlertTriangle className="h-3.5 w-3.5" /> Conflicten
          </p>
          <p className="text-xs text-muted-foreground">
            Dit record is op een ander apparaat gewijzigd terwijl je hier ook
            iets aanpaste. De serverversie staat nu in de app; jouw versie is
            bewaard. Kies welke je houdt.
          </p>
          {conflicts.map((conflict) => {
            const changed = differences(conflict.local, conflict.server);
            return (
              <div
                key={conflict.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <p className="text-sm font-medium">
                  {ENTITY_LABELS[conflict.entity]}:{" "}
                  {describeRow(conflict.entity, conflict.server)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Jouw versie: {describeRow(conflict.entity, conflict.local)}
                  {changed.length > 0 && ` · verschil in ${changed.join(", ")}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      void resolveConflict(db, conflict.id, "server")
                    }
                  >
                    Serverversie houden
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      void resolveConflict(db, conflict.id, "local")
                    }
                  >
                    Mijn versie gebruiken
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="ss-eyebrow flex items-center gap-1.5 text-[var(--ss-amber)]">
            <AlertTriangle className="h-3.5 w-3.5" /> Geweigerd door de server
          </p>
          {rejected.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <p className="text-sm font-medium">
                {ENTITY_LABELS[row.entity]}: {row.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{row.error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.entity === "session" && (
                  <Link
                    to={`${SCHIETSPORT_BASE}/logboek/${row.id}/bewerken`}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10"
                  >
                    <Pencil className="h-4 w-4" /> Aanpassen
                  </Link>
                )}
                <Button
                  variant="danger"
                  onClick={() =>
                    void discardLocalChange(db, row.entity, row.id)
                  }
                >
                  Lokale wijziging weggooien
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Disciplines ──────────────────────────────────────────────────────

function DisciplinesSection() {
  const { db, userId } = useSchietsport();
  const disciplines = useDisciplines({ includeArchived: true }) ?? [];
  const sessions = useSessions() ?? [];
  const [editing, setEditing] = useState<Discipline | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [toDelete, setToDelete] = useState<Discipline | null>(null);
  const usage = (id: string) =>
    sessions.filter((s) => s.disciplineId === id).length;

  useEffect(() => {
    if (editing && editing !== "new") {
      setName(editing.name);
      setDescription(editing.description ?? "");
    } else if (editing === "new") {
      setName("");
      setDescription("");
    }
  }, [editing]);

  const active = disciplines.filter((d) => !d.archivedAt);
  const archived = disciplines.filter((d) => d.archivedAt);

  const row = (discipline: Discipline) => {
    const count = usage(discipline.id);
    return (
      <div
        key={discipline.id}
        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{discipline.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {discipline.description ? `${discipline.description} · ` : ""}
            {count}× gebruikt
          </p>
        </div>
        <button
          type="button"
          aria-label={`${discipline.name} bewerken`}
          onClick={() => setEditing(discipline)}
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={discipline.archivedAt ? "Herstellen" : "Archiveren"}
          title={discipline.archivedAt ? "Herstellen" : "Archiveren"}
          onClick={() =>
            void updateDiscipline(db, discipline.id, {
              archivedAt: discipline.archivedAt
                ? null
                : new Date().toISOString(),
            })
          }
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          {discipline.archivedAt ? (
            <ArchiveRestore className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
        </button>
        {count === 0 ? (
          <button
            type="button"
            aria-label={`${discipline.name} verwijderen`}
            onClick={() => setToDelete(discipline)}
            className="p-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          // Zelfde breedte als de prullenbak, zodat de knoppen uitgelijnd blijven.
          <span className="w-8" aria-hidden />
        )}
      </div>
    );
  };

  return (
    <Panel title="Disciplines">
      <div className="-mt-2 mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Gearchiveerde disciplines verdwijnen uit de invoer; je resultaten
          blijven bewaard.
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Nieuw
        </Button>
      </div>
      <div className="-mx-2">{active.map(row)}</div>
      {archived.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Gearchiveerd ({archived.length})
          </summary>
          <div className="-mx-2 mt-2 opacity-75">{archived.map(row)}</div>
        </details>
      )}

      <FormSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          editing === "new" ? "Discipline toevoegen" : "Discipline bewerken"
        }
      >
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if (editing === "new") {
              await createDiscipline(db, userId, { name, description });
            } else if (editing) {
              await updateDiscipline(db, editing.id, {
                name: name.trim(),
                description: description.trim() || null,
              });
            }
            setEditing(null);
          }}
        >
          <Field label="Naam">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </Field>
          <Field label="Beschrijving (optioneel)">
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Bijv. KNSA pistool · 25 m"
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            className="w-full py-3"
            disabled={!name.trim()}
          >
            Opslaan
          </Button>
        </form>
      </FormSheet>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Discipline verwijderen?"
        description={`“${toDelete?.name}” is nog nergens gebruikt en verdwijnt, ook op je andere apparaten.`}
        confirmLabel="Verwijderen"
        destructive
        onConfirm={() => {
          if (toDelete) void softDelete(db, "discipline", toDelete.id);
          setToDelete(null);
        }}
      />
    </Panel>
  );
}

// ── Back-up ──────────────────────────────────────────────────────────

function BackupSection() {
  const { db, userId, engine } = useSchietsport();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Panel title="Back-up">
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Supabase is geen back-up. Download af en toe een volledige JSON-back-up
        en bewaar die ergens anders. Foto's van wapens zitten er niet in.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={async () =>
            downloadFile(
              `schietsport-backup-${todayYmd()}.json`,
              JSON.stringify(await createBackup(db), null, 2),
              "application/json",
            )
          }
        >
          <Download className="h-4 w-4" /> Back-up downloaden
        </Button>
        <Button onClick={() => fileInput.current?.click()} disabled={busy}>
          <Upload className="h-4 w-4" /> Back-up terugzetten
        </Button>
        <Link
          to={`${SCHIETSPORT_BASE}/logboek`}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ListChecks className="h-4 w-4" /> CSV via het logboek
        </Link>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const report = await importBackup(
              db,
              userId,
              parseBackup(await file.text()),
            );
            toast.success(
              `Back-up verwerkt: ${report.added} nieuw, ${report.updated} bijgewerkt, ${report.skipped} al actueel${
                report.invalid
                  ? `, ${report.invalid} ongeldig overgeslagen`
                  : ""
              }.`,
            );
            void engine.sync();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Terugzetten mislukt",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Terugzetten voegt samen: bestaande records worden alleen overschreven
        als de back-up nieuwer is. Daarna gaat alles via de synchronisatie naar
        je account.
      </p>
    </Panel>
  );
}

// ── Opslag op dit apparaat ───────────────────────────────────────────

function StorageSection() {
  const { db } = useSchietsport();
  const { session } = useAuth();
  const pending = usePendingCount();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => undefined);
    void navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(e.usage ?? null))
      .catch(() => undefined);
  }, []);

  return (
    <Panel title="Opslag op dit apparaat">
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          Account:{" "}
          <span className="text-muted-foreground">{session?.user.email}</span>
        </p>
        <p className="text-muted-foreground">
          {persisted
            ? "De browser bewaart je gegevens permanent."
            : "De browser kan lokale gegevens opruimen bij ruimtegebrek; zet de site op je beginscherm voor de beste bescherming."}
          {usage !== null &&
            ` Gebruikt: ${(usage / 1024 / 1024).toLocaleString("nl-NL", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB.`}
        </p>
      </div>
      <Button
        variant="danger"
        className="mt-4"
        onClick={() => setConfirmWipe(true)}
      >
        <Trash2 className="h-4 w-4" /> Lokale gegevens wissen
      </Button>
      <ConfirmDialog
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title="Lokale gegevens wissen?"
        description={
          pending > 0
            ? `Let op: ${pending} wijziging(en) zijn nog niet gesynchroniseerd en gaan verloren. Download eerst een back-up.`
            : "Alles op dit apparaat wordt gewist en daarna opnieuw uit je account opgehaald."
        }
        confirmLabel="Wissen"
        destructive
        onConfirm={async () => {
          await db.delete();
          window.location.reload();
        }}
      />
    </Panel>
  );
}
