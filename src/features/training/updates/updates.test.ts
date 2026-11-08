import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { UPDATES, MAX_UPDATES, recentUpdates, unseenUpdates } =
  await import("./updates");
const { latestReplyAt, newReplies } = await import("./my-feedback");
type Update = (typeof UPDATES)[number];
type Feedback = Parameters<typeof newReplies>[0][number];

const update = (id: string): Update => ({
  id,
  date: "2026-11-08",
  title: id,
  items: [],
});
// Nieuwste eerst.
const list = ["u5", "u4", "u3", "u2", "u1"].map(update);

describe("updates", () => {
  it("echte lijst: unieke ids, nieuwste eerst, met inhoud", () => {
    const ids = UPDATES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dates = UPDATES.map((u) => u.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(UPDATES.every((u) => u.items.length > 0)).toBe(true);
  });

  it("toont alles wat nieuwer is dan de laatst geziene", () => {
    expect(unseenUpdates("u3", list).map((u) => u.id)).toEqual(["u5", "u4"]);
    expect(unseenUpdates("u5", list)).toEqual([]);
  });

  it("nog nooit gezien of onbekend id: alleen de nieuwste", () => {
    expect(unseenUpdates(null, list).map((u) => u.id)).toEqual(["u5"]);
    expect(unseenUpdates("weg", list).map((u) => u.id)).toEqual(["u5"]);
    expect(unseenUpdates(null, [])).toEqual([]);
  });

  it("maximaal 10 terug te lezen en in één keer te tonen", () => {
    const many = Array.from({ length: 14 }, (_, i) => update(`n${14 - i}`));
    expect(recentUpdates(many)).toHaveLength(MAX_UPDATES);
    expect(unseenUpdates("n1", many)).toHaveLength(MAX_UPDATES);
  });
});

describe("reacties op feedback", () => {
  const fb = (id: string, replied_at: string | null): Feedback => ({
    id,
    kind: "idee",
    message: "x",
    page_label: null,
    created_at: "2026-11-08T09:00:00Z",
    resolved_at: replied_at,
    reply: replied_at ? "Gedaan" : null,
    replied_at,
  });
  const items = [
    fb("a", "2026-11-08T10:00:00Z"),
    fb("b", null),
    fb("c", "2026-11-08T12:00:00Z"),
  ];

  it("alleen reacties nieuwer dan de laatst geziene, nieuwste eerst", () => {
    expect(newReplies(items, null).map((f) => f.id)).toEqual(["c", "a"]);
    expect(newReplies(items, "2026-11-08T10:00:00Z").map((f) => f.id)).toEqual([
      "c",
    ]);
    expect(newReplies(items, "2026-11-08T12:00:00Z")).toEqual([]);
  });

  it("onthoudt de laatste reactie", () => {
    expect(latestReplyAt(items)).toBe("2026-11-08T12:00:00Z");
    expect(latestReplyAt([fb("b", null)])).toBeNull();
  });
});
