import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/api/rate-limit";

/*
 * Le ralentisseur. Il coupe la boucle serrée ; il ne protège PAS le budget —
 * `consume_generation_credit` s'en charge, atomiquement, en base.
 */

const RULE = { limit: 3, windowMs: 60_000 };

beforeEach(resetRateLimits);

describe("la fenêtre", () => {
  it("laisse passer jusqu'à la limite, puis refuse", () => {
    const now = 1_000_000;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(rateLimit("u", RULE, now).allowed).toBe(true);
    }
    const refused = rateLimit("u", RULE, now);
    expect(refused.allowed).toBe(false);
    expect(!refused.allowed && refused.retryAfterSeconds).toBe(60);
  });

  it("rouvre quand la fenêtre est passée", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 3; attempt += 1) rateLimit("u", RULE, now);
    expect(rateLimit("u", RULE, now).allowed).toBe(false);
    expect(rateLimit("u", RULE, now + 60_001).allowed).toBe(true);
  });

  it("compte par clé — une utilisatrice n'épuise pas la voisine", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 3; attempt += 1) rateLimit("a", RULE, now);
    expect(rateLimit("a", RULE, now).allowed).toBe(false);
    expect(rateLimit("b", RULE, now).allowed).toBe(true);
  });

  it("annonce un délai d'au moins une seconde", () => {
    // Un `retry-after: 0` invite à réessayer tout de suite, ce qui est
    // exactement ce qu'on cherche à éviter.
    const now = 1_000_000;
    for (let attempt = 0; attempt < 3; attempt += 1) rateLimit("u", RULE, now);
    const refused = rateLimit("u", RULE, now + 59_999);
    expect(!refused.allowed && refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("ce qu'il ne prétend pas être", () => {
  it("il est PAR PROCESSUS : un redémarrage remet tout à zéro", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 3; attempt += 1) rateLimit("u", RULE, now);
    expect(rateLimit("u", RULE, now).allowed).toBe(false);

    // C'est ce que fait un redéploiement, ou une seconde instance serverless.
    // D'où l'existence du crédit atomique : lui, l'épuisement le reste.
    resetRateLimits();
    expect(rateLimit("u", RULE, now).allowed).toBe(true);
  });
});
