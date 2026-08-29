import { describe, expect, it } from "vitest";
import {
  contrastSummary,
  fixAllReport,
  hasUnfixableFailure,
  isBelowAa,
  levelWord,
  nextPairToFix,
  pairNote,
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

describe("sous 4.5, on signale — y compris `AA_large`", () => {
  it("parce que SIX des sept paires mesurent du texte courant", () => {
    const pair = failing().pairs[2]; // primary_on_paper
    expect(pair.level).toBe("AA_large");
    expect(isBelowAa(pair)).toBe(true);
    // Et le contrat lui donne bien un correctif : la cible est 4.5, pas 3.
    expect(pair.suggested_fix).not.toBeNull();
    expect(levelWord(pair)).toBe("AA large");
  });

  it("la septième est un libellé de BOUTON, et ne doit pas lire « fail »", () => {
    /*
     * `cta_label_on_primary` mesure un libellé sur un aplat, et la sortie
     * imprime pour lui un plancher de taille explicite. La règle stricte
     * reste — la paire est signalée et le correctif proposé — mais le mot
     * change : elle ne peut pas lire « fail » à propos de quelque chose qui
     * passe à la taille où c'est imprimé.
     */
    const cta = failing().pairs[0];
    expect(cta.pair_id).toBe("cta_label_on_primary");
    expect(isBelowAa(cta)).toBe(true);
    expect(levelWord(cta)).toBe("below AA");
    expect(levelWord(cta)).not.toBe("fail");
    expect(cta.suggested_fix).not.toBeNull();
  });

  it("elle est la SEULE à porter cette note, et seulement en échec", () => {
    const report = failing();
    const cta = report.pairs[0];

    expect(pairNote(cta)).toContain("18px bold");
    expect(pairNote(cta)).toContain("comfortable to read, not compliant");
    // Pas de chiffre de norme dans la note : le plancher imprimé est 18px gras
    // et le seuil « grand texte » de WCAG est 18.66px gras. Affirmer la
    // conformité à 18px serait faux de 0,66px.
    expect(pairNote(cta)).not.toContain("WCAG");

    for (const pair of report.pairs.slice(1)) {
      expect(pairNote(pair)).toBeNull();
    }
    // Et rien quand elle passe.
    expect(pairNote(CLAY_AND_SAND.contrast.pairs[0])).toBeNull();
  });

  it("un `fail` de texte courant garde son mot", () => {
    const secondary = failing().pairs[3];
    expect(secondary.level).toBe("fail");
    expect(levelWord(secondary)).toBe("fail");
  });
});

describe("le compte rendu de « Fix them all »", () => {
  it("n'annonce jamais un succès : il lit `passes_aa`", () => {
    const report = fixAllReport(CLAY_AND_SAND.contrast);
    expect(report.done).toBe(true);
    expect(report.message).toBe(
      "All seven pairs reach AA. The closest is now 4.51:1."
    );
  });

  it("NOMME la paire qui résiste quand il en reste une", () => {
    // Les appels ont pu tous réussir et laisser une paire en échec : un
    // correctif déplace un jeton, et toute paire qui le partage bouge avec lui.
    const report = fixAllReport(failing());
    expect(report.done).toBe(false);
    expect(report.message).toContain("3 pairs are still below AA");
    expect(report.message).toContain("Button label on your primary color");
    expect(report.message).toContain("4.22:1");
  });

  it("distingue « recommence » de « rien de plus à appliquer »", () => {
    const stuck = failing();
    for (const pair of stuck.pairs) pair.suggested_fix = null;

    const report = fixAllReport(stuck);
    expect(report.done).toBe(false);
    expect(report.message).toContain("no shade of that color reaches AA");
  });

  it("accorde le singulier", () => {
    const one = failing();
    one.pairs[0].ratio = 5.2;
    one.pairs[0].level = "AA";
    one.pairs[0].suggested_fix = null;
    one.pairs[2].ratio = 4.8;
    one.pairs[2].level = "AA";
    one.pairs[2].suggested_fix = null;

    expect(fixAllReport(one).message).toContain("One pair is still below AA");
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
    expect(pairReading(failing().pairs[2])).toBe("3.91:1 · AA large");
  });

  it("écrit `below AA` sur le libellé du bouton", () => {
    expect(pairReading(failing().pairs[0])).toBe("4.22:1 · below AA");
  });
});
