import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ENTITLING_STATUSES,
  REVERSED_STATUSES,
  countUnpaidProjects,
  isBrandKitEntitled,
  lockedMessage,
} from "@/lib/billing/entitlements";

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

describe("ce qu'on dit quand le kit est fermé", () => {
  it("la même phrase pour une carte volée et pour un litige de mauvaise foi", () => {
    // On ne sait pas lequel des deux on a en face, et un produit qui accuse se
    // trompera un jour sur quelqu'un dont la carte a servi sans lui.
    expect(lockedMessage(true)).toBe(
      "That purchase was reversed, so this kit is locked. You can unlock it again whenever you like."
    );
  });

  it("dit ce qui s'est passé et comment revenir, rien d'autre", () => {
    const message = lockedMessage(true);
    expect(message).toContain("reversed");
    expect(message).toContain("unlock it again");
    // Pas de reproche, pas de compte à rebours, aucune mention du fichier
    // qu'elle a déjà — il est à elle.
    expect(message).not.toMatch(/fraud|chargeback|violation|suspend|delete/i);
  });

  it("distingue « jamais payé » de « annulé »", () => {
    expect(lockedMessage(false)).toBe("Your kit is ready when you are.");
    expect(lockedMessage(false)).not.toContain("reversed");
  });
});

/*
 * ── L'ACCORD AVEC `brand_kit_entitled` ───────────────────────────────────
 *
 * Le droit lui-même vient de la base. Ces constantes ne décident rien : elles
 * choisissent le TEXTE montré quand un kit est fermé. Mais si elles divergent
 * de la base, la praticienne lit « votre achat a été annulé » sur un kit qui
 * s'ouvre, ou l'inverse — et personne ne s'en aperçoit avant qu'elle n'écrive.
 *
 * ⚠ CE QUE CE TEST NE PEUT PAS FAIRE : interroger `brand_kit_entitled`. Il
 * épingle la moitié frontale de l'accord. La moitié arrière se vérifie en
 * base, et la vérification vaut d'être refaite à chaque changement de l'un des
 * deux côtés.
 */
describe("les statuts, et ce qu'ils font au kit", () => {
  it("`partially_refunded` laisse le kit OUVERT", () => {
    // Elle a acheté la chose et en a récupéré une part. Fermer le kit pour un
    // geste commercial serait le même mur qu'on a retiré du plafond de projets.
    expect(ENTITLING_STATUSES).toContain("partially_refunded");
    expect(REVERSED_STATUSES as readonly string[]).not.toContain(
      "partially_refunded"
    );
  });

  it("`refunded` et `disputed` le ferment", () => {
    expect(REVERSED_STATUSES).toEqual(["refunded", "disputed"]);
  });

  it("les deux listes ne se recouvrent pas", () => {
    const overlap = (ENTITLING_STATUSES as readonly string[]).filter((status) =>
      (REVERSED_STATUSES as readonly string[]).includes(status)
    );
    expect(overlap).toEqual([]);
  });

  it("chaque statut du CHECK est classé, ou explicitement ni l'un ni l'autre", () => {
    // `pending` et `failed` ne sont ni entitling ni « annulé » : l'argent n'est
    // jamais arrivé, il n'y a rien à annoncer comme reversé.
    const all = [
      "pending",
      "paid",
      "refunded",
      "partially_refunded",
      "disputed",
      "failed",
    ];
    const classified = [
      ...(ENTITLING_STATUSES as readonly string[]),
      ...(REVERSED_STATUSES as readonly string[]),
    ];
    expect(all.filter((status) => !classified.includes(status))).toEqual([
      "pending",
      "failed",
    ]);
  });
});
