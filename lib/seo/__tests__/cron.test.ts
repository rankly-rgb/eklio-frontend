import { describe, expect, it } from "vitest";
import { PIECES_PER_SUBSCRIBER, SEO_MAX_PARALLEL_CALLS, runSeoPool, subscribersInFlight } from "@/lib/seo/cron";

/* Une horloge à la main : chaque abonnée « dure » ce qu'on lui dit, sans attendre pour de vrai. */
function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("une seule constante borne les appels simultanés", () => {
  it("floor(cap / 3) abonnées à la fois, jamais moins d'une", () => {
    expect(subscribersInFlight(15)).toBe(5);
    expect(subscribersInFlight(6)).toBe(2);
    expect(subscribersInFlight(1)).toBe(1);
    expect(subscribersInFlight() * PIECES_PER_SUBSCRIBER).toBeLessThanOrEqual(SEO_MAX_PARALLEL_CALLS);
  });

  it("le pool ne dépasse jamais ce nombre d'abonnées en vol", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await runSeoPool({
      candidates: Array.from({ length: 11 }, (_, i) => `u${i}`),
      windowMs: 280_000,
      maxParallelCalls: 9,
      serve: async (u) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight -= 1;
        return u;
      },
    });
    expect(peak).toBe(3);
    expect(out.served).toHaveLength(11);
    expect(out.deferred).toEqual([]);
  });
});

describe("la garde de temps : on ne commence pas ce qu'on ne peut pas finir", () => {
  it("une abonnée n'est pas commencée si écoulé + la plus lente dépasse la fenêtre", async () => {
    const c = clock();
    // Fenêtre 280 s, la plus lente connue 186 s ; chaque abonnée dure 100 s ; une à la fois.
    const out = await runSeoPool({
      candidates: ["a", "b", "c"],
      windowMs: 280_000,
      maxParallelCalls: 3,
      slowestMs: 186_000,
      now: c.now,
      serve: async (u) => {
        c.advance(100_000);
        return u;
      },
    });
    // a part à 0 s (0 + 186 ≤ 280) ; b à 100 s (286 > 280) : différée, et c avec elle.
    expect(out.served).toEqual(["a"]);
    expect(out.deferred).toEqual(["b", "c"]);
  });

  it("la plus lente se met à jour avec ce que l'appel mesure", async () => {
    const c = clock();
    const out = await runSeoPool({
      candidates: ["a", "b", "c"],
      windowMs: 280_000,
      maxParallelCalls: 3,
      slowestMs: 50_000,
      now: c.now,
      serve: async (u) => {
        c.advance(u === "a" ? 200_000 : 10_000);
        return u;
      },
    });
    // après a (200 s), la plus lente vaut 200 s : 200 + 200 > 280, b n'est pas commencée.
    expect(out.slowestMs).toBe(200_000);
    expect(out.served).toEqual(["a"]);
    expect(out.deferred).toEqual(["b", "c"]);
  });
});
