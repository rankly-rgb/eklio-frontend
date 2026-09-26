import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cachedPrefixText, prefixBaselineMode } from "@/lib/content/generate/copy-batch";
import { MODEL_WRITTEN_ARCHETYPES } from "@/lib/content/generate/copy-batch";

/*
 * ── L'ESSAI QUI SÉPARE LE PORTILLON DES CONSIGNES ───────────────────────
 *
 * Le portillon par post et les trois consignes de classes sont entrés dans le
 * MÊME run du 2026-09-26. Le coût par mois livré est passé de 3,22 $ à 0,574 $
 * et le taux de 2/16 à 2/2 — sans qu'on puisse dire ce que chacun apporte.
 *
 * `CONTENT_PREFIX_BASELINE=1` retire les consignes et garde le portillon : un
 * seul appel sépare les deux causes. Ce fichier tient les trois propriétés qui
 * rendent cet interrupteur sûr — il ne s'active que sur « 1 », le préfixe par
 * défaut porte bien les trois consignes, et le harnais le crie et l'inscrit.
 */

const BRAND = {
  practiceName: "Still Water Counseling",
  voice: "plain, unhurried",
  offLimits: "",
  ethicsRules: [],
} as unknown as Parameters<typeof cachedPrefixText>[0];

/** Une phrase propre à chacune des trois consignes. */
const THREE_CLASSES = {
  "text.unfinished": "EVERY WRITTEN LINE MUST BE FINISHED",
  "text.clinicalClaim": "THE CLINICAL NUANCE APPLIES TO EVERY SURFACE",
  "text.clinicalClaim (contournement F39)": "Not every X is Y",
} as const;

afterEach(() => {
  delete process.env.CONTENT_PREFIX_BASELINE;
});

describe("l'interrupteur ne s'active que sur « 1 »", () => {
  it("absent, il est éteint", () => {
    expect(prefixBaselineMode()).toBe(false);
  });

  it("sur « 1 », il est allumé", () => {
    process.env.CONTENT_PREFIX_BASELINE = "1";
    expect(prefixBaselineMode()).toBe(true);
  });

  /*
   * ⚠ RIEN D'AUTRE NE L'ALLUME. Une variable laissée à « true » ou « 0 » dans un
   * shell ne doit pas retirer des consignes en silence : un mois témoin qui
   * passerait pour un mois de référence ferait partir la mesure suivante d'un
   * chiffre faux.
   */
  it.each(["true", "yes", "0", "", "on", " 1"])("« %s » ne l'allume pas", (value) => {
    process.env.CONTENT_PREFIX_BASELINE = value;
    expect(prefixBaselineMode()).toBe(false);
  });
});

describe("le préfixe par défaut porte les trois consignes", () => {
  it.each(Object.entries(THREE_CLASSES))("%s — « %s »", (_classe, probe) => {
    expect(
      cachedPrefixText(BRAND, "single_statement"),
      "une consigne a disparu du préfixe par défaut"
    ).toContain(probe);
  });

  it("et le mode témoin les retire toutes", () => {
    process.env.CONTENT_PREFIX_BASELINE = "1";
    const baseline = cachedPrefixText(BRAND, "single_statement");
    for (const probe of Object.values(THREE_CLASSES)) {
      expect(baseline, `« ${probe} » survit au mode témoin`).not.toContain(probe);
    }
  });

  /*
   * ⚠ LA RÈGLE DU CARROUSEL N'EST PAS DANS CE BLOC, ET C'EST VOULU. Elle vit
   * dans la FORME du carrousel (`archetypeInstruction`), parce qu'elle ne
   * concerne que cet archétype. Le mode témoin ne la retire donc pas — l'essai
   * de séparation mesure les deux consignes de surface, pas celle-là.
   */
  it("la règle du carrousel survit au mode témoin, et le rapport doit le dire", () => {
    process.env.CONTENT_PREFIX_BASELINE = "1";
    expect(cachedPrefixText(BRAND, "carousel")).toContain("AT MOST ONE panel");
  });

  /*
   * ⚠ ET LE MODE TÉMOIN NE TOUCHE À AUCUNE RÈGLE DÉONTOLOGIQUE DE BASE. Les
   * « NEVER » et le bloc légende restent : ce qui est retiré est ce qui a été
   * AJOUTÉ le 2026-09-26, pas le socle.
   */
  it.each(["NEVER: guarantee an outcome", "ARE PUBLISHED TEXT UNDER HER LICENCE"])(
    "« %s » reste en mode témoin",
    (probe) => {
      process.env.CONTENT_PREFIX_BASELINE = "1";
      expect(cachedPrefixText(BRAND, "single_statement")).toContain(probe);
    }
  );

  it("le retrait est substantiel sur les onze archétypes", () => {
    for (const archetype of MODEL_WRITTEN_ARCHETYPES) {
      const full = cachedPrefixText(BRAND, archetype).length;
      process.env.CONTENT_PREFIX_BASELINE = "1";
      const base = cachedPrefixText(BRAND, archetype).length;
      delete process.env.CONTENT_PREFIX_BASELINE;
      expect(full - base, `${archetype} : le mode témoin ne retire presque rien`).toBeGreaterThan(1500);
    }
  });
});

describe("le harnais crie le mode témoin et l'inscrit", () => {
  const MONTH = readFileSync("scripts/local-render/20-month.ts", "utf8");

  it("il le crie au démarrage", () => {
    expect(MONTH).toContain("MODE TÉMOIN");
    const at = MONTH.indexOf("if (prefixBaselineMode()) {");
    expect(at, "le cri a disparu").toBeGreaterThan(-1);
    /* Avant le tirage, donc avant la moindre dépense. */
    expect(at).toBeLessThan(MONTH.indexOf("candidates drawn for"));
  });

  it("il l'inscrit dans le rapport", () => {
    expect(MONTH).toContain("prefixBaseline: prefixBaselineMode(),");
  });
});
