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
   * ── F25 : le livre voit les deux chemins ──────────────────────────────
   *
   * Le premier correctif réservait un crédit par candidat sur les deux
   * branches, et il était faux : à soixante-douze candidats pour un quota de
   * trente, le lot n'en portait que vingt-neuf et le banc ne pouvait pas
   * exister. La phase de candidature est un frais général ; le crédit se
   * prend à l'écriture. `the-quota-holds-on-both-paths` tient le détail.
   */
  it("la phase de candidature entre au livre avant la première dépense", () => {
    const reserveAt = MONTH.indexOf("const phaseReservation = await credits.reserve({");
    expect(reserveAt).toBeGreaterThan(-1);
    expect(reserveAt).toBeLessThan(MONTH.indexOf("client.messages.batches.create"));
  });

  it("le quota est consulté à l'écriture, sur les deux chemins", () => {
    const writeLoop = MONTH.slice(
      MONTH.indexOf("for (const [index, post] of selection.chosen.entries())"),
      MONTH.indexOf("clearJournal(journal);")
    );
    expect(writeLoop).toContain("await reserve(`month ${MONTH}");
    expect(writeLoop).toContain("funnel.quotaRefusals += 1;");
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
    /*
     * ⚠ ANCRÉ SUR L'APPEL, PAS SUR SA MISE EN FORME. La version précédente
     * cherchait « const violations = checkEthics(scanned).violations; » en
     * toutes lettres : ajouter un argument à l'appel faisait tomber un test qui
     * ne parle pas des arguments.
     */
    const at = MONTH.search(/const violations = checkEthics\(\s*scanned/);
    expect(at).toBeGreaterThan(-1);
    const block = MONTH.slice(at, at + 1400);
    expect(block).toContain("if (violations.length > 0) {");
    expect(block).toContain("continue;");
  });

  /*
   * ── ⚠ LE SCAN LIT LES QUATRE COLONNES QUE LA GÂCHETTE LIT ─────────────
   *
   * `content_items_ethics_gate` lit `title, caption, on_image_text, alt_text`,
   * et `content_items_payload_ethics_gate` descend dans le payload. Le scan du
   * harnais n'en voyait que trois plus le payload : `on_image_text` — le
   * crochet du sujet — n'était lu par personne côté code, et un refus sur cette
   * colonne arrive à l'`insert`, donc après la dépense.
   *
   * La liste vit en toutes lettres des deux côtés, comme celle de
   * `lib/ethics/__tests__/parity.test.ts` : le fichier à contrôler est dans
   * l'autre dépôt, et une liste qui se lit elle-même ne contrôle rien.
   *   eklio-backend/supabase/migrations — `*_ethics_gate`
   */
  it("le scan déontologique lit toutes les colonnes de la gâchette", () => {
    const at = MONTH.indexOf("const scanned = [");
    expect(at).toBeGreaterThan(-1);
    const array = MONTH.slice(at, MONTH.indexOf("].join(", at));
    for (const surface of ["cardLine", "result.caption", "result.altText", "candidate.topic.hook", "result.payload"]) {
      expect(array, `${surface} est hors du scan déontologique`).toContain(surface);
    }
  });

  /*
   * ⚠ ET IL LIT COMME LA BASE LIT — GARANTI AILLEURS, DÉSORMAIS.
   *
   * Entre le 24 et le 26 septembre, cet endroit vérifiait que le scan passait
   * `reading: "as-database"` : la gâchette n'exemptait pas les mentions
   * prohibitives, le code si, et il fallait forcer la lecture stricte pour ne
   * pas payer un mois refusé à l'`insert`. F38 a aligné la base sur le motif du
   * code ; l'option n'existe plus, et la parité de comportement est tenue par
   * une paire de tests jumeaux qui écrivent les mêmes phrases des deux côtés :
   *
   *   lib/ethics/__tests__/immediate-negation.test.ts
   *   eklio-backend/supabase/tests/20260926090000_immediate_negation.test.sql
   *
   * Ce qui reste à vérifier ICI est la SURFACE — quelles colonnes le scan
   * lit — et c'est le test au-dessus qui le fait.
   */
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

/*
 * ── ⚠ LE CRÉDIT SE CONSOMME À LA LIVRAISON, PAS À L'INSERTION ──────────
 *
 * Mesuré le 2026-09-24 : dix mois refusés, dix mois abandonnés — sujets
 * rendus, posts supprimés — et le deuxième essai sur les mêmes comptes n'a pu
 * réserver que DEUX candidats sur soixante-douze. `credit_balances` disait
 * `post_generation consumed = 29` sur 30, pour un mois dont plus aucun post
 * n'existait.
 *
 * Le crédit était soldé à `true` dans la boucle d'écriture, donc AVANT le
 * verdict. En production, une praticienne dont le mois échoue ses contrôles
 * paierait deux fois pour en obtenir un, et après deux refus son mois ne
 * serait plus achetable du tout.
 *
 * ⚠ ET LA RÉPONSE N'EST PAS UN REMBOURSEMENT. Le livre impose une seule issue
 * par réservation — `credit_ledger_one_outcome_per_reservation` — et cette
 * contrainte est juste. Une fonction de remboursement a été écrite, puis
 * retirée quand l'index l'a refusée : c'est l'index qui avait raison. Même
 * règle que le journal, qui ne s'efface qu'une fois le mois en base.
 */
describe("un mois refusé ne consomme pas ses crédits", () => {
  it("le règlement vient après le verdict, pas dans la boucle d'écriture", () => {
    const insertLoop = MONTH.indexOf("written += 1;");
    const verdict = MONTH.indexOf("const monthPasses = selection.remaining.length === 0;");
    expect(verdict, "le verdict ne décide pas des crédits").toBeGreaterThan(-1);
    expect(insertLoop).toBeLessThan(verdict);
  });

  it("le verdict est ce qui décide `succeeded`", () => {
    const at = MONTH.indexOf("const monthPasses = selection.remaining.length === 0;");
    const block = MONTH.slice(at, at + 400);
    expect(block).toContain("for (const candidate of delivered)");
    expect(block).toContain("monthPasses");
  });

  /* Et rien ne solde plus à `true` en dur pendant l'écriture. */
  it("aucun règlement inconditionnel ne subsiste dans la boucle", () => {
    const start = MONTH.indexOf("for (const [index, post] of selection.chosen.entries())");
    const end = MONTH.indexOf("clearJournal(journal);", start);
    expect(MONTH.slice(start, end)).not.toContain("syncCostUsd(candidate.usage), true)");
  });
});
