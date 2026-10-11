import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ARMED_ENV_VAR, contentGenerationArmed } from "@/lib/content/generate/armed";
import { GET } from "@/app/api/cron/content-month/route";

const due = vi.hoisted(() => ({ list: [] as Array<{ brandKitId: string; projectId: string; userId: string }> }));
const orchestrate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/content/month/server-ports", () => ({ serverDuePort: () => ({}) }));
vi.mock("@/lib/content/month/due", () => ({
  selectDueMonths: async () => ({ due: due.list, skipped: [{ brandKitId: "served", reason: "already_served" }] }),
}));
vi.mock("@/lib/content/month/run-for-kit", () => ({ MONTH_CAP_USD: 3, orchestrateMonthForKit: orchestrate }));

/*
 * ── PROVING THE THING IS OFF ────────────────────────────────────────────
 *
 * A cron shipped disarmed is only disarmed if something checks. This is that
 * something, and it checks both locks — the schedule and the flag — because
 * either one alone would let a slip through.
 */

const ROOT = resolve(__dirname, "../../../..");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the schedule, which is lock one", () => {
  it("vercel.json does not schedule the monthly fill", () => {
    const crons = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };

    // Anti-vacuous: the file really does schedule things, so an empty list
    // cannot be what makes this pass.
    expect(crons.crons.length).toBeGreaterThanOrEqual(3);
    expect(crons.crons.map((entry) => entry.path)).not.toContain("/api/cron/content-month");
  });
});

describe("the flag, which is lock two", () => {
  it("is off unless the value is exactly \"true\"", () => {
    expect(contentGenerationArmed({})).toBe(false);
    expect(contentGenerationArmed({ [ARMED_ENV_VAR]: "true" })).toBe(true);

    /*
     * ⚠ THE EXPENSIVE TYPO. A flag read as "truthy" would arm on the string
     * "false", which is the single most likely way this gets switched on by
     * accident — someone writing the variable to turn it OFF.
     */
    for (const off of ["false", "0", "no", "TRUE", "True", " true", ""]) {
      expect(contentGenerationArmed({ [ARMED_ENV_VAR]: off })).toBe(false);
    }
  });
});

describe("the route", () => {
  it("refuses an unauthorised caller before saying anything about the flag", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv(ARMED_ENV_VAR, "true");

    const response = await GET(new Request("https://example.test/api/cron/content-month"));
    expect(response.status).toBe(404);

    const body = (await response.json()) as Record<string, unknown>;
    // An unauthorised caller learns nothing about what is armed.
    expect(body).not.toHaveProperty("armed");
  });

  it("answers 503 and names the switch when it is disarmed", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv(ARMED_ENV_VAR, "");

    const response = await GET(
      new Request("https://example.test/api/cron/content-month", {
        headers: { authorization: "Bearer s3cret" },
      })
    );

    expect(response.status).toBe(503);
    const body = (await response.json()) as { armed: boolean; generated: number; reason: string };
    expect(body.armed).toBe(false);
    expect(body.generated).toBe(0);
    // ⚠ It says WHICH switch. A 404 here would send someone hunting a
    //   deployment problem that does not exist.
    expect(body.reason).toContain(ARMED_ENV_VAR);
  });

  it("armed without the writer's key: 503, names the key, opens nothing", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv(ARMED_ENV_VAR, "true");
    vi.stubEnv("OPENAI_API_KEY", "");
    orchestrate.mockReset();

    const response = await GET(
      new Request("https://example.test/api/cron/content-month", { headers: { authorization: "Bearer s3cret" } })
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { armed: boolean; generated: number; reason: string };
    expect(body.armed).toBe(true);
    expect(body.reason).toContain("OPENAI_API_KEY");
    expect(orchestrate).not.toHaveBeenCalled();
  });

  /*
   * ⚠ ARMÉE ET POURVUE, ELLE PASSE PAR L'ORCHESTRATEUR — UN MOIS PAR COMPTE DÛ.
   * L'énumération et l'orchestrateur sont éprouvés ailleurs ; ce qui l'est ici est
   * la porte : le mois visé, un appel par compte, et un compte qui lève n'arrête
   * pas les autres.
   */
  it("armed: one month per due account, for next month, and a failure is reported", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv(ARMED_ENV_VAR, "true");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    due.list = [
      { brandKitId: "k1", projectId: "p1", userId: "u1" },
      { brandKitId: "k2", projectId: "p2", userId: "u2" },
    ];
    orchestrate.mockReset();
    orchestrate
      .mockResolvedValueOnce({ ok: true, month: { written: 30 }, costUsd: 0.7 })
      .mockRejectedValueOnce(new Error("boom"));

    const response = await GET(
      new Request("https://example.test/api/cron/content-month", { headers: { authorization: "Bearer s3cret" } })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      month: string;
      generated: number;
      served: Array<{ brandKitId: string; ok: boolean; stage?: string }>;
      skipped: unknown[];
      deferred: string[];
    };
    expect(orchestrate).toHaveBeenCalledTimes(2);
    expect(orchestrate.mock.calls[0][2], "le mois visé n'est pas le premier du mois suivant").toMatch(/^\d{4}-\d{2}-01$/);
    expect(body.generated).toBe(1);
    expect(body.served.map((s) => [s.brandKitId, s.ok, s.stage ?? null])).toEqual([
      ["k1", true, null],
      ["k2", false, "error"],
    ]);
    expect(body.skipped).toHaveLength(1);
    expect(body.deferred).toEqual([]);
  });
});
