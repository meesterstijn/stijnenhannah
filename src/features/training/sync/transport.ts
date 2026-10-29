import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityName } from "@/features/training/db/database";
import { TABLES } from "@/features/training/db/mapping";

type Row = Record<string, unknown>;

// network  = geen verbinding / server tijdelijk weg → later opnieuw
// auth     = sessie verlopen of geen toegang → later opnieuw, niets weggooien
// conflict = record is op een ander apparaat gewijzigd (versie klopt niet)
// rejected = de server weigert deze inhoud → niet blind herhalen
export type SyncErrorKind = "network" | "auth" | "conflict" | "rejected";

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
  // Upsert op id; geeft de serverrij terug (ook bij een herhaalde push).
  push(entity: EntityName, row: Row): Promise<Row>;
  fetch(entity: EntityName, id: string): Promise<Row | null>;
  // Rijen met changed_at > since (of ≥ bij inclusive), oplopend.
  pull(
    entity: EntityName,
    since: string | null,
    limit: number,
    inclusive: boolean,
  ): Promise<Row[]>;
}

export const CONFLICT_CODE = "TRC01";

const REJECTED_CODES = new Set([
  "22023",
  "23514",
  "23503",
  "23505",
  "22P02",
  "22007",
  "22008",
  "22003",
  "P0001",
]);

export function classifyError(error: {
  code?: string;
  message?: string;
  status?: number;
}): SyncError {
  const message = error.message || "Onbekende fout";
  if (error.code === CONFLICT_CODE) return new SyncError("conflict", message);
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
  if (error.code && REJECTED_CODES.has(error.code))
    return new SyncError("rejected", message);
  return error.status >= 400 && error.status < 500
    ? new SyncError("rejected", message)
    : new SyncError("network", message);
}

const REQUEST_TIMEOUT_MS = 15_000;

async function withTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bij slecht bereik liever snel "offline" en later opnieuw proberen.
    return await Promise.race([
      promise,
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
}

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
  status: number;
};

function unwrap<T>(result: Result): T {
  if (result.error)
    throw classifyError({ ...result.error, status: result.status });
  return result.data as T;
}

export function createSupabaseTransport(client: SupabaseClient): SyncTransport {
  return {
    async push(entity, row) {
      const result = await withTimeout(
        client
          .from(TABLES[entity])
          .upsert(row, { onConflict: "id" })
          .select()
          .single(),
      );
      return unwrap<Row>(result as Result);
    },
    async fetch(entity, id) {
      const result = await withTimeout(
        client.from(TABLES[entity]).select("*").eq("id", id).maybeSingle(),
      );
      return unwrap<Row | null>(result as Result);
    },
    async pull(entity, since, limit, inclusive) {
      let query = client.from(TABLES[entity]).select("*");
      if (since)
        query = inclusive
          ? query.gte("changed_at", since)
          : query.gt("changed_at", since);
      const result = await withTimeout(
        query.order("changed_at", { ascending: true }).limit(limit),
      );
      return unwrap<Row[]>(result as Result);
    },
  };
}
