import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/with-timeout";
import { classifyError } from "@/features/training/sync/transport";

// Feedback tijdens de testfase (zie docs/training.md). Zet op false om de
// knop overal te verbergen; het overzicht voor de owner blijft bestaan.
export const FEEDBACK_BUTTON_ENABLED = true;

export const FEEDBACK_KINDS = [
  { value: "fout", label: "Er gaat iets mis" },
  { value: "idee", label: "Idee" },
  { value: "onduidelijk", label: "Onduidelijk" },
] as const;

export type FeedbackKind =
  | (typeof FEEDBACK_KINDS)[number]["value"]
  | "opmerking";

export const KIND_LABELS: Record<FeedbackKind, string> = {
  fout: "Fout",
  idee: "Idee",
  onduidelijk: "Onduidelijk",
  opmerking: "Opmerking",
};

export const MAX_MESSAGE = 4000;

export type FeedbackRow = {
  id: string;
  user_id: string;
  kind: FeedbackKind;
  message: string;
  page_path: string;
  page_label: string | null;
  context: Record<string, unknown>;
};

// Leesbare naam per trainingsroute, zodat in het overzicht meteen duidelijk
// is waar het over gaat. Volgorde: specifiek vóór algemeen.
const PAGE_LABELS: [RegExp, string][] = [
  [/^\/training\/?$/, "Vandaag"],
  [/^\/training\/workout$/, "Training bezig"],
  [/^\/training\/schemas\/[^/]+$/, "Schema bewerken"],
  [/^\/training\/schemas$/, "Schema's"],
  [/^\/training\/bibliotheek/, "Trainingsbibliotheek"],
  [/^\/training\/oefeningen\/nieuw$/, "Nieuwe oefening"],
  [/^\/training\/oefeningen\/[^/]+\/bewerken$/, "Oefening bewerken"],
  [/^\/training\/oefeningen\/[^/]+$/, "Oefening"],
  [/^\/training\/oefeningen$/, "Oefeningen"],
  [/^\/training\/historie\/[^/]+$/, "Training terugkijken"],
  [/^\/training\/historie$/, "Historie"],
  [/^\/training\/voortgang/, "Voortgang"],
  [/^\/training\/lichaam/, "Lichaamsgewicht"],
  [/^\/training\/schijven/, "Schijvencalculator"],
  [/^\/training\/instellingen/, "Instellingen"],
  [/^\/training\/oefeningen-beoordelen/, "Nieuwe oefeningen beoordelen"],
  [/^\/training\/feedback/, "Feedback"],
  [/^\/training\/meer/, "Meer"],
];

export function pageNameFor(pathname: string): string {
  return PAGE_LABELS.find(([re]) => re.test(pathname))?.[1] ?? pathname;
}

/** "Oefening · Bench press": routenaam plus de kop van de pagina. */
export function pageLabelFor(pathname: string, heading?: string | null) {
  const name = pageNameFor(pathname);
  const h = heading?.replace(/\s+/g, " ").trim().slice(0, 120);
  return h && h.toLowerCase() !== name.toLowerCase() ? `${name} · ${h}` : name;
}

// ── Offline wachtrij ──────────────────────────────────────────────────
// In de sportschool is het netwerk vaak slecht. Feedback gaat eerst in een
// lokale wachtrij en wordt meteen (en later opnieuw) verstuurd. Het id komt
// van de app: een herhaalde insert faalt op de primary key (23505) en telt
// dan als verstuurd.

const QUEUE_KEY = "training:feedback-queue";
const MAX_QUEUE = 50;

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

function storage(): KeyValueStorage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readQueue(store = storage()): FeedbackRow[] {
  try {
    const parsed = JSON.parse(store?.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: FeedbackRow[], store = storage()) {
  try {
    store?.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-MAX_QUEUE)));
  } catch {
    // Vol of geblokkeerd: dan alleen het directe versturen.
  }
}

export type InsertResult = "sent" | "retry" | "rejected";
export type Inserter = (row: FeedbackRow) => Promise<InsertResult>;

// Na de time-out blijft de rij in de wachtrij. Komt het verzoek later alsnog
// aan, dan geeft de volgende poging 23505 en verdwijnt de rij.
export const insertFeedback: Inserter = async (row) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return "retry";
  const response = await withTimeout(
    supabase.from("training_feedback").insert(row),
  );
  if (!response) return "retry";
  const { error, status } = response;
  if (!error || error.code === "23505") return "sent";
  const kind = classifyError({
    code: error.code,
    message: error.message,
    status,
  }).kind;
  return kind === "rejected" ? "rejected" : "retry";
};

let flushing: Promise<FlushResult> | null = null;

export type FlushResult = {
  sent: string[];
  rejected: string[];
  waiting: number;
};

/**
 * Verstuurt de wachtrij van deze gebruiker. Rijen van een ander account
 * (gedeeld toestel) blijven staan tot die weer inlogt.
 */
export function flushQueue(
  userId: string,
  insert: Inserter = insertFeedback,
  store = storage(),
): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const sent: string[] = [];
    const rejected: string[] = [];
    for (const row of readQueue(store)) {
      if (row.user_id !== userId) continue;
      let result: InsertResult;
      try {
        result = await insert(row);
      } catch {
        result = "retry";
      }
      if (result === "retry") break;
      (result === "sent" ? sent : rejected).push(row.id);
      const done = new Set([...sent, ...rejected]);
      writeQueue(
        readQueue(store).filter((r) => !done.has(r.id)),
        store,
      );
    }
    const waiting = readQueue(store).filter((r) => r.user_id === userId).length;
    return { sent, rejected, waiting };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function enqueue(row: FeedbackRow, store = storage()) {
  writeQueue([...readQueue(store), row], store);
}

// ── Context ───────────────────────────────────────────────────────────

declare const __APP_BUILD__: string | undefined;

export function collectContext(extra: Record<string, unknown>) {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  let standalone = false;
  try {
    standalone = window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    // Oude browser: geen display-mode.
  }
  return {
    build: typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : "dev",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio,
    standalone,
    online: nav?.onLine ?? null,
    user_agent: nav?.userAgent?.slice(0, 300) ?? null,
    local_time: new Date().toString().slice(0, 33),
    url: window.location.href.slice(0, 500),
    ...extra,
  };
}
