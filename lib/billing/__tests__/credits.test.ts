import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { creditPhrase, getCreditMeter, shouldShow, type CreditLine } from "@/lib/billing/credits";

/*
 * Le compteur doit être visible et jamais anxiogène — ce qui est une exigence
 * de produit, donc une exigence testable. Deux règles la portent :
 *
 *   * l'illimité est un MOT, jamais un grand nombre ;
 *   * un compteur ne compte à rebours qu'en approchant, pas dès le premier
 *     usage.
 */

function client(result: { data: unknown; error: unknown }): SupabaseClient<Database> {
  return {
    rpc: async (name: string) => {
      if (name !== "credit_meter") throw new Error(`rpc inattendu : ${name}`);
      return result;
    },
  } as unknown as SupabaseClient<Database>;
}

const line = (over: Partial<CreditLine> = {}): CreditLine => ({
  kind: "regeneration",
  limit: 10,
  consumed: 0,
  remaining: 10,
  ...over,
});

describe("getCreditMeter", () => {
  it("reads the four kinds the database returns", async () => {
    const meter = await getCreditMeter(
      client({
        data: {
          post_generation: { limit: 30, consumed: 12, remaining: 18 },
          swap: { limit: null, consumed: 7, remaining: null },
          regeneration: { limit: 10, consumed: 1, remaining: 9 },
          custom_visual: { limit: 4, consumed: 4, remaining: 0 },
        },
        error: null,
      })
    );
    expect(meter.swap.limit).toBeNull();
    expect(meter.swap.consumed).toBe(7);
    expect(meter.custom_visual.remaining).toBe(0);
  });

  /*
   * ⚠ FERMÉ DANS LE SENS QUI SE VOIT. Zéro s'affiche et remonte en support ;
   * un illimité inventé ne remonte jamais.
   */
  it("a read error yields zeroes, never an invented unlimited", async () => {
    const meter = await getCreditMeter(client({ data: null, error: { message: "boom" } }));
    expect(meter.swap.limit).toBe(0);
    expect(meter.regeneration.remaining).toBe(0);
  });

  it("a missing kind is zero rather than absent", async () => {
    const meter = await getCreditMeter(client({ data: { swap: { limit: null, consumed: 0, remaining: null } }, error: null }));
    expect(meter.custom_visual).toEqual({
      kind: "custom_visual",
      limit: 0,
      consumed: 0,
      remaining: 0,
    });
  });
});

describe("creditPhrase", () => {
  it("says the word, never a number, for unlimited", () => {
    expect(creditPhrase(line({ kind: "swap", limit: null, remaining: null }))).toBe("unlimited");
    // Anti-vacuité : la phrase ne contient aucun chiffre.
    expect(creditPhrase(line({ kind: "swap", limit: null, remaining: null }))).not.toMatch(/\d/);
  });

  /*
   * ⚠ PAS DE COMPTE À REBOURS TANT QU'IL EN RESTE. « 10 left » au premier jour
   * du mois est une anxiété fabriquée avant de servir à quoi que ce soit.
   */
  it("states the allowance while it is comfortable", () => {
    expect(creditPhrase(line({ limit: 10, remaining: 10 }))).toBe("10 a month");
    expect(creditPhrase(line({ limit: 10, remaining: 7 }))).toBe("10 a month");
  });

  it("counts down only as it approaches", () => {
    expect(creditPhrase(line({ limit: 10, remaining: 3 }))).toBe("3 left this month");
    expect(creditPhrase(line({ limit: 10, remaining: 1 }))).toBe("1 left this month");
  });

  it("says it plainly when there is none", () => {
    expect(creditPhrase(line({ limit: 4, remaining: 0 }))).toBe("none left this month");
  });

  it("a small allowance counts down from the first spend", () => {
    // Four custom visuals: the third is genuinely worth knowing about.
    expect(creditPhrase(line({ kind: "custom_visual", limit: 4, remaining: 2 }))).toBe(
      "2 left this month"
    );
  });
});

describe("shouldShow", () => {
  /*
   * ⚠ « SUPPRIME LES COMPTEURS À ZÉRO ». Un essai n'a pas de visuel custom ;
   * lui afficher « 0 a month » est un mur là où il n'y avait pas de porte.
   */
  it("hides a line whose allowance is zero", () => {
    expect(shouldShow(line({ kind: "custom_visual", limit: 0, remaining: 0 }))).toBe(false);
  });

  it("shows the unlimited one, because saying it once is the point", () => {
    expect(shouldShow(line({ kind: "swap", limit: null, remaining: null }))).toBe(true);
  });
});
