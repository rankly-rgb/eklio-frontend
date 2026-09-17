import { describe, expect, it } from "vitest";
import {
  POSITIONING_KINDS,
  compilePattern,
  reviewPositioning,
  type PositioningKind,
} from "@/lib/positioning/review";
import type { PositioningPattern, PositioningRule } from "@/lib/catalog/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * LES CINQ FORMES, ET CE QU'AUCUNE NE SAIT DIRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CE FICHIER NE SONDE AUCUNE RÈGLE DE CONTENU. Les règles vivent en base et
 * ne sont pas écrites — elles viennent. Ce qui est sondé ici est la MÉCANIQUE :
 * que chaque forme détecte ce qu'elle prétend détecter, qu'elle ne détecte pas
 * autre chose, et qu'un motif mal formé remonte au lieu d'être avalé.
 *
 * Les motifs ci-dessous sont des `foo|bar` sans signification produit,
 * délibérément : une sonde qui utiliserait de vraies règles deviendrait fausse
 * le jour où on les change, et mesurerait la donnée au lieu du code.
 */

function regle(id: string, over: Partial<PositioningRule> = {}): PositioningRule {
  return {
    id,
    short_label: `label ${id}`,
    description: `description ${id}`,
    example_weak: "weak",
    example_strong: "strong",
    sort_order: 1,
    active: true,
    is_example: true,
    ...over,
  } as PositioningRule;
}

function motif(over: Partial<PositioningPattern> & { kind: string }): PositioningPattern {
  return {
    id: `p_${over.kind}`,
    rule_id: "r",
    pattern: null,
    secondary_pattern: null,
    window_chars: null,
    min_chars: null,
    max_chars: null,
    severity: "minor",
    sort_order: 1,
    active: true,
    ...over,
  } as PositioningPattern;
}

const R = [regle("r")];
const lire = (texte: string, m: PositioningPattern) => reviewPositioning(texte, R, [m]);

describe("les cinq formes détectent ce qu'elles annoncent", () => {
  it("present — le motif apparaît, et l'extrait cite SES mots", () => {
    const { findings } = lire("I use EMDR with new mothers.", motif({ kind: "present", pattern: "\\yEMDR\\y" }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.excerpt).toBe("EMDR");
    expect(findings[0]!.locus).toBe("the whole text");
  });

  it("present — et ne se déclenche pas quand le motif est absent", () => {
    expect(lire("I work with new mothers.", motif({ kind: "present", pattern: "\\yEMDR\\y" })).findings).toEqual([]);
  });

  it("absent — le motif n'apparaît nulle part", () => {
    const { findings } = lire("I hold a PhD.", motif({ kind: "absent", pattern: "\\y(you|your)\\y" }));
    expect(findings).toHaveLength(1);
    /*
     * ⚠ L'ASSERTION QUI COMPTE DANS TOUT CE FICHIER. Un constat déontologique
     * cite toujours les mots fautifs. Une ABSENCE n'a aucun mot à citer, et un
     * extrait inventé serait un mensonge poli. `null`, et `locus` dit ce qui a
     * été regardé.
     */
    expect(findings[0]!.excerpt).toBeNull();
  });

  it("absent — et se tait quand le motif est là", () => {
    expect(lire("You are not sleeping.", motif({ kind: "absent", pattern: "\\y(you|your)\\y" })).findings).toEqual([]);
  });

  it("absent_in_opening — présent plus loin ne compte pas", () => {
    const texte = "I hold a PhD from Berkeley. ".padEnd(340, "x") + " And you are not sleeping.";
    const { findings } = lire(
      texte,
      motif({ kind: "absent_in_opening", pattern: "\\y(you|your)\\y", window_chars: 320 })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.excerpt).toBeNull();
    expect(findings[0]!.locus).toBe("the first 320 characters");
  });

  it("absent_in_opening — et se tait quand c'est dans la fenêtre", () => {
    const { findings } = lire(
      "You are not sleeping, and I hold a PhD.",
      motif({ kind: "absent_in_opening", pattern: "\\y(you|your)\\y", window_chars: 320 })
    );
    expect(findings).toEqual([]);
  });

  it("present_without — A sans B", () => {
    const m = motif({ kind: "present_without", pattern: "\\yEMDR\\y", secondary_pattern: "\\ysleep\\y" });
    expect(lire("I use EMDR.", m).findings).toHaveLength(1);
    expect(lire("I use EMDR when you cannot sleep.", m).findings).toEqual([]);
    expect(lire("You cannot sleep.", m).findings).toEqual([]);
  });

  it("length — sous le minimum et au-dessus du maximum, pas entre", () => {
    const m = motif({ kind: "length", min_chars: 40, max_chars: 700 });
    expect(lire("too short", m).findings).toHaveLength(1);
    expect(lire("x".repeat(701), m).findings).toHaveLength(1);
    expect(lire("x".repeat(200), m).findings).toEqual([]);
  });

  it("length — le locus dit le nombre mesuré, pas une borne", () => {
    const { findings } = lire("x".repeat(900), motif({ kind: "length", max_chars: 700 }));
    expect(findings[0]!.locus).toBe("900 characters");
  });

  /*
   * ⚠ LA GARDE D'EXHAUSTIVITÉ. Les huit sondes ci-dessus couvrent cinq formes.
   * Une SIXIÈME ajoutée à `POSITIONING_KINDS` sans sonde ferait passer cette
   * suite au vert en ne testant rien de nouveau.
   */
  it("⚠ et les cinq formes sondées sont exactement celles qui existent", () => {
    const sondees: PositioningKind[] = [
      "present",
      "absent",
      "absent_in_opening",
      "present_without",
      "length",
    ];
    expect([...POSITIONING_KINDS].sort()).toEqual([...sondees].sort());
  });
});

describe("un motif que le lecteur ne sait pas appliquer REMONTE", () => {
  it("une regex invalide n'est pas avalée", () => {
    const { findings, unusable } = lire("anything", motif({ kind: "present", pattern: "(" }));
    expect(findings).toEqual([]);
    expect(unusable).toHaveLength(1);
    expect(unusable[0]!.patternId).toBe("p_present");
  });

  it("⚠ un échappement POSIX sans équivalent JS est refusé, pas traduit à peu près", () => {
    for (const source of ["\\mword", "word\\M", "\\Astart", "end\\Z"]) {
      expect(typeof compilePattern(source)).toBe("string");
    }
  });

  it("⚠ mais \\y EST traduit — sinon le motif ne correspondrait jamais à rien", () => {
    const re = compilePattern("\\yEMDR\\y");
    expect(re).toBeInstanceOf(RegExp);
    expect((re as RegExp).test("I use EMDR daily")).toBe(true);
    expect((re as RegExp).test("EMDRish")).toBe(false);
  });

  it("une forme inconnue remonte au lieu de se taire", () => {
    const { unusable } = lire("anything", motif({ kind: "vibes", pattern: "x" }));
    expect(unusable[0]!.reason).toMatch(/unknown kind/);
  });
});

describe("les deux familles ne se mélangent pas", () => {
  it("la sévérité rendue est celle du positionnement, jamais celle de la déontologie", () => {
    const { findings } = lire(
      "I use EMDR.",
      motif({ kind: "present", pattern: "\\yEMDR\\y", severity: "costly" })
    );
    expect(findings[0]!.severity).toBe("costly");
    expect(["block", "warn"]).not.toContain(findings[0]!.severity);
  });

  it("⚠ aucun constat de positionnement ne porte de champ de blocage", () => {
    const { findings } = lire("I use EMDR.", motif({ kind: "present", pattern: "\\yEMDR\\y" }));
    expect(Object.keys(findings[0]!).sort()).toEqual(
      [
        "description",
        "excerpt",
        "exampleStrong",
        "exampleWeak",
        "label",
        "locus",
        "patternId",
        "ruleId",
        "severity",
      ].sort()
    );
  });
});

describe("ce qui désactive un constat", () => {
  it("une règle inactive éteint ses motifs — une seule chose à basculer", () => {
    const { findings } = reviewPositioning(
      "I use EMDR.",
      [regle("r", { active: false })],
      [motif({ kind: "present", pattern: "\\yEMDR\\y" })]
    );
    expect(findings).toEqual([]);
  });

  it("un motif inactif se tait, sans toucher aux autres", () => {
    const { findings } = reviewPositioning(
      "I use EMDR.",
      R,
      [
        motif({ id: "off", kind: "present", pattern: "\\yEMDR\\y", active: false }),
        motif({ id: "on", kind: "present", pattern: "\\yEMDR\\y" }),
      ]
    );
    expect(findings.map((f) => f.patternId)).toEqual(["on"]);
  });

  it("aucune règle, aucun motif : aucun constat, et aucune erreur", () => {
    expect(reviewPositioning("anything at all", [], [])).toEqual({ findings: [], unusable: [] });
  });
});
