import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ── LA PREUVE SE TESTE AUSSI ────────────────────────────────────────────
 *
 * ⚠ DEUX POSTS ONT ÉTÉ NOTÉS 1 SUR 5 À TORT, PARCE QUE LA PLANCHE MENTAIT.
 *
 * `70-board.ts` appelait `/api/content-items/[id]/image` sans paramètre, ce
 * qui rend le PREMIER volet. Un carrousel de six volets apparaissait donc sur
 * la planche comme une carte unique portant un badge « 1/6 » —
 * indistinguable d'une phrase seule. Une notation indépendante les a notés au
 * plus bas, « carrousel livré comme une seule diapositive de couverture », et
 * elle avait raison sur ce qu'elle voyait : c'est la preuve qui était fausse,
 * pas le produit. La route accepte `?slide=N` depuis toujours.
 *
 * Un banc de preuve qui sous-déclare le produit est pire qu'aucun banc : il
 * fait corriger ce qui marche.
 */

const source = readFileSync("scripts/local-render/70-board.ts", "utf8");

describe("la planche demande toutes les slides d'un carrousel", () => {
  it("elle passe `?slide=N` quand le post est un carrousel", () => {
    expect(source).toContain('compose_archetype === "carousel"');
    expect(source).toMatch(/image\?slide=\$\{slide\}/);
  });

  it("elle s'arrête au premier refus au-delà du premier volet, sans le compter comme un échec", () => {
    expect(source).toMatch(/if \(slide !== null && slide > 1\) break;/);
  });

  /*
   * ⚠ LE DÉCOMPTE RESTE CELUI DES POSTS. Un carrousel de six volets est UN
   * post ; compter ses volets ferait passer un mois de trente pour un mois de
   * quarante, et diluerait la part de phrases seules — c'est-à-dire
   * améliorerait un chiffre sans rien améliorer.
   */
  it("le mois compte des posts, pas des volets", () => {
    expect(source).toMatch(/const posts = items\?\.length \?\? 0;/);
    expect(source).toMatch(/share: posts \?/);
    expect(source).toMatch(/const lone = \(items \?\? \[\]\)\.filter/);
  });

  it("chaque volet est écrit dans un fichier qui le nomme", () => {
    expect(source).toMatch(/const suffix = slide === null \? "" : `-\$\{slide\}`/);
  });
});
