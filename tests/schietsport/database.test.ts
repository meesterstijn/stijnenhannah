import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Draait de echte Schietsport-migratie in lokale PostgreSQL (PGlite/WASM),
// met alleen de omliggende Supabase-onderdelen gestubd. Nooit productie.

const A = "a0000000-0000-4000-8000-00000000000a"; // owner
const B = "b0000000-0000-4000-8000-00000000000b"; // tweede owner
const R6 = "c0000000-0000-4000-8000-00000000000c"; // r6_player

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let db: PGlite;
let counter = 1000;
const nextId = () => uuid(++counter);

async function as<T = Record<string, unknown>>(
  user: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    user ?? "",
  ]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

type PushResult = { status: "ok" | "conflict"; row: Record<string, unknown> };

async function push(
  user: string | null,
  entity: string,
  row: Record<string, unknown>,
  baseVersion = 0,
  changeId = nextId(),
): Promise<PushResult> {
  const rows = await as<{ result: PushResult }>(
    user,
    `select public.shooting_push_${entity}($1, $2, $3) as result`,
    [changeId, baseVersion, JSON.stringify(row)],
  );
  return rows[0].result;
}

type PullResult = {
  rows: { entity: string; row: Record<string, unknown> }[];
  has_more: boolean;
  next: number;
  cursor: number;
};

async function pull(user: string, since = 0, limit = 500) {
  const rows = await as<{ result: PullResult }>(
    user,
    "select public.shooting_pull($1, $2) as result",
    [since, limit],
  );
  return rows[0].result;
}

const discipline = (id: string, name = "Precisie") => ({ id, name });
const weapon = (id: string, name = "Walther GSP") => ({
  id,
  name,
  weapon_type: "pistool",
});
const session = (
  id: string,
  disciplineId: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  session_date: "2026-10-29",
  weapon_id: null,
  discipline_id: disciplineId,
  distance: 25,
  session_type: "match",
  total_score: 287,
  max_score: 300,
  notes: null,
  cards: [],
  ...overrides,
});
const fiveCards = (scores: number[], shotsFor: Record<number, number[]> = {}) =>
  scores.map((score, i) => ({
    id: nextId(),
    card_number: i + 1,
    shot_count: 5,
    score,
    shots: shotsFor[i] ?? null,
  }));

let dA: string; // discipline van A
let dB: string; // discipline van B

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create schema storage;
    grant usage on schema public, auth, private, storage to anon, authenticated;
    create table auth.users (id uuid primary key);
    create table public.profiles (id uuid primary key, app_role text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function private.current_app_role() returns text language sql stable
      security definer set search_path = '' as
      $$ select app_role from public.profiles where id = auth.uid() $$;
    create function private.storage_first_segment_uuid(path text) returns uuid
      language plpgsql stable as
      $$ begin return split_part(path, '/', 1)::uuid; exception when others then return null; end $$;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    insert into auth.users values ('${A}'), ('${B}'), ('${R6}');
    insert into public.profiles values ('${A}', 'owner'), ('${B}', 'owner'), ('${R6}', 'r6_player');
  `);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261029000000_schietsport.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  dA = nextId();
  dB = nextId();
  await push(A, "discipline", discipline(dA));
  await push(B, "discipline", discipline(dB, "Snelvuur"));
});

describe("toegang en privacy", () => {
  it("een owner ziet alleen zijn eigen gegevens, ook niet die van de andere owner", async () => {
    const fromA = await pull(A);
    expect(fromA.rows.map((r) => r.row.id)).toEqual([dA]);
    const fromB = await pull(B);
    expect(fromB.rows.map((r) => r.row.id)).toEqual([dB]);
    const direct = await as(B, "select id from public.shooting_disciplines");
    expect(direct.map((r) => r.id)).toEqual([dB]);
  });

  it("een andere gebruiker kan een bestaande rij niet overschrijven", async () => {
    await expect(
      push(B, "discipline", discipline(dA, "Gekaapt"), 1),
    ).rejects.toThrow(/Niet toegestaan/);
  });

  it("andere rollen en anonieme bezoekers hebben geen toegang", async () => {
    await expect(push(R6, "discipline", discipline(nextId()))).rejects.toThrow(
      /Geen toegang/,
    );
    await expect(pull(R6)).rejects.toThrow(/Geen toegang/);
    await expect(
      push(null, "discipline", discipline(nextId())),
    ).rejects.toThrow(/permission denied/);
    expect(await as(R6, "select id from public.shooting_disciplines")).toEqual(
      [],
    );
  });

  it("direct schrijven in de tabellen is niet toegestaan", async () => {
    await expect(
      as(
        A,
        "insert into public.shooting_disciplines (id, user_id, name) values ($1, $2, 'x')",
        [nextId(), A],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(A, "delete from public.shooting_disciplines where id = $1", [dA]),
    ).rejects.toThrow(/permission denied/);
  });

  it("een schietbeurt kan niet naar het wapen van iemand anders verwijzen", async () => {
    const wB = nextId();
    await push(B, "weapon", weapon(wB));
    await expect(
      push(A, "session", session(nextId(), dA, { weapon_id: wB })),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("synchronisatie", () => {
  it("dezelfde wijziging twee keer pushen maakt geen dubbel record", async () => {
    const id = nextId();
    const change = nextId();
    const first = await push(A, "weapon", weapon(id), 0, change);
    const again = await push(A, "weapon", weapon(id), 0, change);
    expect(first.status).toBe("ok");
    expect(again.status).toBe("ok");
    expect(again.row.version).toBe(1);
    const count = await as<{ n: number }>(
      A,
      "select count(*)::int as n from public.shooting_weapons where id = $1",
      [id],
    );
    expect(count[0].n).toBe(1);
  });

  it("een conflict overschrijft niets en geeft de serverversie terug", async () => {
    const id = nextId();
    await push(A, "weapon", weapon(id, "Origineel"));
    const phone = await push(A, "weapon", weapon(id, "Telefoon"), 1);
    expect(phone).toMatchObject({ status: "ok", row: { version: 2 } });
    const laptop = await push(A, "weapon", weapon(id, "Laptop"), 1);
    expect(laptop).toMatchObject({
      status: "conflict",
      row: { name: "Telefoon", version: 2 },
    });
  });

  it("verwijderen is een tombstone die bij pull meekomt", async () => {
    const id = nextId();
    await push(A, "weapon", weapon(id));
    const before = await pull(A);
    await push(
      A,
      "weapon",
      { ...weapon(id), deleted_at: "2026-10-29T12:00:00Z" },
      1,
    );
    const after = await pull(A, before.next);
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]).toMatchObject({
      entity: "weapon",
      row: { id, deleted_at: expect.stringContaining("2026-10-29") },
    });
  });

  it("pull bladert met `next`; `cursor` blijft voor recente rijen staan", async () => {
    const start = (await pull(A)).next;
    for (let i = 0; i < 3; i++)
      await push(A, "discipline", discipline(nextId(), `D${i}`));
    const page1 = await pull(A, start, 2);
    expect(page1.rows).toHaveLength(2);
    expect(page1.has_more).toBe(true);
    expect(page1.next).toBeGreaterThan(start);
    expect(page1.cursor).toBe(start); // alles is < 30 s oud
    const page2 = await pull(A, page1.next, 2);
    expect(page2.rows).toHaveLength(1);
    expect(page2.has_more).toBe(false);
  });
});

describe("schietsportregels in de database", () => {
  it("officiële wedstrijd met alleen totaal; maximum komt van de server", async () => {
    const result = await push(
      A,
      "session",
      session(nextId(), dA, { total_score: 290, max_score: 999 }),
    );
    expect(result.row).toMatchObject({
      total_score: 290,
      max_score: 300,
      cards: [],
    });
  });

  it("weigert ongeldige afstanden en scores", async () => {
    await expect(
      push(A, "session", session(nextId(), dA, { distance: 15 })),
    ).rejects.toThrow();
    await expect(
      push(A, "session", session(nextId(), dA, { total_score: 301 })),
    ).rejects.toThrow();
    await expect(
      push(
        A,
        "session",
        session(nextId(), dA, {
          session_type: "free_card",
          total_score: 51,
          cards: fiveCards([51]),
        }),
      ),
    ).rejects.toThrow();
  });

  it("oefenwedstrijd: 6 kaarten van 5, totaal = som van de kaarten", async () => {
    const id = nextId();
    const result = await push(
      A,
      "session",
      session(id, dA, {
        session_type: "practice_match",
        total_score: 289,
        cards: fiveCards([47, 49, 48, 50, 46, 49], { 2: [10, 10, 9, 10, 9] }),
      }),
    );
    expect(result.status).toBe("ok");
    expect((result.row.cards as unknown[]).length).toBe(6);
    await expect(
      push(
        A,
        "session",
        session(nextId(), dA, {
          session_type: "practice_match",
          total_score: 240,
          cards: fiveCards([48, 48, 48, 48, 48]),
        }),
      ),
    ).rejects.toThrow(/6 kaarten/);
    await expect(
      push(
        A,
        "session",
        session(nextId(), dA, {
          session_type: "practice_match",
          total_score: 288,
          cards: fiveCards([47, 49, 48, 50, 46, 49]),
        }),
      ),
    ).rejects.toThrow(/komt niet overeen/);
  });

  it("vrije kaart: precies 1 kaart van 5; schoten moeten 0–10 zijn en optellen", async () => {
    await expect(
      push(
        A,
        "session",
        session(nextId(), dA, {
          session_type: "free_card",
          total_score: 90,
          cards: fiveCards([45, 45]),
        }),
      ),
    ).rejects.toThrow(/precies 1 kaart/);
    await expect(
      push(
        A,
        "session",
        session(nextId(), dA, {
          session_type: "free_card",
          total_score: 51,
          cards: fiveCards([51], { 0: [11, 10, 10, 10, 10] }),
        }),
      ),
    ).rejects.toThrow();
    await expect(
      push(
        A,
        "session",
        session(nextId(), dA, {
          session_type: "free_card",
          total_score: 48,
          cards: fiveCards([48], { 0: [10, 10, 10, 10, 10] }),
        }),
      ),
    ).rejects.toThrow();
    const ok = await push(
      A,
      "session",
      session(nextId(), dA, {
        session_type: "free_card",
        total_score: 49,
        cards: fiveCards([49], { 0: [10, 10, 10, 10, 9] }),
      }),
    );
    expect(ok.row).toMatchObject({ max_score: 50, total_score: 49 });
  });

  it("wedstrijdkaarten moeten samen 30 schoten zijn (bv. 3 × 10)", async () => {
    const tenCards = (scores: number[]) =>
      scores.map((score, i) => ({
        id: nextId(),
        card_number: i + 1,
        shot_count: 10,
        score,
        shots: null,
      }));
    expect(
      (
        await push(
          A,
          "session",
          session(nextId(), dA, {
            total_score: 284,
            cards: tenCards([95, 97, 92]),
          }),
        )
      ).status,
    ).toBe("ok");
    await expect(
      push(
        A,
        "session",
        session(nextId(), dA, { total_score: 192, cards: tenCards([95, 97]) }),
      ),
    ).rejects.toThrow(/30 schoten/);
  });

  it("bijwerken vervangt de kaarten van een schietbeurt", async () => {
    const id = nextId();
    await push(
      A,
      "session",
      session(id, dA, {
        session_type: "practice_match",
        total_score: 300,
        cards: fiveCards([50, 50, 50, 50, 50, 50]),
      }),
    );
    const updated = await push(
      A,
      "session",
      session(id, dA, { session_type: "match", total_score: 280, cards: [] }),
      1,
    );
    expect(updated.row).toMatchObject({
      session_type: "match",
      total_score: 280,
      cards: [],
    });
    const cards = await as<{ n: number }>(
      A,
      "select count(*)::int as n from public.shooting_session_cards where session_id = $1",
      [id],
    );
    expect(cards[0].n).toBe(0);
  });
});

describe("competities", () => {
  it("alleen officiële wedstrijden; typewijziging laat de koppeling vervallen", async () => {
    const comp = nextId();
    await push(A, "competition", {
      id: comp,
      name: "Winter 2026",
      start_date: "2026-10-01",
      end_date: "2027-03-31",
      discipline_id: dA,
    });
    const practice = nextId();
    await push(
      A,
      "session",
      session(practice, dA, {
        session_type: "practice_match",
        total_score: 300,
        cards: fiveCards([50, 50, 50, 50, 50, 50]),
      }),
    );
    await expect(
      push(A, "competition_entry", {
        id: nextId(),
        competition_id: comp,
        session_id: practice,
      }),
    ).rejects.toThrow(/officiële wedstrijden/);

    const match = nextId();
    await push(A, "session", session(match, dA));
    const entry = nextId();
    expect(
      (
        await push(A, "competition_entry", {
          id: entry,
          competition_id: comp,
          session_id: match,
        })
      ).status,
    ).toBe("ok");
    await expect(
      push(A, "competition_entry", {
        id: nextId(),
        competition_id: comp,
        session_id: match,
      }),
    ).rejects.toThrow(/duplicate key/);

    await push(
      A,
      "session",
      session(match, dA, {
        session_type: "practice_match",
        total_score: 300,
        cards: fiveCards([50, 50, 50, 50, 50, 50]),
      }),
      1,
    );
    const rows = await as<{ deleted_at: string | null }>(
      A,
      "select deleted_at from public.shooting_competition_entries where id = $1",
      [entry],
    );
    expect(rows[0].deleted_at).not.toBeNull();
  });
});

describe("wapenfoto's", () => {
  it("alleen in de eigen map, en alleen zelf te lezen", async () => {
    await as(
      A,
      "insert into storage.objects (bucket_id, name) values ('shooting-weapon-photos', $1)",
      [`${A}/w1.webp`],
    );
    await expect(
      as(
        A,
        "insert into storage.objects (bucket_id, name) values ('shooting-weapon-photos', $1)",
        [`${B}/w1.webp`],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await as(
        B,
        "select name from storage.objects where bucket_id = 'shooting-weapon-photos'",
      ),
    ).toEqual([]);
    expect(
      (
        await as(
          A,
          "select name from storage.objects where bucket_id = 'shooting-weapon-photos'",
        )
      ).length,
    ).toBe(1);
  });
});
