import { describe, expect, it, vi, afterEach } from "vitest";
import { ARMED_ENV_VAR } from "../armed";
import { nextMonthKey, queueFirstContentMonth } from "../queue";

/*
 * ── UNE FILE QUI NE PROMET RIEN QU'ELLE NE PUISSE TENIR ─────────────────
 *
 * Une ligne `content_months` en `generating` dit à l'écran « Eklio écrit votre
 * mois ». Si le générateur est désarmé, personne ne vient jamais la ramasser,
 * et cette phrase reste à l'écran de quelqu'un qui vient de payer.
 *
 * D'où le premier test, qui est le seul qui compte vraiment ici.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Un faux client minimal : on n'observe que ce qui est écrit, et si. */
function fakeAdmin(options: {
  kitId?: string | null;
  insertError?: { code?: string; message: string } | null;
  inserts?: Record<string, unknown>[];
}) {
  const inserts = options.inserts ?? [];
  return {
    from(table: string) {
      if (table === "brand_kits") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          order: () => chain,
          limit: async () => ({
            data: options.kitId === null ? [] : [{ id: options.kitId ?? "kit-1" }],
            error: null,
          }),
        };
        return chain;
      }
      return {
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row);
          return { error: options.insertError ?? null };
        },
      };
    },
  } as never;
}

describe("nextMonthKey", () => {
  it("donne le premier du mois suivant, en UTC, et franchit l'année", () => {
    expect(nextMonthKey(new Date("2026-09-10T23:30:00Z"))).toBe("2026-10-01");
    expect(nextMonthKey(new Date("2026-12-31T23:59:59Z"))).toBe("2027-01-01");
    // ⚠ Des dates de calendrier, jamais des instants locaux : un `Date` local
    //   décalerait tout le mois d'un jour à l'ouest de Greenwich.
    expect(nextMonthKey(new Date("2026-01-31T00:00:00Z"))).toBe("2026-02-01");
  });
});

describe("la file", () => {
  it("⚠ n'écrit RIEN tant que le générateur est désarmé", async () => {
    vi.stubEnv(ARMED_ENV_VAR, "");
    const inserts: Record<string, unknown>[] = [];

    const outcome = await queueFirstContentMonth(fakeAdmin({ inserts }), { userId: "u1" });

    expect(outcome).toEqual({ queued: false, reason: "disarmed" });
    // Le vrai test : aucune ligne « en cours d'écriture » posée devant
    // quelqu'un qui vient de payer, alors que personne ne viendra l'écrire.
    expect(inserts).toEqual([]);
  });

  it("pose le mois suivant, en `generating` et sans thèmes", async () => {
    vi.stubEnv(ARMED_ENV_VAR, "true");
    const inserts: Record<string, unknown>[] = [];

    const outcome = await queueFirstContentMonth(fakeAdmin({ inserts }), {
      userId: "u1",
      now: new Date("2026-09-10T00:00:00Z"),
    });

    expect(outcome).toEqual({ queued: true, month: "2026-10-01" });
    expect(inserts).toEqual([
      { brand_kit_id: "kit-1", month: "2026-10-01", themes: [], status: "generating" },
    ]);
  });

  it("lit un rejeu Stripe comme un doublon, pas comme un incident", async () => {
    vi.stubEnv(ARMED_ENV_VAR, "true");
    // 23505 : `content_months_kit_month_key`. C'est la base qui rend la file
    // idempotente, pas un drapeau que quelqu'un a pensé à vérifier.
    const outcome = await queueFirstContentMonth(
      fakeAdmin({ insertError: { code: "23505", message: "duplicate key" } }),
      { userId: "u1" }
    );
    expect(outcome).toEqual({ queued: false, reason: "already_queued" });
  });

  it("ne met rien en file pour quelqu'un qui n'a pas de kit", async () => {
    vi.stubEnv(ARMED_ENV_VAR, "true");
    const inserts: Record<string, unknown>[] = [];
    const outcome = await queueFirstContentMonth(fakeAdmin({ kitId: null, inserts }), {
      userId: "u1",
    });
    expect(outcome).toEqual({ queued: false, reason: "no_kit" });
    expect(inserts).toEqual([]);
  });
});
