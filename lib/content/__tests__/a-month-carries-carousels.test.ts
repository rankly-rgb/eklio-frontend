import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkMix, MONTH_LIMITS } from "@/lib/content/month-checks";

/*
 * ── ⚠ ZÉRO CARROUSEL SUR QUATRE-VINGT-DIX POSTS LIVRÉS ─────────────────
 *
 * Trois mois d'affilée, avec vingt-trois sujets de carrousel LIBRES en banque
 * (F22). Deux causes empilées : l'ordre de tirage condamnait la dernière
 * famille — rejets 7 / 15 / 23 selon le rang — et le modèle rendait `cards`
 * au premier niveau, ce qui faisait refuser chaque carrousel payé.
 *
 * Les deux sont corrigées. Ce plancher existe parce que RIEN NE L'AURAIT DIT :
 * `mix.distinct` se contente de sept archétypes sur onze, donc un mois à dix
 * passe et le onzième peut manquer depuis toujours. Les trois mois affichaient
 * un entonnoir vert, un mélange conforme et dix archétypes.
 */
const month = (carousels: number, n = 30) => [
  ...Array.from({ length: carousels }, () => "carousel"),
  ...Array.from({ length: Math.floor((n - carousels) / 6) }, () => "single_statement"),
  ...Array.from({ length: n - carousels - Math.floor((n - carousels) / 6) }, (_, i) =>
    ["cycle", "quadrant_model", "comparison_pair", "surface_and_beneath",
     "numbered_strategies", "concentric_control", "annotated_curve"][i % 7]),
];

const names = (f: { check: string }[]) => f.map((x) => x.check);

describe("un mois porte des carrousels", () => {
  it("zéro carrousel est refusé", () => {
    expect(names(checkMix(month(0)))).toContain("mix.carousel");
  });

  /*
   * ⚠ DEUX, PAS UN : un seul carrousel est un accident qui peut se reproduire
   * à l'identique le mois suivant sans qu'aucun chiffre bouge.
   */
  it("un seul carrousel est refusé aussi", () => {
    expect(names(checkMix(month(1)))).toContain("mix.carousel");
    expect(names(checkMix(month(2)))).not.toContain("mix.carousel");
  });

  it("le constat dit combien il en a compté", () => {
    const found = checkMix(month(1)).find((f) => f.check === "mix.carousel");
    expect(found?.detail).toContain("1 carrousel(s)");
    expect(found?.detail).toContain(`minimum ${MONTH_LIMITS.minCarousels}`);
  });

  /*
   * ⚠ ET UN MOIS TROP COURT NE DÉCLENCHE PAS CE CONSTAT-LÀ : les proportions
   * ne veulent rien dire sous dix posts, et `month.short` le dit déjà mieux.
   */
  it("un mois de cinq posts n'est pas jugé sur son mélange", () => {
    expect(names(checkMix(["carousel", "cycle", "single_statement", "cycle", "cycle"])))
      .not.toContain("mix.carousel");
  });

  /*
   * ⚠ LE MOIS LIVRÉ LE 2026-09-23 EN PORTAIT QUATRE, et c'est le premier qui
   * en portait. Les trois d'avant en avaient zéro.
   */
  it("le mois d'odile passe ce plancher", () => {
    const posts = JSON.parse(readFileSync("lib/content/__tests__/fixtures/month-odile.json", "utf8"));
    expect(names(checkMix(posts.map((p: { archetype: string }) => p.archetype))))
      .not.toContain("mix.carousel");
  });
});

/*
 * ⚠ ET LE SÉLECTEUR NE BOUCLE PAS SUR UN CONSTAT QU'IL NE PEUT PAS RÉPARER.
 * `mix.carousel` dit qu'il MANQUE un format, pas qu'un post est de trop : le
 * traiter comme les autres constats de mélange viderait le banc en dégradant
 * le mois à chaque tour, sans jamais ajouter un carrousel.
 */
describe("le sélecteur sait que ce constat-là s'échange autrement", () => {
  const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

  it("il cherche un carrousel au banc plutôt que le premier venu", () => {
    expect(SOURCE).toContain('if (finding.check === "mix.carousel") {');
    expect(SOURCE).toContain('bench.findIndex((p) => p.composeArchetype === "carousel")');
  });

  it("sans carrousel au banc, il refuse tout de suite", () => {
    const at = SOURCE.indexOf('if (finding.check === "mix.carousel") {');
    const block = SOURCE.slice(at, at + 700);
    expect(block).toContain("if (spare === -1) return { chosen, remaining: findings, dropped };");
  });
});
