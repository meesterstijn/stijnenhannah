import {
  getMeta,
  setMeta,
  type EntityName,
  type OutboxEntry,
  type SchietsportDatabase,
} from "@/features/schietsport/db/database";
import {
  contentKey,
  fromServerRow,
  toServerRow,
} from "@/features/schietsport/db/mapping";
import { updateWeapon } from "@/features/schietsport/db/repository";
import {
  SyncError,
  type PushResponse,
  type SyncTransport,
} from "@/features/schietsport/sync/transport";

// Synchronisatie tussen IndexedDB en Supabase.
//
// Garanties:
//   * Een record wordt pas "synced" als Supabase de wijziging bevestigt.
//   * Herhaald pushen is veilig: de server herkent een al verwerkte
//     wijziging aan het changeId (idempotent), dus geen dubbele records.
//   * Een conflict (ander apparaat wijzigde hetzelfde record) overschrijft
//     niets stilzwijgend: de lokale versie gaat naar `conflicts` zodat de
//     gebruiker kan kiezen.
//   * Verwijderen = tombstone die gewoon meesynchroniseert.

type Row = Record<string, unknown>;

export type SyncPhase = "idle" | "syncing";

export type SyncStatus = {
  phase: SyncPhase;
  // Resultaat van de laatste poging: ok, geen verbinding, of geen toegang.
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

const MAX_REBASES = 3;

export class SyncEngine {
  private running: Promise<SyncReport> | null = null;
  private again = false;
  private listeners = new Set<(status: SyncStatus) => void>();
  status: SyncStatus = {
    phase: "idle",
    lastOutcome: null,
    lastSyncAt: null,
    lastError: null,
  };

  constructor(
    private db: SchietsportDatabase,
    private transport: SyncTransport,
    private userId: string,
    private options: { pageSize?: number; isOnline?: () => boolean } = {},
  ) {}

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener(this.status);
  }

  // Eén sync tegelijk; een aanvraag tijdens een lopende sync zorgt voor
  // precies één extra ronde daarna (zodat net opgeslagen wijzigingen mee gaan).
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
    const report: SyncReport = {
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      rejected: 0,
      outcome: "ok",
    };
    try {
      // Zonder netwerk niet eens proberen: supabase-js zou anders eerst tot
      // ~30 s de tokenrefresh herhalen voordat de push faalt.
      if (this.options.isOnline && !this.options.isOnline()) {
        throw new SyncError("network", "Geen internetverbinding");
      }
      await this.syncPhotoUploads();
      await this.pushAll(report);
      await this.pullAll(report);
      await this.syncPhotoDownloads();
      const at = new Date().toISOString();
      await setMeta(this.db, "lastSyncAt", at);
      this.setStatus({
        phase: "idle",
        lastOutcome: "ok",
        lastSyncAt: at,
        lastError: null,
      });
    } catch (error) {
      const kind = error instanceof SyncError ? error.kind : null;
      report.outcome =
        kind === "network" ? "offline" : kind === "auth" ? "auth" : "error";
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
      // Een geweigerde wijziging wordt pas opnieuw geprobeerd na een nieuwe
      // lokale wijziging (die geeft een nieuw changeId en wist lastError).
      if (entry.lastError) continue;
      await this.pushEntry(entry, report);
    }
  }

  private async pushEntry(entry: OutboxEntry, report: SyncReport) {
    const table = this.db.entityTable(entry.entity);
    for (let rebase = 0; rebase <= MAX_REBASES; rebase++) {
      const current = await this.db.outbox.get(entry.recordId);
      const record = await table.get(entry.recordId);
      if (!current) return;
      if (!record) {
        await this.db.outbox.delete(entry.recordId);
        return;
      }
      const row = toServerRow(entry.entity, record);
      const previousAttempt = current.lastAttemptPayload;
      await this.db.outbox.update(entry.recordId, {
        attempts: current.attempts + 1,
        lastAttemptPayload: row,
      });

      let response: PushResponse;
      try {
        response = await this.transport.push(
          entry.entity,
          current.changeId,
          record.version,
          row,
        );
      } catch (error) {
        if (error instanceof SyncError && error.kind === "rejected") {
          await this.markRejected(entry.entity, current, error.message);
          report.rejected++;
          return;
        }
        throw error; // netwerk/auth: stoppen, later opnieuw
      }

      const outcome = await this.applyPushResponse(
        entry.entity,
        current,
        row,
        previousAttempt,
        response,
      );
      if (outcome === "rebase") continue;
      if (outcome === "conflict") report.conflicts++;
      else report.pushed++;
      return;
    }
  }

  private async markRejected(
    entity: EntityName,
    entry: OutboxEntry,
    message: string,
  ) {
    const table = this.db.entityTable(entity);
    await this.db.transaction("rw", table, this.db.outbox, async () => {
      const latest = await this.db.outbox.get(entry.recordId);
      if (!latest || latest.changeId !== entry.changeId) return;
      await this.db.outbox.update(entry.recordId, { lastError: message });
      await table.update(entry.recordId, {
        syncState: "rejected",
        syncError: message,
      } as never);
    });
  }

  private async applyPushResponse(
    entity: EntityName,
    entry: OutboxEntry,
    sentRow: Row,
    previousAttempt: Row | null,
    response: PushResponse,
  ): Promise<"ok" | "rebase" | "conflict"> {
    const table = this.db.entityTable(entity);
    const server = response.row;
    const serverKey = contentKey(entity, server);

    let accepted = response.status === "ok";
    let rebase = false;
    let silentServerWins = false;
    if (!accepted) {
      if (serverKey === contentKey(entity, sentRow)) {
        accepted = true; // inhoudelijk al gelijk
      } else if (
        previousAttempt &&
        serverKey === contentKey(entity, previousAttempt)
      ) {
        rebase = true; // onze eigen eerdere poging was al aangekomen
      }
    }

    return this.db.transaction(
      "rw",
      table,
      this.db.outbox,
      this.db.conflicts,
      async () => {
        const latest = await this.db.outbox.get(entry.recordId);
        const record = await table.get(entry.recordId);
        const editedMeanwhile = !latest || latest.changeId !== entry.changeId;
        if (!accepted && !rebase && record?.seeded) silentServerWins = true;

        if (rebase || (accepted && editedMeanwhile && latest)) {
          // Lokaal staat iets nieuwers (of onze eerdere poging was al
          // binnen): basisversie bijwerken en de actuele inhoud meteen
          // opnieuw pushen.
          await table.update(entry.recordId, {
            version: server.version,
          } as never);
          return "rebase";
        }

        if (accepted || silentServerWins) {
          await table.put(fromServerRow(entity, server));
          await this.db.outbox.delete(entry.recordId);
          return "ok";
        }

        // Echt conflict: serverversie wordt de actuele, eigen versie bewaren.
        await this.db.conflicts.put({
          id: entry.recordId,
          entity,
          local: sentRow,
          server,
          detectedAt: new Date().toISOString(),
        });
        await table.put(fromServerRow(entity, server));
        await this.db.outbox.delete(entry.recordId);
        return "conflict";
      },
    );
  }

  // ── Pull ───────────────────────────────────────────────────────────

  private async pullAll(report: SyncReport) {
    const stored = (await getMeta<number>(this.db, "cursor")) ?? 0;
    let since = stored;
    let persist = stored;
    let locked = false;
    for (;;) {
      const page = await this.transport.pull(
        since,
        this.options.pageSize ?? 500,
      );
      await this.applyPulledRows(page.rows);
      report.pulled += page.rows.length;
      if (!locked) {
        if (page.cursor < page.next) {
          // Recente rijen in deze pagina: veilige cursor blijft hier staan.
          persist = page.cursor;
          locked = true;
        } else {
          persist = page.next;
        }
      }
      if (!page.has_more || page.next <= since) break;
      since = page.next;
    }
    await setMeta(this.db, "cursor", persist);
  }

  private async applyPulledRows(rows: { entity: EntityName; row: Row }[]) {
    if (rows.length === 0) return;
    await this.db.transaction(
      "rw",
      [...this.db.entityTables, this.db.outbox],
      async () => {
        for (const { entity, row } of rows) {
          const id = row.id as string;
          // Een eigen, nog niet bevestigde wijziging wint tot de push
          // uitsluitsel geeft (die detecteert een eventueel conflict).
          if (await this.db.outbox.get(id)) continue;
          const table = this.db.entityTable(entity);
          const local = await table.get(id);
          if (local && local.version > (row.version as number)) continue;
          await table.put(fromServerRow(entity, row));
        }
      },
    );
  }

  // ── Foto's ─────────────────────────────────────────────────────────

  private photoPath(weaponId: string) {
    return `${this.userId}/${weaponId}.webp`;
  }

  private async syncPhotoUploads() {
    const pending = await this.db.photos
      .filter((photo) => !photo.uploaded)
      .toArray();
    for (const photo of pending) {
      const weapon = await this.db.weapons.get(photo.weaponId);
      if (!weapon) continue;
      const path = this.photoPath(photo.weaponId);
      await this.transport.uploadPhoto(path, photo.blob);
      await this.db.photos.update(photo.weaponId, { uploaded: true });
      if (weapon.photoPath !== path) {
        await updateWeapon(this.db, weapon.id, { photoPath: path });
      }
    }
  }

  private async syncPhotoDownloads() {
    const weapons = await this.db.weapons
      .filter((weapon) => !!weapon.photoPath && weapon.deletedAt === null)
      .toArray();
    for (const weapon of weapons) {
      if (await this.db.photos.get(weapon.id)) continue;
      const blob = await this.transport.downloadPhoto(weapon.photoPath!);
      if (blob) {
        await this.db.photos.put({ weaponId: weapon.id, blob, uploaded: true });
      }
    }
  }
}
