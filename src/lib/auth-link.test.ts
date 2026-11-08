import { afterEach, describe, expect, it, vi } from "vitest";

// captureAuthLink onthoudt de eerste uitkomst per pagina-load, dus elke test
// laadt de module opnieuw.
async function captureWithHash(hash: string) {
  vi.stubGlobal("window", { location: { hash } });
  vi.resetModules();
  const mod = await import("@/lib/auth-link");
  mod.captureAuthLink();
  return mod.getInitialAuthLink();
}

afterEach(() => vi.unstubAllGlobals());

describe("captureAuthLink", () => {
  it("herkent een uitnodigingslink", async () => {
    expect(
      await captureWithHash(
        "#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=invite",
      ),
    ).toEqual({ type: "invite", error: null });
  });

  it("herkent een herstellink", async () => {
    expect(await captureWithHash("#access_token=abc&type=recovery")).toEqual({
      type: "recovery",
      error: null,
    });
  });

  it("geeft de foutcode van een verlopen link", async () => {
    expect(
      await captureWithHash(
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).toEqual({ type: null, error: "otp_expired" });
  });

  it("negeert gewone HashRouter-routes", async () => {
    expect(await captureWithHash("#/training?type=invite")).toEqual({
      type: null,
      error: null,
    });
    expect(await captureWithHash("")).toEqual({ type: null, error: null });
  });

  it("onthoudt de eerste uitkomst", async () => {
    vi.stubGlobal("window", {
      location: { hash: "#access_token=a&type=invite" },
    });
    vi.resetModules();
    const mod = await import("@/lib/auth-link");
    mod.captureAuthLink();
    // supabase-js wist daarna de hash.
    window.location.hash = "";
    expect(mod.captureAuthLink().type).toBe("invite");
    expect(mod.getInitialAuthLink().type).toBe("invite");
  });
});
