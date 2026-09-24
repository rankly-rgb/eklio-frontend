import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { checkEthics, hasBlockingViolation } from "@/lib/ethics/rules";

/*
 * ── ⚠ LE RECENSEMENT ÉTAIT VERT ET LES DEUX CÔTÉS NE SE COMPORTAIENT PAS
 *      PAREIL ──────────────────────────────────────────────────────────────
 *
 * `parity.test.ts` compare les NOMS des motifs : dix-neuf ici, dix-neuf en
 * base, mêmes identifiants. Il est juste, et il ne pouvait pas voir le défaut,
 * parce que le défaut n'est pas un motif : c'est une EXEMPTION que le côté TS
 * implémente (`isProhibitiveMention`) et que `public.ethics_patterns` ne
 * connaît pas. Un recensement ne compare pas ce qui n'a pas de nom.
 *
 * `shared-corpus.test.ts` tient les deux côtés sur le comportement — pour les
 * phrases qu'il contient. Aucune ne mettait un terme interdit immédiatement
 * derrière une négation.
 *
 * Le prix, mesuré : le 24 septembre 2026, `sable.ingram` a écrit 29 posts pour
 * 30 retenus. Le trentième portait « guarantee » dans une tournure prohibitive,
 * les trente contrôles du mois l'ont laissé passer, la gâchette l'a refusé à
 * l'`insert`, et le mois entier est tombé sur `month.short`. 0,54 $.
 */

/*
 * Les vingt et une sondes prohibitives, une par motif bloquant, passées aux
 * deux moteurs le 24 septembre 2026. Quatre désaccords, tous dans le même
 * sens : le code laissait passer ce que la base refusait.
 */
const PROHIBITIVE_FRAMES = [
  "There is no guarantee that six weeks will change anything.",
  "Therapy comes without guarantees, and saying otherwise would be a lie.",
  "No guaranteed outcome is on offer here.",
  "Without client reviews, you have to judge the fit yourself.",
] as const;

describe("la lecture « as-database » refuse ce que la gâchette refuse", () => {
  it.each(PROHIBITIVE_FRAMES)("bloque « %s »", (text) => {
    expect(
      hasBlockingViolation(checkEthics(text, { reading: "as-database" }).violations),
      "la base bloque ce texte ; le pipeline doit le bloquer avant de payer"
    ).toBe(true);
  });

  /*
   * ⚠ ET LA LECTURE PAR DÉFAUT NE CHANGE PAS. Elle sert la boîte de saisie de
   * la clinicienne : lui souligner « je ne garantis rien » en rouge serait
   * confondre le socle appliqué avec le socle transgressé.
   */
  it.each(PROHIBITIVE_FRAMES)("laisse passer « %s » en lecture par défaut", (text) => {
    expect(hasBlockingViolation(checkEthics(text).violations)).toBe(false);
  });

  it("les deux lectures se rejoignent sur une vraie violation", () => {
    const text = "Guaranteed relief from anxiety in 6 weeks.";
    for (const reading of ["default", "as-database"] as const) {
      expect(hasBlockingViolation(checkEthics(text, { reading }).violations), reading).toBe(true);
    }
  });
});

/*
 * ── ⚠ ET LE TEST QUI EMPÊCHE UN CHEMIN D'ÉCRITURE DE REPARTIR EN LECTURE
 *      INDULGENTE ─────────────────────────────────────────────────────────
 *
 * Une liste de chemins écrite à la main serait exacte le jour où on l'écrit.
 * Celle-ci est DÉRIVÉE : elle recense tous les appels à `checkEthics` du dépôt
 * et exige de chacun soit la lecture stricte, soit une exemption NOMMÉE avec sa
 * raison. Un appel neuf fait tomber ce test, et quelqu'un doit décider lequel
 * des deux il rejoint.
 */
const EXEMPT: Record<string, string> = {
  "components/kit/check-your-words.tsx":
    "la boîte de saisie de la clinicienne : elle écrit pour elle, pas en base, et « je ne garantis rien » doit y passer",
  "lib/site/lovable.ts":
    "scanne un PROMPT assemblé, pas du contenu à enregistrer — le prompt cite les phrases qu'il interdit",
};

function callSites(): Array<{ file: string; line: number; text: string }> {
  const out = execFileSync(
    "grep",
    ["-rn", "checkEthics(", "--include=*.ts", "--include=*.tsx", "lib", "components", "scripts"],
    { encoding: "utf8" }
  );
  return out
    .trim()
    .split("\n")
    .map((row) => {
      const [file, line, ...rest] = row.split(":");
      return { file, line: Number(line), text: rest.join(":") };
    })
    .filter(
      (site) =>
        !site.file.includes("__tests__") &&
        site.file !== "lib/ethics/rules.ts" &&
        // ⚠ UNE MENTION EN COMMENTAIRE N'EST PAS UN APPEL. `claims.ts` cite
        // « checkEthics(text) » dans sa prose d'en-tête, et le recensement la
        // comptait comme un chemin d'écriture en lecture indulgente.
        !/^\s*(?:\*|\/\/|\/\*)/.test(site.text) &&
        /checkEthics\(\s*[A-Za-z[{("']/.test(site.text)
    );
}

describe("tout ce qui écrit lit comme la base", () => {
  const sites = callSites();

  it("le recensement trouve bien les appels", () => {
    expect(sites.length).toBeGreaterThanOrEqual(10);
  });

  it("aucun appel n'est ni strict ni exempté", () => {
    const loose = sites
      .filter((s) => !s.text.includes('reading: "as-database"'))
      .filter((s) => !(s.file in EXEMPT));
    expect(
      loose,
      `appel(s) en lecture indulgente sans raison : ${loose
        .map((s) => `${s.file}:${s.line}`)
        .join(", ")}`
    ).toEqual([]);
  });

  it("chaque exemption dit pourquoi, et porte encore un appel", () => {
    for (const [file, why] of Object.entries(EXEMPT)) {
      expect(sites.map((s) => s.file), `${file} n'appelle plus checkEthics`).toContain(file);
      expect(why.length, file).toBeGreaterThan(40);
    }
  });
});
