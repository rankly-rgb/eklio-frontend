import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ── ⚠ LA CLASSE DE DÉFAUTS LA PLUS FRÉQUENTE DE CE DÉPÔT ────────────────
 *
 * Cinq fois en une session, le même défaut sous cinq noms :
 *
 *   F18 — 36 appels payés jetés, comptés dans `failures`, jamais imprimés ;
 *   F19 — les sujets rendus par un bloc placé APRÈS le `throw` du refus ;
 *   F21 — `shortfall` calculé, imprimé, relié à aucun refus ;
 *   F23 — un `batch_id` sauvé sans la liste de sujets qui le rend lisible ;
 *   F25 — `reserve_credit` appelé sur une seule des deux branches.
 *
 * Chaque moitié était juste. Aucune suite ne pouvait le voir, parce qu'un test
 * regarde un module et que le défaut est ENTRE deux.
 *
 * Ce fichier teste la JONCTION, et rien d'autre : toute grandeur qu'un script
 * produit doit être lue par quelqu'un. Il ne dit pas si le chiffre est juste —
 * il dit qu'il va quelque part.
 */
const MONTH = readFileSync("scripts/local-render/20-month.ts", "utf8");

/** Le bloc JSON du rapport final, qui est le consommateur de dernier recours. */
const report = (() => {
  const at = MONTH.lastIndexOf("console.log(JSON.stringify({");
  expect(at, "le rapport final a disparu de 20-month.ts").toBeGreaterThan(-1);
  return MONTH.slice(at, MONTH.indexOf("}, null, 2));", at));
})();

/** Le bloc JSON du rapport de REFUS, qui a le même devoir. */
const refusalReport = (() => {
  const at = MONTH.indexOf('step: "month", refused: true');
  expect(at, "le rapport de refus a disparu").toBeGreaterThan(-1);
  return MONTH.slice(MONTH.lastIndexOf("console.log(JSON.stringify({", at), MONTH.indexOf("}, null, 2));", at));
})();

describe("toute grandeur produite est lue", () => {
  /*
   * ⚠ LES ACCUMULATEURS DE CONSOMMATION SONT TROUVÉS DANS LA SOURCE, PAS
   * LISTÉS ICI. Une liste écrite à la main ne grandit pas quand quelqu'un
   * ajoute un appel payant — et c'est exactement ce qui est arrivé au juge de
   * complétude, ajouté le 24 et absent du rapport jusqu'à ce que ce test
   * existe.
   */
  const accumulators = [...MONTH.matchAll(
    /const (\w*[Uu]sage) = \{ input: 0, output: 0/g
  )].map((m) => m[1]);

  it("le script porte bien des compteurs de consommation", () => {
    expect(accumulators.length).toBeGreaterThanOrEqual(3);
    expect(accumulators).toContain("judgeUsage");
  });

  it.each(["usage", "repairUsage", "judgeUsage", "themesUsage"])(
    "%s est dans le rapport final",
    (name) => {
      expect(report, `${name} est calculé et n'est lu nulle part`).toContain(name);
    }
  );

  it("chaque compteur trouvé dans la source est dans le rapport", () => {
    for (const name of accumulators) {
      expect(report, `${name} est calculé et n'est lu nulle part`).toContain(name);
    }
  });

  /*
   * ⚠ ET DANS LE COÛT, PAS SEULEMENT DANS LE RAPPORT. Un compteur affiché
   * mais absent du total donne un total faux avec l'air d'être complet.
   */
  it.each(["usage", "repairUsage", "judgeUsage", "themesUsage"])(
    "%s entre dans le coût",
    (name) => {
      /*
       * ⚠ LE TOTAL EST EN TROIS MORCEAUX : `batchCost` et `syncCost` roulent
       * déjà `usage`, et `costUsd` additionne le reste. Chercher le nom dans
       * la seule dernière ligne ferait échouer le test sur `usage`, qui est
       * pourtant compté — une fausse alerte est aussi coûteuse qu'un trou.
       */
      const at = MONTH.indexOf("const batchCost = useBatch");
      const block = MONTH.slice(at, MONTH.indexOf("const elapsedSeconds", at));
      expect(block, `${name} n'est pas dans le total`).toContain(name);
    }
  );

  /* Les grandeurs nommées par la demande, une par une. */
  it.each([
    ["shortfall", "ce que la banque n'a pas pu fournir"],
    ["releasedTopics", "les sujets rendus"],
    ["rejectedAsRedundant", "les motifs de refus au tirage"],
    ["failures", "les échecs de génération"],
    ["ethicsFlags", "les violations déontologiques"],
    ["costUsd", "la dépense"],
  ])("%s est lu (%s)", (name) => {
    expect(report).toContain(name);
  });

  /*
   * ⚠ UN MOIS REFUSÉ DOIT DIRE CE QU'IL A COÛTÉ. Il sortait en erreur sans
   * son coût : compter les essais d'un pipeline, c'est compter ce que chacun
   * dépense, et un essai muet ne compte pas.
   */
  it("le rapport de refus porte lui aussi le coût", () => {
    expect(refusalReport).toContain("costUsd");
    expect(refusalReport).toContain("findings");
  });
});

describe("toute grandeur produite est CONSOMMÉE, pas seulement affichée", () => {
  /*
   * ── F21 : « imprimer une grandeur n'est pas la contrôler » ────────────
   *
   * `shortfall` était dans le rapport depuis toujours. Un mois de quinze
   * posts est sorti sans un seul constat.
   */
  it("le nombre de posts est un contrôle, pas une ligne de rapport", () => {
    expect(MONTH).toContain("checkCount(month.posts.length, month.wanted)".replace("month.", "").slice(0, 10));
    expect(readFileSync("lib/content/month-checks.ts", "utf8"))
      .toContain("out.push(...checkCount(month.posts.length, month.wanted));");
  });

  /*
   * ── F19 : les sujets rendus AVANT le refus, jamais après ──────────────
   */
  it("les sujets sont rendus avant le `throw` du refus", () => {
    expect(MONTH.indexOf('untypedTable(db, "topic_assignments").delete()'))
      .toBeLessThan(MONTH.indexOf("if (selection.remaining.length > 0) {"));
  });

  /*
   * ── F25 : le crédit réservé sur LES DEUX branches ─────────────────────
   */
  it("les deux chemins réservent un crédit", () => {
    const sync = MONTH.indexOf("⚠ SÉQUENTIEL, ET C'EST CE QUI REND LE CACHE UTILE");
    const batch = MONTH.indexOf("  if (useBatch) {");
    expect(MONTH.slice(batch, sync)).toContain("await reserve(`month ${MONTH}");
    expect(MONTH.slice(sync)).toContain("await reserve(`month ${MONTH}");
  });

  /*
   * ── F23 : l'identifiant de lot ET sa liste de sujets ──────────────────
   */
  it("le lot est sauvé avec ses sujets", () => {
    expect(MONTH).toContain("rememberBatch(journal, batch.id, asked.map((c) => c.topic.id))");
  });

  /*
   * ── ⚠ UNE VIOLATION DÉONTOLOGIQUE ÉCARTE LE POST ──────────────────────
   *
   * `ethicsFlags` était une ligne de rapport et le post partait quand même.
   * Un catalogue de règles consulté puis ignoré ne vaut pas mieux que pas de
   * catalogue.
   */
  it("une violation déontologique écarte le candidat", () => {
    const at = MONTH.indexOf("const violations = checkEthics(scanned).violations;");
    expect(at).toBeGreaterThan(-1);
    const block = MONTH.slice(at, at + 1400);
    expect(block).toContain("if (violations.length > 0) {");
    expect(block).toContain("continue;");
  });

  it("le scan déontologique lit la ligne de carte", () => {
    expect(MONTH).toContain("const scanned = [cardLine, result.caption");
  });
});

/*
 * ── ⚠ AUCUN CONTRÔLE NE TIRE SA RÉFÉRENCE DE LA SOURCE QU'IL SURVEILLE ──
 *
 * C'est F16, énoncé comme une règle. `checkInventedIdentity` recevait son nom
 * de cabinet et sa liste d'autorisation d'une lecture de brief NON FILTRÉE,
 * c'est-à-dire de la même fuite qu'il devait attraper : il autorisait le nom
 * d'une autre praticienne sur les quinze comptes et aurait signalé le vrai nom
 * de chacune.
 *
 * Les deux contrôles qui prennent une référence la prennent du BRIEF, lu par
 * `project_id`. Le test le lit dans la source parce que c'est une question de
 * câblage, et qu'aucun test unitaire de contrôle ne peut la poser.
 */
describe("aucun contrôle ne se nourrit de ce qu'il surveille", () => {
  const CHECKS = readFileSync("lib/content/month-checks.ts", "utf8");

  it("l'identité surveillée vient du brief, pas du contenu", () => {
    expect(MONTH).toContain('.from("project_briefs")');
    expect(MONTH).toContain('.eq("project_id", projectId)');
    expect(MONTH).toContain("const allowList = identityAllowList(facts);");
    // `facts` est assemblé depuis `brief.*`, jamais depuis un payload.
    const at = MONTH.indexOf("const facts: PractitionerFacts = {");
    const block = MONTH.slice(at, MONTH.indexOf("};", at));
    expect(block).toContain("brief.practice_name");
    expect(block).not.toContain("payload");
  });

  it("les modalités du contrôle de sigle viennent du brief", () => {
    expect(MONTH).toContain("facts.modalities, judged.verdicts");
    expect(CHECKS).toContain("checkAcronym(month.posts, month.modalities ?? [])");
  });

  /*
   * ⚠ ET LE CONTRÔLE DE TEINTES PREND SA RÉFÉRENCE DE LA DIRECTION, pas du
   * SVG qu'il mesure. Les deux viennent de sources différentes, ce qui est
   * exactement la condition.
   */
  it("les teintes se comparent à la direction du kit", () => {
    expect(CHECKS).toContain("checkTints(post.svg, month.direction)");
  });
});
