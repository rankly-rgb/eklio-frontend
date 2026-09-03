import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The other half of the round trip: this route is the confirmation link's
 * OWN target, built from whatever `next` signUp embedded in
 * emailRedirectTo (see sign-up-redirect.test.ts). `next` here is exactly
 * as attacker-reachable as a query string ever is — anyone can shape a
 * confirmation-shaped link and get a real person to click it — so it must
 * be re-validated on the way back in, not trusted because it once passed
 * through signUp's own filter.
 */

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

const { GET } = await import("@/app/auth/callback/route");

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

function locationOf(response: Response): string {
  const location = response.headers.get("location");
  if (!location) throw new Error("callback route did not redirect");
  return location;
}

describe("a valid code with an internal next", () => {
  it("redirects to the requested internal destination", async () => {
    const response = await GET(
      new Request("https://app.example.com/auth/callback?code=abc&next=%2Finvite%2Ftok123")
    );
    expect(locationOf(response)).toBe("https://app.example.com/invite/tok123");
  });

  it("defaults to /app when no next is given", async () => {
    const response = await GET(new Request("https://app.example.com/auth/callback?code=abc"));
    expect(locationOf(response)).toBe("https://app.example.com/app");
  });
});

describe("a valid code with a hostile next", () => {
  it("falls back to /app instead of following an external destination", async () => {
    for (const hostile of [
      "https://evil.example",
      "//evil.example",
      "javascript:alert(1)",
    ]) {
      const response = await GET(
        new Request(
          `https://app.example.com/auth/callback?code=abc&next=${encodeURIComponent(hostile)}`
        )
      );
      expect(locationOf(response)).toBe("https://app.example.com/app");
    }
  });
});

describe("no code, or the exchange fails", () => {
  it("sends the visitor to /login rather than following next at all", async () => {
    const response = await GET(
      new Request("https://app.example.com/auth/callback?next=%2Finvite%2Ftok123")
    );
    expect(locationOf(response)).toBe("https://app.example.com/login");
  });

  it("sends the visitor to /login when the code exchange itself fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
    const response = await GET(
      new Request("https://app.example.com/auth/callback?code=bad&next=%2Finvite%2Ftok123")
    );
    expect(locationOf(response)).toBe("https://app.example.com/login");
  });
});
