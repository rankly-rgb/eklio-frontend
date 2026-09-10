import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ARMED_ENV_VAR, contentGenerationArmed } from "@/lib/content/generate/armed";
import { GET } from "@/app/api/cron/content-month/route";

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

  it("still generates nothing when armed, and says why", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv(ARMED_ENV_VAR, "true");

    const response = await GET(
      new Request("https://example.test/api/cron/content-month", {
        headers: { authorization: "Bearer s3cret" },
      })
    );

    // 501, not 500: theme selection waits on the first month being read, and
    // a guess at it shipped behind a flag would be worse than nothing.
    expect(response.status).toBe(501);
    const body = (await response.json()) as { armed: boolean; generated: number };
    expect(body.armed).toBe(true);
    expect(body.generated).toBe(0);
  });
});
