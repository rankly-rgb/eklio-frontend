import { describe, expect, it, vi } from "vitest";
import {
  ReserveRefused,
  aPurchaseWouldHelp,
  reserveRefusal,
  withOverhead,
  withPaidCall,
  type CreditPort,
  type ReserveRefusal,
} from "@/lib/credits/paid-call";

/*
 * ── ⚠ UN APPEL PAYANT QUI N'EST PAS AU LIVRE EST UN APPEL QU'ON CROIT
 *      GRATUIT ────────────────────────────────────────────────────────────
 *
 * Mesuré : dix mois, trois cents posts, `credit_ledger` inchangé à 844 lignes.
 * Cinq défauts de la même famille (F18, F19, F21, F23, F25) disaient la même
 * chose — une grandeur juste, calculée, jamais consommée.
 *
 * Ce wrapper est la réponse structurelle : on ne corrige pas cinq endroits, on
 * rend impossible d'écrire l'appel sans son écriture.
 */
const port = (overrides: Partial<CreditPort> = {}): CreditPort & {
  reserved: string[]; settled: Array<[string, number, boolean]>;
} => {
  const reserved: string[] = [];
  const settled: Array<[string, number, boolean]> = [];
  return {
    reserved, settled,
    reserve: overrides.reserve ?? (async (s) => { reserved.push(s.reason); return { ok: true as const, reservationId: `res-${reserved.length}` }; }),
    settle: overrides.settle ?? (async (id, cost, ok) => { settled.push([id, cost, ok]); }),
  };
};

const ran = (costUsd: number) => async () => ({ value: "x", usage: { input: 1, output: 1 }, costUsd });

describe("withPaidCall", () => {
  it("réserve AVANT d'appeler, règle APRÈS", async () => {
    const order: string[] = [];
    const p: CreditPort = {
      reserve: async () => { order.push("reserve"); return { ok: true as const, reservationId: "res-1" }; },
      settle: async () => { order.push("settle"); },
    };
    await withPaidCall(p, { userId: "u", kind: "post_generation", reason: "r" }, async () => {
      order.push("call");
      return { value: 1, usage: { input: 1, output: 1 }, costUsd: 0.002 };
    });
    expect(order).toEqual(["reserve", "call", "settle"]);
  });

  it("règle au coût réel quand l'appel réussit", async () => {
    const p = port();
    await withPaidCall(p, { userId: "u", kind: "post_generation", reason: "r" }, ran(0.0031));
    expect(p.settled).toEqual([["res-1", 0.0031, true]]);
  });

  /*
   * ⚠ UN APPEL RATÉ A DÉPENSÉ DES JETONS ET NE DOIT RIEN À LA PRATICIENNE :
   * il se solde à `false`, ce qui rend le crédit en gardant la ligne. C'est la
   * règle que F19 a établie en la violant.
   */
  it("règle quand même quand l'appel lève, et relaie l'erreur", async () => {
    const p = port();
    await expect(withPaidCall(p, { userId: "u", kind: "post_generation", reason: "r" }, async () => {
      throw new Error("529 overloaded");
    })).rejects.toThrow("529");
    expect(p.settled).toEqual([["res-1", 0, false]]);
  });

  it("un quota refusé n'appelle rien", async () => {
    const call = vi.fn();
    const p = port({ reserve: async () => ({ ok: false as const, reason: "quota_exhausted" as const }) });
    await expect(withPaidCall(p, { userId: "u", kind: "post_generation", reason: "r" }, async () => {
      call();
      return { value: 1, usage: { input: 0, output: 0 }, costUsd: 0 };
    })).rejects.toBeInstanceOf(ReserveRefused);
    expect(call).not.toHaveBeenCalled();
  });
});

describe("withOverhead", () => {
  it("passe par le livre avec le genre qui ne facture pas", async () => {
    const kinds: string[] = [];
    const p: CreditPort = {
      reserve: async (s) => { kinds.push(s.kind); return { ok: true as const, reservationId: "res-1" }; },
      settle: async () => {},
    };
    await withOverhead(p, { userId: "u", reason: "juge de complétude" }, ran(0.0004));
    expect(kinds).toEqual(["overhead"]);
  });

  /*
   * ⚠ UN CONTRÔLE DE SYNTAXE NE FAIT PAS TOMBER UN MOIS. `overhead` est
   * illimité par construction ; si la réservation échoue quand même, l'appel a
   * lieu et le défaut se voit par l'ABSENCE de ligne, ce que
   * `credit_month_audit` sert à lire.
   */
  it("appelle quand même si la réservation échoue", async () => {
    const p = port({ reserve: async () => ({ ok: false as const, reason: "quota_exhausted" as const }) });
    const out = await withOverhead(p, { userId: "u", reason: "réparation" }, ran(0.001));
    expect(out.costUsd).toBe(0.001);
    expect(p.settled).toEqual([]);
  });
});
