import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase-config";
import {
  clearCachedProfiles,
  readCachedProfile,
  readStoredSession,
  writeCachedProfile,
} from "@/lib/offline-auth";

function memoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  // Object.keys(localStorage) moet de opgeslagen sleutels opleveren.
  return new Proxy(storage, {
    ownKeys: () => [...map.keys()],
    getOwnPropertyDescriptor: (_t, k) =>
      typeof k === "string" && map.has(k)
        ? { enumerable: true, configurable: true, value: map.get(k) }
        : undefined,
  });
}

beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("readStoredSession", () => {
  it("geeft de opgeslagen sessie terug als die user en refresh token heeft", () => {
    localStorage.setItem(
      SUPABASE_AUTH_STORAGE_KEY,
      JSON.stringify({ refresh_token: "r", user: { id: "u1" } }),
    );
    expect(readStoredSession()?.user.id).toBe("u1");
  });

  it("geeft null zonder sessie, bij kapotte JSON of onvolledige sessie", () => {
    expect(readStoredSession()).toBeNull();
    localStorage.setItem(SUPABASE_AUTH_STORAGE_KEY, "{kapot");
    expect(readStoredSession()).toBeNull();
    localStorage.setItem(
      SUPABASE_AUTH_STORAGE_KEY,
      JSON.stringify({ user: { id: "u1" } }),
    );
    expect(readStoredSession()).toBeNull();
  });

  it("geeft null als storage niet beschikbaar is", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readStoredSession()).toBeNull();
  });
});

describe("profielcache", () => {
  it("bewaart per account en wist alleen eigen sleutels", () => {
    writeCachedProfile("u1", { id: "u1", app_role: "owner" });
    writeCachedProfile("u2", { id: "u2", app_role: "r6_player" });
    localStorage.setItem("anders", "blijft");

    expect(readCachedProfile<{ app_role: string }>("u1")?.app_role).toBe(
      "owner",
    );
    expect(readCachedProfile("u3")).toBeNull();

    clearCachedProfiles();
    expect(readCachedProfile("u1")).toBeNull();
    expect(readCachedProfile("u2")).toBeNull();
    expect(localStorage.getItem("anders")).toBe("blijft");
  });
});
