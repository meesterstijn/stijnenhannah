import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityName } from "@/features/schietsport/db/database";

type Row = Record<string, unknown>;

export type PushResponse = { status: "ok" | "conflict"; row: Row };
export type PullResponse = {
  rows: { entity: EntityName; row: Row }[];
  has_more: boolean;
  next: number;
  cursor: number;
};

// network  = geen verbinding / server tijdelijk weg → later opnieuw
// auth     = sessie verlopen of geen toegang → later opnieuw, niets weggooien
// rejected = de server weigert deze wijziging inhoudelijk → niet blind
//            opnieuw proberen; lokaal bewaren met de reden
export type SyncErrorKind = "network" | "auth" | "rejected";

export class SyncError extends Error {
  constructor(
    public kind: SyncErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export interface SyncTransport {
  push(
    entity: EntityName,
    changeId: string,
    baseVersion: number,
    row: Row,
  ): Promise<PushResponse>;
  pull(since: number, limit: number): Promise<PullResponse>;
  uploadPhoto(path: string, blob: Blob): Promise<void>;
  downloadPhoto(path: string): Promise<Blob | null>;
}

const REJECTED_CODES = new Set([
  "22023", // ongeldige parameter (onze eigen validatie)
  "23514", // CHECK-constraint
  "23503", // foreign key
  "23505", // unieke sleutel
  "22P02", // ongeldige invoerwaarde
  "22007", // ongeldige datum
  "22008",
  "P0001",
]);

export function classifyError(error: {
  code?: string;
  message?: string;
  status?: number;
}): SyncError {
  const message = error.message || "Onbekende fout";
  if (!error.status || error.status >= 500 || error.status === 408) {
    return new SyncError("network", message);
  }
  if (
    error.status === 401 ||
    error.status === 403 ||
    error.code === "42501" ||
    error.code?.startsWith("PGRST30")
  ) {
    return new SyncError("auth", message);
  }
  if (error.code && REJECTED_CODES.has(error.code)) {
    return new SyncError("rejected", message);
  }
  return error.status >= 400 && error.status < 500
    ? new SyncError("rejected", message)
    : new SyncError("network", message);
}

const PHOTO_BUCKET = "shooting-weapon-photos";
const REQUEST_TIMEOUT_MS = 15_000;

export function createSupabaseTransport(client: SupabaseClient): SyncTransport {
  const call = async <T>(fn: string, args: Row): Promise<T> => {
    let result;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Time-out: bij slecht bereik of een tokenrefresh die blijft hangen
      // liever snel "offline" melden en later opnieuw proberen.
      result = await Promise.race([
        client.rpc(fn, args),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Time-out")),
            REQUEST_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      throw new SyncError("network", String(error));
    } finally {
      clearTimeout(timer);
    }
    if (result.error) {
      throw classifyError({ ...result.error, status: result.status });
    }
    return result.data as T;
  };

  return {
    push: (entity, changeId, baseVersion, row) =>
      call<PushResponse>(`shooting_push_${entity}`, {
        p_change_id: changeId,
        p_base_version: baseVersion,
        p_row: row,
      }),
    pull: (since, limit) =>
      call<PullResponse>("shooting_pull", { p_since: since, p_limit: limit }),
    async uploadPhoto(path, blob) {
      const { error } = await client.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (error) {
        throw new SyncError(
          "status" in error && Number(error.status) < 500
            ? "rejected"
            : "network",
          error.message,
        );
      }
    },
    async downloadPhoto(path) {
      const { data, error } = await client.storage
        .from(PHOTO_BUCKET)
        .download(path);
      if (error) return null;
      return data;
    },
  };
}
