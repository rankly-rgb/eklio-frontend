import { describe, expect, it } from "vitest";
import {
  contrastSummary,
  hasUnfixableFailure,
  isBelowAa,
  nextPairToFix,
  pairReading,
} from "@/lib/site/contrast";
import { CONTRAST_PAIR_IDS } from "@/lib/site/types";
import { CLAY_AND_SAND, clayAndSand } from "@/lib/site/__tests__/envelope.fixture";
import type { ContrastPair, ContrastReport } from "@/lib/site/types";

/*
 * Le rapport de contraste — mis en forme, jamais recalculé.
 */

/** L'enveloppe du §2 après un patch qui casse le contraste (§2 du contrat). */
function failing(): ContrastReport {
  return {
    passes_aa: false,
    worst_ratio: 2.8,
    pairs: [
      {
        pair_id: "cta_label_on_primary",
        label: "Button label on your primary color",
        bg: "#B4674A",
        fg: "#FFFFFF",
        ratio: 4.22,
        level: "AA_large",
        suggested_fix: { hex: "#AD6347", token: "primary" },
      },
      {
        pair_id: "dark_neutral_on_paper",
        label: "Body text on the page",
        bg: "#FAF6EE",
        fg: "#2B2A27",
        ratio: 13.31,
        level: "AAA",
        suggested_fix: null,
      },
      {
        pair_id: "primary_on_paper",
        label: "Primary color on the page",
        bg: "#FAF6EE",
        fg: "#B4674A",
        ratio: 3.91,
        level: "AA_large",
        suggested_fix: { hex: "#A35D43", token: "primary" },
      },
      {
        pair_id: "secondary_on_paper",
        label: "Secondary color on the page",
        bg: "#FAF6EE",
        fg: "#C08A3E",
        ratio: 2.8,
        level: "fail",
        suggested_fix: { hex: "#92692F", token: "secondary" },
      },
      {
        pair_id: "accent_on_paper",
        label: "Accent color on the page",
        bg: "#FAF6EE",
        fg: "#6E3320",
        ratio: 9.03,
        level: "AAA",
        suggested_fix: null,
      },
      {
        pair_id: "dark_neutral_on_light_neutral",
        label: "Body text on a tinted section",
        bg: "#F4EEE3",
        fg: "#2B2A27",
        ratio: 12.43,
        level: "AAA",
        suggested_fix: null,
      },
      {
        pair_id: "paper_on_dark_neutral",
        label: "Light text on a dark section",
        bg: "#2B2A27",
        fg: "#FAF6EE",
        ratio: 13.31,
        level: "AAA",
        suggested_fix: null,
      },
    ],
  };
}

describe("les sept paires, toujours les sept", () => {
  it("arrivent dans l'ordre du contrat", () => {
    expect(CLAY_AND_SAND.contrast.pairs.map((pair) => pair.pair_id)).toEqual([
      ...CONTRAST_PAIR_IDS,
    ]);
  });

  it("trois d'entre elles mesurent une VARIANTE, pas la couleur de marque", () => {
    const { pairs } = CLAY_AND_SAND.contrast;
    const { tokens } = CLAY_AND_SAND.preview;
    const fg = (id: string) => pairs.find((pair) => pair.pair_id === id)!.fg;

    expect(fg("primary_on_paper")).toBe(tokens.primary_text);
    expect(fg("secondary_on_paper")).toBe(tokens.secondary_text);
    expect(fg("accent_on_paper")).toBe(tokens.accent_text);

    // `cta_label_on_primary` est délibérément différente : c'est un libellé
    // sur un APLAT, et l'aplat est la couleur de marque.
    expect(fg("cta_label_on_primary")).toBe(tokens.cta_ink);
  });

  it("aucun `suggested_fix.token` n'est une surface ni une variante", () => {
    for (const pair of failing().pairs) {
      if (!pair.suggested_fix) continue;
      expect(["primary", "secondary", "accent", "dark_neutral"]).toContain(
        pair.suggested_fix.token
      );
    }
  });
});

describe("la pastille de résumé", () => {
  it("dit le pire ratio quand tout passe", () => {
    expect(contrastSummary(CLAY_AND_SAND.contrast)).toEqual({
      passes: true,
      label: "AA verified — 4.51:1",
      failing: 0,
    });
  });

  it("compte les paires en dessous d'AA quand ça ne passe pas", () => {
    // 4.22, 3.91 et 2.80 : trois paires sous 4.5, dont deux `AA_large`.
    expect(contrastSummary(failing())).toEqual({
      passes: false,
      label: "3 pairs below AA",
      failing: 3,
    });
  });

  it("accorde le singulier", () => {
    const one = failing();
    one.pairs[0].ratio = 5.2;
    one.pairs[0].level = "AA";
    one.pairs[2].ratio = 4.8;
    one.pairs[2].level = "AA";
    expect(contrastSummary(one).label).toBe("1 pair below AA");
  });
});

describe("`AA_large` est un échec ici", () => {
  it("parce que ces sept paires mesurent du texte courant", () => {
    const pair = failing().pairs[0];
    expect(pair.level).toBe("AA_large");
    expect(isBelowAa(pair)).toBe(true);
    // Et le contrat lui donne bien un correctif : la cible est 4.5, pas 3.
    expect(pair.suggested_fix).not.toBeNull();
  });
});

describe("la séquence « tout corriger »", () => {
  it("prend la PIRE paire qui propose un correctif", () => {
    // Le pire est mesuré : sur CLAY & SAND, `secondary_on_paper` d'abord finit
    // en deux écritures ; l'ordre inverse en gaspille une.
    expect(nextPairToFix(failing())?.pair_id).toBe("secondary_on_paper");
  });

  it("ignore une paire pire mais sans correctif", () => {
    const report = failing();
    report.pairs[3].suggested_fix = null;
    expect(nextPairToFix(report)?.pair_id).toBe("primary_on_paper");
  });

  it("s'arrête quand tout passe", () => {
    expect(nextPairToFix(CLAY_AND_SAND.contrast)).toBeNull();
  });

  it("signale l'échec que rien ne corrige", () => {
    const report = failing();
    report.pairs[3].suggested_fix = null;
    expect(hasUnfixableFailure(report)).toBe(true);
    expect(hasUnfixableFailure(CLAY_AND_SAND.contrast)).toBe(false);
  });
});

describe("un correctif n'est ni local ni définitif", () => {
  it("deux paires peuvent vouloir le MÊME jeton à deux valeurs", () => {
    const fixes = failing()
      .pairs.filter((pair): pair is ContrastPair & { suggested_fix: NonNullable<ContrastPair["suggested_fix"]> } =>
        pair.suggested_fix !== null
      )
      .filter((pair) => pair.suggested_fix.token === "primary");

    expect(fixes).toHaveLength(2);
    // #AD6347 et #A35D43 : elles ne peuvent pas être appliquées toutes les
    // deux. Appliquer l'une périme la suggestion de l'autre — d'où l'interdit
    // de mettre `suggested_fix` en cache au travers d'une écriture.
    expect(new Set(fixes.map((pair) => pair.suggested_fix.hex)).size).toBe(2);
  });

  it("« tout est réparé » se lit sur passes_aa, jamais sur un appel réussi", () => {
    // Un correctif appliqué avec succès peut laisser deux paires en échec, et
    // même en faire tomber une qui passait.
    const after = clayAndSand();
    after.contrast = failing();
    expect(after.contrast.passes_aa).toBe(false);
  });
});

describe("la ligne d'une paire", () => {
  it("garde les deux décimales de la base", () => {
    expect(pairReading(CLAY_AND_SAND.contrast.pairs[0])).toBe("4.51:1 · AA");
  });

  it("écrit `AA large` en toutes lettres", () => {
    expect(pairReading(failing().pairs[0])).toBe("4.22:1 · AA large");
  });
});
