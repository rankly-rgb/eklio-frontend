import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { countUnpaidProjects, isBrandKitEntitled } from "@/lib/billing/entitlements";

/*
 * Le plafond porte sur les projets NON PAYÉS.
 *
 * Il existe pour empêcher de remettre l'allocation de génération à zéro avec
 * « New brief ». Quelqu'un qui a payé ne cultive rien : lui opposer un mur
 * après trois achats serait un ticket de support qu'on ne devrait jamais
 * recevoir.
 */

const USER = "user-1";

function client(
  projects: Array<{ id: string }> | null,
  purchases: Array<{ project_id: string | null }> | null,
  errors: { projects?: unknown; purchases?: unknown } = {}
): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (table === "projects") {
        return {
          select: () => ({
            eq: async () => ({ data: projects, error: errors.projects ?? null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: async () => ({ data: purchases, error: errors.purchases ?? null }),
        }),
      };
    },
  } as unknown as SupabaseClient<Database>;
}

describe("countUnpaidProjects", () => {
  it("compte les projets sans achat", async () => {
    const supabase = client([{ id: "a" }, { id: "b" }, { id: "c" }], []);
    expect(await countUnpaidProjects(supabase, USER)).toBe(3);
  });

  it("ne compte pas un projet payé", async () => {
    const supabase = client(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [{ project_id: "a" }, { project_id: "b" }]
    );
    expect(await countUnpaidProjects(supabase, USER)).toBe(1);
  });

  it("ne plafonne pas quelqu'un qui a tout payé", async () => {
    // C'est le cas qui rendait la version précédente fausse : trois kits
    // achetés, et un mur au quatrième brief.
    const supabase = client(
      [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      [
        { project_id: "a" },
        { project_id: "b" },
        { project_id: "c" },
        { project_id: "d" },
      ]
    );
    expect(await countUnpaidProjects(supabase, USER)).toBe(0);
  });

  it("un achat SANS projet vaut pour tous", async () => {
    // Checkout lancé depuis `/pricing`, avant d'avoir choisi un projet.
    // `resolveEntitledTier` le fait déjà valoir partout ; refuser un nouveau
    // brief à quelqu'un qui vient de payer serait la même erreur à l'envers.
    const supabase = client(
      [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      [{ project_id: null }]
    );
    expect(await countUnpaidProjects(supabase, USER)).toBe(0);
  });

  it("ne compte rien pour un compte tout neuf", async () => {
    expect(await countUnpaidProjects(client([], []), USER)).toBe(0);
  });

  it("laisse passer sur erreur de lecture", async () => {
    // Le plafond est une mesure anti-abus, pas une garde de sécurité, et le
    // crédit de génération reste atomique derrière. Bloquer la création d'un
    // brief parce qu'une lecture a échoué punirait la mauvaise personne.
    const supabase = client(null, null, { projects: { message: "down" } });
    expect(await countUnpaidProjects(supabase, USER)).toBe(0);
  });
});

describe("isBrandKitEntitled — échec fermé", () => {
  it("rend ce que la base répond", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const supabase = { rpc } as unknown as SupabaseClient<Database>;

    expect(await isBrandKitEntitled(supabase, "kit-1")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("brand_kit_entitled", {
      p_brand_kit_id: "kit-1",
    });
  });

  it("refuse quand la lecture échoue", async () => {
    // Un droit qu'on n'a pas pu vérifier n'est pas un droit accordé. Le pire
    // résultat d'un refus injustifié est un checkout montré à quelqu'un qui a
    // payé — visible, réparable. Le pire résultat de l'inverse est un livrable
    // parti sans contrepartie, et celui-là ne remonte jamais.
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "timeout" } }),
    } as unknown as SupabaseClient<Database>;

    expect(await isBrandKitEntitled(supabase, "kit-1")).toBe(false);
  });

  it("ne prend pas `null` pour un oui", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: null }),
    } as unknown as SupabaseClient<Database>;

    expect(await isBrandKitEntitled(supabase, "kit-1")).toBe(false);
  });
});
