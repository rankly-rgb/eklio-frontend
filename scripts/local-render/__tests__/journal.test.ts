import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import {
  loadJournal, saveJournal, rememberBatch, rememberResult, clearJournal,
} from "@/scripts/local-render/journal";

/*
 * ── CE QU'UNE PANNE A LE DROIT DE COÛTER ────────────────────────────────
 *
 * ⚠ 0,81 $ D'APPELS DÉJÀ PAYÉS ONT ÉTÉ JETÉS le 2026-09-23 : le remplissage
 * de banque accumulait 695 réponses et insérait à la fin ; PostgreSQL est
 * tombé au 280ᵉ appel. Le même défaut existait deux fois de plus dans la
 * génération mensuelle, et le pire n'était pas les résultats — c'était
 * l'IDENTIFIANT DU LOT, qui ne vivait que dans une ligne de log.
 *
 * Un lot Batch est facturé à la soumission. Sans son identifiant, un
 * processus qui meurt pendant les vingt-cinq minutes d'attente ne peut même
 * pas aller chercher ce qu'il a payé : il faut re-soumettre, et repayer.
 */

const MONTH = "2026-11-01";
const EMAIL = "journal-test@eklio-test.invalid";
const FILE = `.eklio-journal/${MONTH}-${EMAIL.replace(/[^a-z0-9]+/gi, "-")}.json`;

beforeEach(() => { if (existsSync(FILE)) rmSync(FILE); });
afterEach(() => { if (existsSync(FILE)) rmSync(FILE); });

const usage = { input: 10, output: 20, cacheRead: 0, cacheWrite: 0 };

describe("le journal survit à l'interruption", () => {
  it("un mois jamais commencé s'ouvre vide, sans échouer", () => {
    const j = loadJournal(MONTH, EMAIL);
    expect(j.batchId).toBeNull();
    expect(Object.keys(j.entries)).toEqual([]);
  });

  /*
   * ⚠ LE CAS QUI COMPTE. Entre `batches.create` et la première réponse il se
   * passe une demi-heure. Si l'identifiant n'est pas écrit AVANT cette
   * attente, il n'est écrit jamais.
   */
  it("l'identifiant du lot est relisible dès qu'il existe", () => {
    rememberBatch(loadJournal(MONTH, EMAIL), "msgbatch_01abc", ["topic-1", "topic-2"]);
    expect(loadJournal(MONTH, EMAIL).batchId).toBe("msgbatch_01abc");
  });

  it("chaque résultat est relisible sans attendre les suivants", () => {
    rememberResult(loadJournal(MONTH, EMAIL), "topic-1", { result: { ok: true }, usage, settled: false });
    // Une panne ici : un second processus relit ce qui a été payé.
    const reread = loadJournal(MONTH, EMAIL);
    expect(reread.entries["topic-1"].result).toEqual({ ok: true });
    expect(reread.entries["topic-1"].usage).toEqual(usage);
  });

  /*
   * ⚠ SANS LE DRAPEAU `settled`, UNE REPRISE FACTURE DEUX FOIS. Le premier
   * passage a réservé puis soldé un crédit ; le second, reprenant le même
   * résultat, en consommerait un autre pour un post déjà payé.
   */
  it("un crédit déjà soldé est marqué, et ne se solde pas deux fois", () => {
    const first = rememberResult(loadJournal(MONTH, EMAIL), "topic-1", { result: { ok: true }, usage, settled: false });
    rememberResult(first, "topic-1", { ...first.entries["topic-1"], settled: true });
    expect(loadJournal(MONTH, EMAIL).entries["topic-1"].settled).toBe(true);
  });

  it("un journal illisible s'ouvre vide plutôt que de bloquer le mois", () => {
    saveJournal({ month: MONTH, email: EMAIL, batchId: null, topicIds: [], entries: {} });
    // Corrompu à la main, comme une écriture interrompue le ferait.
    writeFileSync(FILE, "{ pas du json", "utf8");
    const j = loadJournal(MONTH, EMAIL);
    expect(j.entries).toEqual({});
    expect(j.batchId).toBeNull();
  });

  /*
   * ⚠ IL S'EFFACE QUAND LE MOIS EST EN BASE, PAS AVANT. Tant que
   * `content_items` ne porte pas les trente posts, le travail payé n'existe
   * que dans le journal.
   */
  it("publier efface le journal", () => {
    let j = loadJournal(MONTH, EMAIL);
    j = rememberBatch(j, "msgbatch_01abc", ["topic-1"]);
    j = rememberResult(j, "topic-1", { result: { ok: true }, usage, settled: true });
    clearJournal(j);
    const after = loadJournal(MONTH, EMAIL);
    expect(after.batchId).toBeNull();
    expect(Object.keys(after.entries)).toEqual([]);
  });
});

/*
 * ── ⚠ UN IDENTIFIANT DE LOT SANS SA LISTE DE SUJETS NE SE REPREND PAS ──
 *
 * Rencontré en vrai le 2026-09-23, pas imaginé. Une commande interrompue a
 * laissé un lot soumis — donc PAYÉ — et la reprise l'a bien rattaché… puis a
 * REFAIT SON TIRAGE. Les deux ensembles se sont trouvés identiques et le mois
 * est passé, parce que `next_topic_for_kit` trie par `created_at desc, id` :
 * deux tirages consécutifs sur la même banque rendent la même chose.
 *
 * ⚠ C'EST UNE COÏNCIDENCE D'ORDONNANCEMENT, PAS UNE GARANTIE. Un sujet
 * ajouté, expiré ou pris par une autre praticienne entre les deux, et la
 * reprise aurait payé un lot dont elle ne savait plus lire les réponses.
 *
 * La liste part donc dans la MÊME écriture que l'identifiant.
 */
describe("le lot se reprend avec ses sujets", () => {
  it("les sujets sont écrits avec l'identifiant, pas après", () => {
    rememberBatch(loadJournal(MONTH, EMAIL), "msgbatch_01xyz", ["a", "b", "c"]);
    const reread = loadJournal(MONTH, EMAIL);
    expect(reread.batchId).toBe("msgbatch_01xyz");
    expect(reread.topicIds).toEqual(["a", "b", "c"]);
  });

  it("un journal effacé ne garde ni l'un ni l'autre", () => {
    clearJournal(rememberBatch(loadJournal(MONTH, EMAIL), "msgbatch_01xyz", ["a"]));
    const reread = loadJournal(MONTH, EMAIL);
    expect(reread.batchId).toBeNull();
    expect(reread.topicIds).toEqual([]);
  });

  /*
   * ⚠ UN JOURNAL ÉCRIT AVANT QUE `topicIds` N'EXISTE SE RELIT SANS LEVER. Le
   * refuser rendrait illisible un lot déjà payé, ce qui est exactement le
   * défaut que ce fichier existe pour empêcher.
   */
  it("un journal d'avant la liste se relit avec une liste vide", () => {
    writeFileSync(FILE, JSON.stringify({
      month: MONTH, email: EMAIL, batchId: "msgbatch_ancien", entries: {},
    }), "utf8");
    const reread = loadJournal(MONTH, EMAIL);
    expect(reread.batchId).toBe("msgbatch_ancien");
    expect(reread.topicIds).toEqual([]);
  });
});

/*
 * ⚠ ET LA REPRISE REND LE TIRAGE FRAIS PLUTÔT QUE DE L'AJOUTER. Sans ça, une
 * reprise doublerait les sujets sortis de la banque à chaque tentative.
 */
describe("la reprise fait foi du lot, pas du tirage", () => {
  const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

  it("les sujets hors du lot sont rendus", () => {
    expect(SOURCE).toContain("const ofBatch = new Set(journal.topicIds);");
    expect(SOURCE).toContain("sujets du tirage frais rendus");
  });

  it("un sujet du lot devenu intirable arrête la reprise plutôt que de la fausser", () => {
    expect(SOURCE).toContain("reprise impossible :");
    expect(SOURCE).toContain("c'est une décision, pas un nettoyage");
  });
});
