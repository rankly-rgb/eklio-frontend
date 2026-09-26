import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkAcrossPosts,
  checkMonth,
  checkPostAlone,
  type MonthUnderCheck,
  type PostUnderCheck,
} from "@/lib/content/month-checks";

/*
 * ── ⚠ TOUT TOMBAIT À L'ASSEMBLAGE, ET UN POST FAUTIF COÛTAIT UN ÉCHANGE ──
 *
 * `sable.ingram`, 2026-09-24 : dix échanges réussis — tous ses constats de
 * contenu levés — puis mort sur `month.short`. Les dix défauts se lisaient
 * chacun sur un post SEUL, et chacun a consommé un remplaçant du banc pour ce
 * qu'un contrôle à l'arrivée aurait refusé pour rien.
 *
 * Le partage est donc explicite. Ce fichier tient les deux propriétés qui le
 * rendent sûr : `checkMonth` reste exactement la somme des deux moitiés, et
 * aucune ne regarde ce qui n'est pas de son ressort.
 */

const SOURCE = readFileSync("lib/content/month-checks.ts", "utf8");

/**
 * Le corps d'une fonction, SIGNATURE EXCLUE.
 *
 * ⚠ LA SIGNATURE PORTE LE NOM DE LA FONCTION, et un recensement des appels qui
 * la garderait compterait la fonction comme son propre appelant — les deux
 * premières versions de ces tests annonçaient « checkMonth appelle checkMonth ».
 */
function bodyOf(name: string): string {
  const at = SOURCE.indexOf(`export function ${name}(`);
  expect(at, `${name} introuvable`).toBeGreaterThan(-1);
  const open = SOURCE.indexOf("{", SOURCE.indexOf(")", at));
  return SOURCE.slice(open, SOURCE.indexOf("\n}\n", open));
}

/** Les contrôles appelés dans un corps, dédoublonnés et triés. */
function callsIn(name: string): string[] {
  return [...new Set([...bodyOf(name).matchAll(/\b(check[A-Z]\w*)\(/g)].map((m) => m[1]))].sort();
}

const post = (over: Partial<PostUnderCheck> = {}): PostUnderCheck => ({
  archetype: "single_statement",
  title: "A quiet title",
  cardLine: "A quiet line",
  payload: { archetype_key: "single_statement", statement: "Something ordinary happens." },
  ...over,
});

const month = (posts: PostUnderCheck[], over: Partial<MonthUnderCheck> = {}): MonthUnderCheck =>
  ({ posts, direction: "warm", ...over }) as MonthUnderCheck;

describe("checkMonth est la somme des deux moitiés", () => {
  /*
   * ⚠ LA PROPRIÉTÉ, PAS LA SOURCE. Un test qui lirait le corps de `checkMonth`
   * dirait qu'il appelle les deux ; celui-ci dit qu'il ne fait RIEN D'AUTRE —
   * un contrôle glissé dans `checkMonth` seul, sans passer par l'une des deux
   * moitiés, ne serait pas vu par le portillon et le ferait tomber.
   */
  it.each([
    ["un mois ordinaire", month([post(), post({ cardLine: "Another line" })], { wanted: 2 })],
    ["un post fautif", month([post({ caption: "Guaranteed relief from anxiety." })], { wanted: 1 })],
    ["un mois court", month([post()], { wanted: 30 })],
    ["deux titres identiques", month([post(), post()], { wanted: 2 })],
  ])("%s", (_label, m) => {
    const { posts, wanted, ...context } = m;
    const composed = [
      ...checkAcrossPosts(m),
      ...posts.flatMap((p) => checkPostAlone(p, context)),
    ];
    expect(checkMonth(m)).toEqual(composed);
  });

  it("checkMonth n'a pas de corps propre", () => {
    /*
     * Il ne doit appeler que les deux moitiés. Tout `check…(` supplémentaire
     * dans ce corps est un contrôle que le portillon ne verra jamais.
     */
    expect(callsIn("checkMonth")).toEqual(["checkAcrossPosts", "checkPostAlone"]);
  });
});

describe("chaque moitié reste dans son ressort", () => {
  /*
   * ⚠ LES QUATRE TRANSVERSAUX SONT CEUX QU'UN POST SEUL NE PEUT PAS TRANCHER.
   * Si l'un d'eux passait dans la moitié par post, il refuserait chaque post du
   * mois — un mois de trente posts serait « trente posts en trop ».
   */
  it("les transversaux sont bien les quatre attendus", () => {
    expect(callsIn("checkAcrossPosts")).toEqual([
      "checkCount", "checkDuplicateTitles", "checkIdenticalPayloads", "checkMix",
    ]);
  });

  it("un post seul ne déclenche jamais un constat de compte ou de mélange", () => {
    const findings = checkPostAlone(post(), { direction: "warm" } as never);
    for (const f of findings) {
      expect(f.check, "un contrôle transversal a glissé dans la moitié par post")
        .not.toMatch(/^(count|mix)\./);
    }
  });

  /*
   * ⚠ ET LE PORTILLON VOIT CE QUE L'ASSEMBLAGE VOYAIT. C'est la garantie qui
   * compte : un défaut par post refusé à l'arrivée est un échange épargné.
   */
  it.each([
    ["une promesse déontologique", post({ caption: "Guaranteed relief from anxiety." }), "ethics.blocked"],
    ["une ligne inachevée", post({ cardLine: "When your life and" }), "text.unfinished"],
  ])("%s est vue sur un post seul", (_label, p, check) => {
    const alone = checkPostAlone(p, { direction: "warm" } as never).map((f) => f.check);
    expect(alone).toContain(check);
  });
});

/*
 * ── ⚠ ET LE HARNAIS S'EN SERT, AU BON ENDROIT ───────────────────────────
 */
describe("le harnais contrôle à l'arrivée et remplace un insert refusé", () => {
  const MONTH = readFileSync("scripts/local-render/20-month.ts", "utf8");

  it("le portillon tourne avant la sélection", () => {
    const gate = MONTH.indexOf("checkPostAlone(asMonthPost(post), postContext)");
    const select = MONTH.indexOf("const selection = selectDeliverable(");
    expect(gate, "le portillon par post a disparu du harnais").toBeGreaterThan(-1);
    expect(gate, "le portillon tourne APRÈS la sélection : il n'épargne alors aucun échange")
      .toBeLessThan(select);
  });

  it("un post écarté rend son crédit, AU COÛT RÉEL, et son sujet", () => {
    const block = MONTH.slice(
      MONTH.indexOf("const gateRefusals"),
      MONTH.indexOf("const selection = selectDeliverable(")
    );
    expect(block).toContain("await settle(");
    expect(block).toContain("post.candidate.reservationId");
    /*
     * ⚠ PAS À ZÉRO. Les jetons ont été dépensés chez le fournisseur, et
     * `settle_credit` rend `already_settled` sans lever : la PREMIÈRE issue est
     * celle qui reste au registre, donc un zéro ici efface la dépense pour
     * toujours. Mesuré le 2026-09-26 sur le remplissage de banque, qui dépense
     * 1,20 $ dont le registre ne porte que 0,0046 $.
     */
    expect(block).not.toContain("post.candidate.reservationId, 0, false");
    expect(block).toMatch(/batchCostUsd\(\[post\.candidate\.usage\]\)/);
  });

  /*
   * ⚠ LE REMPLAÇANT PREND LE MÊME CRÉNEAU. Décalé d'un rang, il aurait la date
   * du post suivant, et le mois sortirait sur vingt-neuf jours.
   */
  it("un insert refusé prend un remplaçant au même rang", () => {
    const block = MONTH.slice(
      MONTH.indexOf('db.from("content_items").insert({'),
      MONTH.indexOf("clearJournal(journal);")
    );
    expect(block).toContain("const replacement = spare.shift();");
    expect(block).toContain("queue[index] = replacement;");
    expect(block).toContain("index -= 1;");
  });

  it("les sujets gardés sont ceux dont le post est en base", () => {
    expect(MONTH).toContain("const succeeded = insertedPosts.map((p) => p.candidate);");
  });

  it("le portillon est rapporté par classe", () => {
    expect(MONTH).toContain("byCheck: Object.fromEntries(");
    expect(MONTH).toContain("inserts: { replacements: spareUsed, refused: insertRefusals }");
  });
});
