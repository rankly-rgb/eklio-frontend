import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { reviseMonth, revisionOn, type Revisable } from "@/lib/content/generate/revise";

/*
 * ── ⚠ VINGT-TROIS CONTRÔLES, ET L'ÉCRITURE RESTE À 1,6 SUR 5 ───────────
 *
 * Les sept contrôles de F26 ont supprimé les sept défauts qu'ils nomment,
 * exactement, et n'ont pas déplacé la note. Un contrôle refuse, il n'améliore
 * pas. Ce que la notation voit et qu'aucun contrôle ne peut voir :
 *
 *   « Looking stable. Burning »   complète pour le juge, vide pour un lecteur
 *   « Body says no » × 7          le même libellé sur sept cartes du MOIS
 *   trois posts sur la même idée  titres différents, phrase identique
 *
 * Les deux derniers ne se voient que sur le mois entier : un contrôle par
 * post ne peut pas les trouver.
 */

const POSTS: Revisable[] = [
  { archetype: "single_statement", cardLine: "Looking stable. Burning", payload: { statement: "You look fine at work and your body disagrees at home." },
    caption: "A note about what competence hides.", altText: "A card with one sentence." },
  { archetype: "single_statement", cardLine: "Rest is not a reward", payload: { statement: "Rest is not something you earn after everything else is done." },
    caption: "A note about rest.", altText: "A card with one sentence." },
];

/** Un client qui rend ce qu'on lui dit de rendre. */
const clientSaying = (text: string) => ({
  messages: {
    create: async () => ({
      content: [{ type: "text", text }],
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  },
}) as never;

afterEach(() => {
  delete process.env.CONTENT_REVISION;
});

describe("elle peut être éteinte, et c'est ce qui la rend mesurable", () => {
  /*
   * ⚠ SANS CE COMMUTATEUR, SON EFFET SE CONFOND avec celui de Sonnet et celui
   * des exemples. « Trois changements ont fait monter la note » ne dit pas
   * lequel a payé, et on ne saurait pas lequel retirer.
   */
  it("`CONTENT_REVISION=off` n'appelle rien", async () => {
    process.env.CONTENT_REVISION = "off";
    expect(revisionOn()).toBe(false);
    const out = await reviseMonth(
      { messages: { create: async () => { throw new Error("elle a appelé"); } } } as never,
      POSTS
    );
    expect(out).toEqual({ revisions: [], refused: [], usage: { input: 0, output: 0 } });
  });

  it("elle est allumée par défaut", () => {
    expect(revisionOn()).toBe(true);
  });
});

describe("ce qu'elle rend", () => {
  it("une réécriture qui tient est appliquée", async () => {
    const out = await reviseMonth(
      clientSaying(JSON.stringify({
        revisions: [{
          index: 0, why: "says nothing on its own",
          card_line: "Looking fine, running empty",
          payload: { statement: "You look fine at work and your body disagrees at home." },
        }],
      })),
      POSTS
    );
    expect(out.revisions).toHaveLength(1);
    expect(out.revisions[0].cardLine).toBe("Looking fine, running empty");
    expect(out.refused).toEqual([]);
    expect(out.usage).toEqual({ input: 100, output: 50 });
  });

  /*
   * ── ⚠ UNE RÉÉCRITURE EST UNE RÉPONSE DE MODÈLE COMME UNE AUTRE ────────
   *
   * Elle passe par `validateCopy`, où les autres passent. Une passe qui
   * rendrait une ligne de trente-cinq caractères ferait refuser un post qui
   * passait : elle aurait dégradé le mois en croyant l'améliorer.
   */
  it("une ligne trop longue est écartée, et l'original gardé", async () => {
    const out = await reviseMonth(
      clientSaying(JSON.stringify({
        revisions: [{
          index: 0, why: "too long",
          card_line: "Looking perfectly stable while quietly burning out inside",
          payload: { statement: "You look fine at work and your body disagrees at home." },
        }],
      })),
      POSTS
    );
    expect(out.revisions).toEqual([]);
    expect(out.refused).toHaveLength(1);
    expect(out.refused[0].index).toBe(0);
  });

  it("un payload d'une autre forme est écarté", async () => {
    const out = await reviseMonth(
      clientSaying(JSON.stringify({
        revisions: [{ index: 1, why: "reshaped", card_line: "Rest is not a reward", payload: { nodes: [] } }],
      })),
      POSTS
    );
    expect(out.revisions).toEqual([]);
    expect(out.refused).toHaveLength(1);
  });

  it("un index qui ne désigne aucun post est écarté", async () => {
    const out = await reviseMonth(
      clientSaying(JSON.stringify({ revisions: [{ index: 99, why: "nowhere" }] })),
      POSTS
    );
    expect(out.refused[0].because).toContain("aucun post");
  });

  /*
   * ⚠ ELLE NE LÈVE JAMAIS, comme le juge de complétude : une panne de la
   * passe ne doit pas faire tomber un mois. Un mois non révisé est un mois
   * que les contrôles jugeront comme avant.
   */
  it("un JSON illisible ne refuse rien, et se compte quand même", async () => {
    const out = await reviseMonth(clientSaying("désolé, je ne peux pas"), POSTS);
    expect(out.revisions).toEqual([]);
    expect(out.usage.output).toBe(50);
  });

  it("une panne d'appel ne lève pas", async () => {
    const out = await reviseMonth(
      { messages: { create: async () => { throw new Error("502"); } } } as never,
      POSTS
    );
    expect(out).toEqual({ revisions: [], refused: [], usage: { input: 0, output: 0 } });
  });

  it("une liste vide est une réponse valable", async () => {
    const out = await reviseMonth(clientSaying(JSON.stringify({ revisions: [] })), POSTS);
    expect(out.revisions).toEqual([]);
    expect(out.refused).toEqual([]);
  });
});

/*
 * ── ⚠ AVANT LA COMPOSITION, PAS APRÈS ──────────────────────────────────
 *
 * Une réécriture appliquée après aurait laissé sur la carte le texte d'avant :
 * le SVG est dessiné une fois, et c'est lui qu'on publie.
 */
describe("le harnais la place au bon endroit", () => {
  const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

  it("elle passe avant la composition", () => {
    const revise = SOURCE.indexOf('await overhead("revision pass"');
    const compose = SOURCE.indexOf("const composed = composeWithFallback({");
    expect(revise).toBeGreaterThan(-1);
    expect(revise).toBeLessThan(compose);
  });

  /* ⚠ Et elle passe avant le juge, qui doit lire les lignes RÉVISÉES. */
  it("elle passe avant le juge de complétude", () => {
    expect(SOURCE.indexOf('await overhead("revision pass"'))
      .toBeLessThan(SOURCE.indexOf('await overhead("completeness judge"'));
  });

  /*
   * ⚠ C'EST UN FRAIS GÉNÉRAL. La praticienne a acheté trente posts ; qu'il
   * faille les relire est notre affaire, pas un post de moins pour elle.
   */
  it("son coût est inscrit, et ne prend aucun crédit", () => {
    expect(SOURCE).toContain('overhead("revision pass"');
    expect(SOURCE).toContain("syncCostUsd(reviseUsage)");
    expect(SOURCE).toContain("usage, repairUsage, judgeUsage, themesUsage, reviseUsage,");
  });
});
