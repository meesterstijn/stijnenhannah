import {
  ENTITIES,
  getMeta,
  setMeta,
  type EntityName,
  type OutboxEntry,
  type TrainingDatabase,
} from "@/features/training/db/database";
import { fromServerRow, toServerRow } from "@/features/training/db/mapping";
import { SyncError, type SyncTransport } from "./transport";

// Synchronisatie tussen IndexedDB en Supabase.
//
// Garanties:
//   * Een record is pas "synced" als Supabase de wijziging bevestigt.
//   * Herhaald pushen is veilig: de server herkent een al verwerkte
//     wijziging aan last_change_id, dus geen dubbele sets door een
//     netwerkherhaling.
//   * Conflict (ander apparaat wijzigde hetzelfde record): de serverversie
//     wordt de actuele, de eigen versie gaat naar `conflicts` om te kiezen.
//     Er gaat nooit stil iets verloren.
//   * Verwijderen = verwijdermarkering die gewoon meesynchroniseert.

type Row = Record<string, unknown>;

export type SyncStatus = {
  phase: "idle" | "syncing";
  lastOutcome: "ok" | "offline" | "auth" | "error" | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type SyncReport = {
  pushed: number;
  pulled: number;
  conflicts: number;
  rejected: number;
  outcome: NonNullable<SyncStatus["lastOutcome"]>;
};

// Pull begint steeds iets vóór de laatst geziene wijziging, zodat een
// transactie die eerder begon maar later commitde niet gemist wordt. Dubbel
// ophalen is onschadelijk.
const PULL_OVERLAP_MS = 5 * 60 * 1000;
const PAGE_SIZE = 500;

export class SyncEngine {
  private running: Promise<SyncReport> | null = null;
  private again = false;
  private listeners = new Set<(status: SyncStatus) => void>();
  status: SyncStatus = { phase: "idle", lastOutcome: null, lastSyncAt: null, lastError: null };

  constructor(
    private db: TrainingDatabase,
    private transport: SyncTransport,
    private options: { isOnline?: () => boolean; pageSize?: number } = {},
  ) {}

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(change: Partial<SyncStatus>) {
    this.status = { ...this.status, ...change };
    for (const listener of this.listeners) listener(this.status);
  }

  // Eén sync tegelijk; een aanvraag tijdens een lopende sync geeft precies
  // één extra ronde daarna.
  sync(): Promise<SyncReport> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      let report: SyncReport;
      do {
        this.again = false;
        report = await this.runOnce();
      } while (this.again && report.outcome === "ok");
      return report;
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runOnce(): Promise<SyncReport> {
    this.setStatus({ phase: "syncing" });
    const report: SyncReport = { pushed: 0, pulled: 0, conflicts: 0, rejected: 0, outcome: "ok" };
    try {
      if (this.options.isOnline && !this.options.isOnline()) {
        throw new SyncError("network", "Geen internetverbinding");
      }
      await this.pushAll(report);
      await this.pullAll(report);
      const at = new Date().toISOString();
      await setMeta(this.db, "lastSyncAt", at);
      this.setStatus({ phase: "idle", lastOutcome: "ok", lastSyncAt: at, lastError: null });
    } catch (error) {
      const kind = error instanceof SyncError ? error.kind : null;
      report.outcome = kind === "network" ? "offline" : kind === "auth" ? "auth" : "error";
      this.setStatus({
        phase: "idle",
        lastOutcome: report.outcome,
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
    return report;
  }

  // ── Push ───────────────────────────────────────────────────────────

  private async pushAll(report: SyncReport) {
    const entries = await this.db.outbox.orderBy("seq").toArray();
    for (const entry of entries) {
      // Geweigerd: pas opnieuw na een nieuwe lokale wijziging.
      if (entry.lastError) continue;
      await this.pushEntry(entry, report);
    }
  }

  private async pushEntry(entry: OutboxEntry, report: SyncReport) {
    const table = this.db.entityTable(entry.entity);
    const record = await table.get(entry.recordId);
    const current = await this.db.outbox.get(entry.recordId);
    if (!current) return;
    if (!record) {
      await this.db.outbox.delete(entry.recordId);
      return;
    }
    const row = toServerRow(entry.entity, record, current.changeId);
    await this.db.outbox.update(entry.recordId, { attempts: current.attempts + 1 });

    let server: Row;
    try {
      server = await this.transport.push(entry.entity, row);
    } catch (error) {
      if (error instanceof SyncError && error.kind === "rejected") {
        await this.markRejected(entry.entity, current, error.message);
        report.rejected++;
        return;
      }
      if (error instanceof SyncError && error.kind === "conflict") {
        const latest = await this.transport.fetch(entry.entity, entry.recordId);
        if (latest && (await this.storeConflict(entry.entity, current, row, latest))) {
          report.conflicts++;
        }
        return;
      }
      throw error; // netwerk/auth: stoppen, later opnieuw
    }

    await this.db.transaction("rw", table, this.db.outbox, async () => {
      const latest = await this.db.outbox.get(entry.recordId);
      if (latest && latest.changeId !== current.changeId) {
        // Tijdens het pushen lokaal opnieuw gewijzigd: alleen de
        // basisversie bijwerken; de nieuwe inhoud gaat in de volgende ronde.
        await table.update(entry.recordId, { version: server.version } as never);
        this.again = true;
        return;
      }
      await table.put(fromServerRow(entry.entity, server));
      await this.db.outbox.delete(entry.recordId);
    });
    report.pushed++;
  }

  private async markRejected(entity: EntityName, entry: OutboxEntry, message: string) {
    const table = this.db.entityTable(entity);
    await this.db.transaction("rw", table, this.db.outbox, async () => {
      const latest = await this.db.outbox.get(entry.recordId);
      if (!latest || latest.changeId !== entry.changeId) return;
      await this.db.outbox.update(entry.recordId, { lastError: message });
      await table.update(entry.recordId, { syncState: "rejected", syncError: message } as never);
    });
  }

  // true = echt conflict bewaard; false = opgelost zonder iets te verliezen.
  private async storeConflict(entity: EntityName, entry: OutboxEntry, sentRow: Row, server: Row) {
    const table = this.db.entityTable(entity);
    return this.db.transaction("rw", table, this.db.outbox, this.db.conflicts, async () => {
      const latest = await this.db.outbox.get(entry.recordId);
      const record = await table.get(entry.recordId);
      if (latest && latest.changeId !== entry.changeId) {
        // Intussen weer lokaal gewijzigd: eerst die nieuwe versie proberen.
        await table.update(entry.recordId, { version: server.version } as never);
        this.again = true;
        return false;
      }
      const stored = !record?.seeded;
      if (stored) {
        await this.db.conflicts.put({
          id: entry.recordId,
          entity,
          local: sentRow,
          server,
          detectedAt: new Date().toISOString(),
        });
      }
      await table.put(fromServerRow(entity, server));
      await this.db.outbox.delete(entry.recordId);
      return stored;
    });
  }

  // ── Pull ───────────────────────────────────────────────────────────

  private async pullAll(report: SyncReport) {
    const cursors = (await getMeta<Record<string, string>>(this.db, "cursors")) ?? {};
    const limit = this.options.pageSize ?? PAGE_SIZE;
    for (const entity of ENTITIES) {
      const known = cursors[entity] ?? null;
      let since = known ? new Date(Date.parse(known) - PULL_OVERLAP_MS).toISOString() : null;
      let inclusive = true;
      let newest = known;
      for (;;) {
        const rows = await this.transport.pull(entity, since, limit, inclusive);
        await this.applyPulled(entity, rows);
        report.pulled += rows.length;
        if (rows.length > 0) {
          const last = rows[rows.length - 1].changed_at as string;
          if (!newest || Date.parse(last) >= Date.parse(newest)) newest = last;
          since = last;
          inclusive = false;
        }
        if (rows.length < limit) break;
      }
      if (newest) cursors[entity] = newest;
    }
    await setMeta(this.db, "cursors", cursors);
  }

  private async applyPulled(entity: EntityName, rows: Row[]) {
    if (rows.length === 0) return;
    const table = this.db.entityTable(entity);
    await this.db.transaction("rw", table, this.db.outbox, async () => {
      for (const row of rows) {
        const id = row.id as string;
        // Eigen, nog niet bevestigde wijziging wint tot de push uitsluitsel
        // geeft (die detecteert een eventueel conflict).
        if (await this.db.outbox.get(id)) continue;
        const local = await table.get(id);
        if (local && local.version >= (row.version as number) && local.syncState === "synced") continue;
        await table.put(fromServerRow(entity, row));
      }
    });
  }
}
