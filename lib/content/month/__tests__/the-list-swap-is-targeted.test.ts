import { describe, expect, it } from "vitest";
import { listSwap } from "@/lib/content/month/select";
import { checkMix } from "@/lib/content/month-checks";

/*
 * F130 (2026-11-05) : `mix.list` échangé à l'aveugle retirait une phrase. L'échange
 * est ciblé — une liste sort, une phrase entre — et ne brise aucun plancher.
 */
const SIMPLE = ["surface_and_beneath", "comparison_pair", "numbered_strategies", "cycle", "concentric_control"];

describe("l'échange ciblé de mix.list", () => {
  /* 7 phrases seules, 6 carrousels, 1 praticienne, 16 listes : le mois de février 2027. */
  const month = [
    ...Array(7).fill("single_statement"), ...Array(6).fill("carousel"), "practitioner_card",
    ...SIMPLE, ...SIMPLE, "quadrant_model", "quadrant_model", "lettered_technique", "annotated_curve", "cycle", "comparison_pair",
  ];

  it("le mois de février portait mix.list", () => {
    expect(month).toHaveLength(30);
    expect(checkMix(month).map((f) => f.check)).toContain("mix.list");
  });

  it("une liste sort, la première phrase du banc entre — jamais une phrase sortie", () => {
    const bench = ["cycle", "single_statement", "carousel"];
    const pair = listSwap(month, bench)!;
    expect(pair).not.toBeNull();
    const [out, spare] = pair;
    expect(SIMPLE.concat(["quadrant_model", "lettered_technique", "annotated_curve"])).toContain(month[out]);
    expect(bench[spare]).toBe("single_statement");
  });

  it("deux échanges ramènent le mois sous le plafond, sans autre constat de mélange", () => {
    let chosen = [...month];
    const bench = ["single_statement", "single_statement", "carousel", "single_statement"];
    for (let k = 0; k < 2; k += 1) {
      const [out, spare] = listSwap(chosen, bench)!;
      chosen = [...chosen.slice(0, out), ...chosen.slice(out + 1), bench.splice(spare, 1)[0]];
    }
    expect(checkMix(chosen)).toEqual([]);
  });

  it("aucune liste n'est retirable sans briser un plancher : null, plutôt que forcer", () => {
    /* Sept archétypes distincts tout juste, chacun seul ou presque : toute sortie fait tomber `mix.distinct` ou un plancher. */
    const tight = [...Array(10).fill("single_statement"), ...Array(9).fill("carousel"), "practitioner_card", "practitioner_card",
      "surface_and_beneath", "comparison_pair", "numbered_strategies", "cycle", "concentric_control", "quadrant_model", "lettered_technique", "annotated_curve", "annotated_curve"];
    expect(tight).toHaveLength(30);
    /* Le banc n'offre qu'une phrase seule de plus : elle dépasserait son plafond de 35 %. */
    expect(listSwap(tight, ["single_statement"])).toBeNull();
  });
});
