import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { enqueue, flushQueue, pageLabelFor, pageNameFor, readQueue } =
  await import("./feedback");
type Row = Parameters<typeof enqueue>[0];

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const row = (id: string, user = "u1"): Row => ({
  id,
  user_id: user,
  kind: "fout",
  message: "x",
  page_path: "/training",
  page_label: "Vandaag",
  context: {},
});

describe("pagina's", () => {
  it("geeft leesbare namen, specifiek vóór algemeen", () => {
    expect(pageNameFor("/training")).toBe("Vandaag");
    expect(pageNameFor("/training/workout")).toBe("Training bezig");
    expect(pageNameFor("/training/oefeningen/nieuw")).toBe("Nieuwe oefening");
    expect(pageNameFor("/training/oefeningen/bench-press")).toBe("Oefening");
    expect(pageNameFor("/training/oefeningen/abc/bewerken")).toBe(
      "Oefening bewerken",
    );
    expect(pageNameFor("/training/schemas/123")).toBe("Schema bewerken");
    expect(pageNameFor("/ergens")).toBe("/ergens");
  });

  it("voegt de paginakop toe als die iets toevoegt", () => {
    expect(
      pageLabelFor("/training/oefeningen/bench-press", "  Bench   press "),
    ).toBe("Oefening · Bench press");
    expect(pageLabelFor("/training/voortgang", "Voortgang")).toBe("Voortgang");
    expect(pageLabelFor("/training", null)).toBe("Vandaag");
  });
});

describe("wachtrij", () => {
  it("verstuurt en leegt de wachtrij", async () => {
    const store = memoryStore();
    enqueue(row("a"), store);
    enqueue(row("b"), store);
    const insert = vi.fn().mockResolvedValue("sent");
    const result = await flushQueue("u1", insert, store);
    expect(result).toEqual({ sent: ["a", "b"], rejected: [], waiting: 0 });
    expect(readQueue(store)).toEqual([]);
  });

  it("houdt rijen vast bij geen netwerk en stopt dan", async () => {
    const store = memoryStore();
    enqueue(row("a"), store);
    enqueue(row("b"), store);
    const insert = vi.fn().mockResolvedValue("retry");
    const result = await flushQueue("u1", insert, store);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(result.waiting).toBe(2);
    expect(readQueue(store).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("gooit geweigerde rijen weg en gaat door", async () => {
    const store = memoryStore();
    enqueue(row("bad"), store);
    enqueue(row("good"), store);
    const insert = vi.fn(async (r: Row) =>
      r.id === "bad" ? ("rejected" as const) : ("sent" as const),
    );
    const result = await flushQueue("u1", insert, store);
    expect(result).toEqual({ sent: ["good"], rejected: ["bad"], waiting: 0 });
  });

  it("laat rijen van een ander account staan", async () => {
    const store = memoryStore();
    enqueue(row("mine", "u1"), store);
    enqueue(row("theirs", "u2"), store);
    const insert = vi.fn().mockResolvedValue("sent");
    await flushQueue("u1", insert, store);
    expect(readQueue(store).map((r) => r.id)).toEqual(["theirs"]);
  });

  it("een gegooide fout telt als opnieuw proberen", async () => {
    const store = memoryStore();
    enqueue(row("a"), store);
    const insert = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await flushQueue("u1", insert, store)).waiting).toBe(1);
  });
});
