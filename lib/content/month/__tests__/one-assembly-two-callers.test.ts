import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ── ⚠ DEUX IMPLÉMENTATIONS DE L'ASSEMBLAGE, ET C'EST ASSUMÉ POUR UNE
 *      SESSION ─────────────────────────────────────────────────────────────
 *
 * `lib/content/month/assemble.ts` porte l'assemblage pour le chemin produit.
 * `scripts/local-render/20-month.ts` en garde une copie inline, et le harnais
 * n'a PAS été converti.
 *
 * La raison est explicite : convertir serait un refactor de cent quatre-vingts
 * lignes sur le seul pipeline dont on ait des chiffres mesurés — deux mois
 * livrés, 0,574 $ le mois — sans pouvoir rejouer un mois pour le vérifier, le
 * compte fournisseur étant sous limite d'usage. C'est le même refus que pour le
 * transport OpenAI (F42) : du code qu'on ne peut pas exercer se trompe d'une
 * façon que seul un vrai appel révèle.
 *
 * ⚠ MAIS UNE DUPLICATION SANS CONTRAINTE DÉRIVE. Ce fichier tient la
 * SÉQUENCE : les deux assemblages doivent appeler les mêmes mécanismes, dans le
 * même ordre. Une divergence — un contrôle ajouté d'un côté, un échange retiré
 * de l'autre — fait tomber ce test, et c'est exactement ce qu'on veut détecter
 * sans pouvoir rejouer un mois.
 */

const MODULE = readFileSync("lib/content/month/assemble.ts", "utf8");
const HARNESS = readFileSync("scripts/local-render/20-month.ts", "utf8");

/** La région d'assemblage du harnais : du portillon à la fin de l'écriture. */
function harnessAssembly(): string {
  const from = HARNESS.indexOf("const postContext = {");
  const to = HARNESS.indexOf("clearJournal(journal);", from);
  expect(from, "le portillon a disparu du harnais").toBeGreaterThan(-1);
  expect(to, "la fin de l'écriture a disparu du harnais").toBeGreaterThan(from);
  return HARNESS.slice(from, to);
}

/**
 * Les mécanismes appelés, DANS L'ORDRE, dédoublonnés par première apparition.
 *
 * ⚠ LES DÉFINITIONS SONT EXCLUES (F48) : `(?<!function )`. Sans cela, le module
 * qui définit un contrôle le compterait comme l'appelant.
 */
function sequence(src: string): string[] {
  const seen: string[] = [];
  for (const m of src.matchAll(
    /(^|[^\w.])(?<!function )(checkPostAlone|selectDeliverable)\s*\(|\.(insert)\(|\breserve\w*\s*\(/gm
  )) {
    const name = m[2] ?? (m[3] ? "insert" : "reserve");
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

describe("les deux assemblages appellent la même séquence", () => {
  it("le portillon, puis la sélection, puis l'écriture, puis le crédit", () => {
    const expected = ["checkPostAlone", "selectDeliverable", "insert", "reserve"];
    expect(sequence(MODULE)).toEqual(expected);
    expect(
      sequence(harnessAssembly()),
      "le harnais et le module n'assemblent plus dans le même ordre"
    ).toEqual(expected);
  });

  /*
   * ⚠ ET LE PORTILLON REÇOIT LE POST NORMALISÉ, DES DEUX CÔTÉS.
   *
   * `asMonthPost` n'est pas une étape : c'est la mise en forme de l'ARGUMENT du
   * portillon. Passer le post brut ferait lire des champs absents et le
   * contrôle laisserait tout passer — un contrôle qui ne voit rien ne refuse
   * rien. La séquence ci-dessus ne peut pas l'attraper (elle est textuellement
   * imbriquée DANS l'appel), donc elle est vérifiée ici, à part.
   */
  it.each([
    ["le module", MODULE],
    ["le harnais", harnessAssembly()],
  ])("%s normalise le post avant de le juger", (_label, src) => {
    expect(src).toMatch(/checkPostAlone\(\s*asMonthPost\(/);
  });

  /*
   * ⚠ LE PORTILLON AVANT LA SÉLECTION, DES DEUX CÔTÉS. Inversé, il ne gagnerait
   * rien : la sélection aurait déjà dépensé ses échanges sur des défauts qu'un
   * post seul suffisait à voir.
   */
  it.each([
    ["le module", MODULE],
    ["le harnais", harnessAssembly()],
  ])("%s juge chaque post seul avant de sélectionner", (_label, src) => {
    const gate = src.indexOf("checkPostAlone(");
    const select = src.indexOf("selectDeliverable(");
    expect(gate).toBeGreaterThan(-1);
    expect(select).toBeGreaterThan(gate);
  });

  /*
   * ⚠ ET LE CRÉDIT APRÈS L'INSERT, DES DEUX CÔTÉS. Avant, il ferait payer un
   * post que la base refuse.
   */
  it.each([
    ["le module", MODULE],
    ["le harnais", harnessAssembly()],
  ])("%s prend le crédit après l'écriture", (_label, src) => {
    const insertAt = src.search(/\.insert\(|ports\.insert\(/);
    const creditAt = src.search(/reserve\w*\s*\(/);
    expect(insertAt).toBeGreaterThan(-1);
    expect(creditAt).toBeGreaterThan(insertAt);
  });

  /*
   * ⚠ LE REMPLAÇANT AU MÊME CRÉNEAU, DES DEUX CÔTÉS. Décalé d'un rang, il
   * prendrait la date du post suivant et le mois sortirait sur vingt-neuf jours.
   */
  it.each([
    ["le module", MODULE],
    ["le harnais", harnessAssembly()],
  ])("%s rejoue le même rang avec le remplaçant", (_label, src) => {
    expect(src).toContain("spare.shift()");
    expect(src).toMatch(/queue\[index\] = replacement/);
    expect(src).toMatch(/index -= 1/);
  });
});

/*
 * ── ⚠ ET LA DETTE EST DATÉE ─────────────────────────────────────────────
 *
 * Ce fichier existe pour une seule session. Le jour où le harnais appelle
 * `assembleMonth`, il n'a plus d'objet : sa région d'assemblage disparaît, la
 * recherche échoue, et c'est le signal de le supprimer.
 */
describe("la dette de duplication", () => {
  it("le harnais garde encore sa copie — la conversion reste à faire", () => {
    expect(
      HARNESS.includes("const postContext = {") && !HARNESS.includes("assembleMonth("),
      "le harnais appelle assembleMonth : ce fichier n'a plus d'objet et doit être supprimé"
    ).toBe(true);
  });
});
