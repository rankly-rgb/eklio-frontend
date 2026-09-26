import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ── ⚠ NEUF CENT QUINZE SUJETS ÉTAIENT TENUS POUR RIEN ──────────────────
 *
 * Mesuré le 2026-09-24 : vingt-quatre kits orphelins retenaient 858 sujets sur
 * 2026-11, plus 57 sur 2026-10. Le résidu de toutes les exécutions
 * interrompues — un run tué, un lot en erreur, une session coupée — et la
 * fenêtre anti-collision les retirait à TOUT LE SEGMENT pendant quatre-vingt-
 * dix jours, pour des posts que personne n'a jamais écrits.
 *
 * ⚠ ET ON S'APPRÊTAIT À RACHETER CE QU'ON POSSÉDAIT DÉJÀ. Le dimensionnement
 * de F13 compte ce qu'un essai CONSOMME et suppose que le reste revient. Ça ne
 * revient que si quelqu'un le rend.
 */
const MONTH = readFileSync("scripts/local-render/20-month.ts", "utf8");
const MIGRATION = readFileSync(
  "../eklio-backend/supabase/migrations/20260924140000_an_assignment_that_delivered_nothing_is_not_held.sql",
  "utf8"
);

describe("le tirage cesse de voir ce qui n'a rien livré", () => {
  /*
   * ⚠ C'EST LE VERROU QUI TIENT TOUT SEUL. Même si personne n'efface rien, une
   * assignation sans post et hors délai ne bloque plus le segment.
   */
  it("une assignation retient si elle a livré, ou si elle est encore en vol", () => {
    expect(MIGRATION).toContain("create or replace function public.topic_assignment_holds(");
    expect(MIGRATION).toContain("p_assigned_at > now() - public.topic_assignment_grace()");
    expect(MIGRATION).toContain("from public.content_items ci");
  });

  /*
   * ⚠ LE DÉLAI DOIT EXCÉDER UNE GÉNÉRATION ENTIÈRE. Un lot met vingt-cinq à
   * trente minutes, le harnais abandonne à quatre-vingt-dix : trois heures
   * laissent une génération légitime finir sans se faire voler ses sujets.
   */
  it("le délai de grâce est plus long que la borne d'attente d'un lot", () => {
    expect(MIGRATION).toContain("select interval '3 hours'");
    expect(MONTH).toContain("const BATCH_DEADLINE_MS = 90 * 60 * 1000;");
  });

  /* ⚠ Les deux côtés : les consœurs, et le kit lui-même. */
  it("ni une consœur ni l'essai précédent du kit ne retiennent pour rien", () => {
    const blocked = MIGRATION.slice(MIGRATION.indexOf("blocked as materialized"), MIGRATION.indexOf("mine as materialized"));
    const mine = MIGRATION.slice(MIGRATION.indexOf("mine as materialized"), MIGRATION.indexOf("select t.id, t.archetype_key"));
    expect(blocked).toContain("public.topic_assignment_holds(");
    expect(mine).toContain("public.topic_assignment_holds(");
  });

  /*
   * ⚠ UNE SEULE DÉFINITION. `next_topic_for_kit` est un `limit 1` sur cette
   * liste et `drawable_count_for_kit` un `group by` : le filtre vaut pour les
   * trois d'un coup, et aucune ne peut répondre autrement.
   */
  it("le filtre est posé dans la source unique du tirage", () => {
    expect(MIGRATION).toContain("create or replace function public.drawable_topics_for_kit(");
  });
});

describe("le balai rend le nombre visible", () => {
  it("il existe, et il rend combien il a libéré", () => {
    expect(MIGRATION).toContain("create or replace function public.release_stale_topic_assignments()");
    expect(MIGRATION).toContain("returns integer");
  });

  /*
   * ⚠ AU DÉMARRAGE D'UNE GÉNÉRATION, AVANT DE COMPTER. Compter d'abord
   * aurait vu la banque basse et déclenché un remplissage — c'est-à-dire
   * racheter ce qu'on possédait déjà.
   */
  it("la génération l'appelle avant de compter le stock", () => {
    const sweep = MONTH.indexOf('"release_stale_topic_assignments"');
    const count = MONTH.indexOf('"drawable_count_for_kit"');
    expect(sweep).toBeGreaterThan(-1);
    expect(sweep).toBeLessThan(count);
  });

  /*
   * ⚠ ET IL LE DIT. Sans la ligne, la banque « se répare » en silence et
   * personne n'apprend qu'un run a été tué.
   */
  it("il le dit quand il a libéré quelque chose", () => {
    expect(MONTH).toContain("assignations rendues — des exécutions qui n'ont rien livré");
  });

  /*
   * ⚠ ET UNE PANNE DU BALAI ARRÊTE LA GÉNÉRATION : elle tirerait faux.
   *
   * Le message nommait `sweepError` ; l'appel est passé dans le port injecté de
   * `guardBank` et la variable a changé de nom. Ce qui compte n'est pas le nom
   * mais le fait que l'erreur soit RELEVÉE et non journalisée.
   */
  it("son échec n'est pas avalé", () => {
    const port = MONTH.slice(
      MONTH.indexOf("async releaseStale()"),
      MONTH.indexOf("async drawableCounts(")
    );
    expect(port, "le port de libération a disparu").not.toBe("");
    expect(port).toContain("throw new Error(`release_stale_topic_assignments:");
  });
});

describe("la migration se prouve elle-même", () => {
  /*
   * Sans ce bloc, le fichier n'affirmerait la libération que par sa mise en
   * page. Il fabrique une assignation, la vieillit, et vérifie les trois
   * états.
   */
  it("elle vérifie qu'une assignation fraîche retient", () => {
    expect(MIGRATION).toContain("une assignation fraîche devrait retenir");
  });

  it("elle vérifie qu'une périmée et vide libère", () => {
    expect(MIGRATION).toContain("une assignation périmée et vide devrait libérer");
  });

  it("elle vérifie que le balai l'efface", () => {
    expect(MIGRATION).toContain("le balai a laissé l''assignation périmée en place");
  });
});
