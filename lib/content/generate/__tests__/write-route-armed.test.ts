import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * ⚠ LA ROUTE « WRITE IT » NE DÉPENSE PAS SANS LE DRAPEAU (2026-10-11).
 *
 * Passée sur la clé OpenAI — qui peut déjà exister en production pour les
 * images —, elle aurait écrit et débité sur un simple POST, le drapeau absent :
 * seule l'absence de clé Anthropic la fermait jusqu'ici. Ce test l'appelle.
 */
const beginWrite = vi.hoisted(() => vi.fn(async () => ({ ok: false as const, code: "stop", message: "stop" })));

vi.mock("@/lib/api/handler", () => ({
  authenticate: async () => ({ ok: true, session: { supabase: {}, userId: "u1" } }),
  badRequest: (m: string) => Response.json({ error: m }, { status: 400 }),
  readJson: async (r: Request) => r.json(),
  serverError: () => Response.json({ error: "server" }, { status: 500 }),
}));
vi.mock("@/lib/data/content", () => ({
  contentMonthKey: () => "2026-11-01",
  getContentCheckin: async () => null,
  getContentPreferences: async () => null,
  getContentItem: async () => ({ ok: true, data: { id: "i1", brand_kit_id: "k1", title: "", caption: "", created_at: "2026-11-02" } }),
}));
vi.mock("@/lib/data/brand-kit", () => ({ loadBrandKit: async () => ({ practiceName: "Still Water", selectedDirection: null }) }));
vi.mock("@/lib/data/on-demand", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/on-demand")>()),
  beginWrite,
  applyWrite: vi.fn(),
  releaseWrite: vi.fn(),
}));
vi.mock("@/lib/content/respond", () => ({ contentResponse: () => Response.json({ stopped: true }, { status: 409 }) }));

const { POST } = await import("@/app/api/content-items/[id]/write/route");

const call = () =>
  POST(
    new Request("http://x/api/content-items/i1/write", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "key-12345678", idea: "Rest can be learned" }),
    }),
    { params: Promise.resolve({ id: "i1" }) } as never
  );

afterEach(() => {
  vi.unstubAllEnvs();
  beginWrite.mockClear();
});

describe("« Write it » : deux verrous, sur la route aussi", () => {
  it("clé présente, drapeau absent : 503, et rien n'est réservé", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("CONTENT_GENERATION_ARMED", "");
    const response = await call();
    expect(response.status).toBe(503);
    expect(beginWrite).not.toHaveBeenCalled();
  });

  it("drapeau posé, clé absente : 503, et rien n'est réservé", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("CONTENT_GENERATION_ARMED", "true");
    const response = await call();
    expect(response.status).toBe(503);
    expect(beginWrite).not.toHaveBeenCalled();
  });

  it("les deux : la réservation part (et le témoin prouve que le test sait la voir)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("CONTENT_GENERATION_ARMED", "true");
    await call();
    expect(beginWrite).toHaveBeenCalledTimes(1);
  });
});
