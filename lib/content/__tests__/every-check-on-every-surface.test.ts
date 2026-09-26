import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkAdvertisingEthics,
  writtenLinesIn,
  type PostUnderCheck,
} from "@/lib/content/month-checks";

/*
 * ── ⚠ `checkSellsSlots` EXISTE DEPUIS F26 ET N'A JAMAIS REGARDÉ L'ENDROIT
 *      OÙ L'ON VEND ──────────────────────────────────────────────────────
 *
 * 341 légendes sur 400 portaient une annonce de disponibilité. Le contrôle
 * était juste, il était branché, il ne voyait simplement pas la surface. Le
 * taux de livraison de 8 sur 9 de F34 avait été mesuré la légende non lue.
 *
 * ⚠ UNE LISTE DE SURFACES ÉCRITE À LA MAIN NE GRANDIRA PAS TOUTE SEULE. Le
 * jour où un post gagne une surface — un sous-titre, une deuxième légende, un
 * texte de partage — elle resterait exacte et fausse à la fois. Ce fichier
 * dérive donc la liste de la SOURCE, comme les compteurs de F27 : il lit les
 * champs de `PostUnderCheck` et exige que chacun arrive dans `writtenLinesIn`.
 */

const SOURCE = readFileSync("lib/content/month-checks.ts", "utf8");

/*
 * ── ⚠ LE HUB DE CONTRÔLE N'EST PLUS UNE SEULE FONCTION ──────────────────
 *
 * `checkMonth` contrôlait trente posts d'un coup, à l'assemblage. Depuis la
 * priorité 2 du 2026-09-26, il est la COMPOSITION de deux moitiés —
 * `checkAcrossPosts` pour ce qui n'existe qu'entre les posts,
 * `checkPostAlone` pour ce qui se juge sur un post seul — afin qu'un post
 * fautif soit refusé à son arrivée plutôt qu'après les vingt-neuf autres.
 *
 * Les tests de recensement de ce fichier lisaient le corps de `checkMonth`.
 * Ils lisent maintenant les DEUX moitiés : c'est là que les appels vivent, et
 * un contrôle qui n'est dans ni l'une ni l'autre n'est pas branché.
 */
function hubBody(): string {
  const from = SOURCE.indexOf("export function checkAcrossPosts(");
  const to = SOURCE.indexOf("\n}\n", SOURCE.indexOf("export function checkMonth("));
  expect(from, "checkAcrossPosts introuvable").toBeGreaterThan(-1);
  expect(to, "checkMonth introuvable").toBeGreaterThan(from);
  return SOURCE.slice(from, to);
}

/** Les champs de `PostUnderCheck`, lus dans le type lui-même. */
function surfacesOf(): string[] {
  const start = SOURCE.indexOf("export type PostUnderCheck = {");
  const end = SOURCE.indexOf("\n};", start);
  expect(start, "PostUnderCheck introuvable").toBeGreaterThan(-1);
  return [...SOURCE.slice(start, end).matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

/*
 * ⚠ CE QUI N'EST PAS UNE SURFACE PUBLIÉE, ET POURQUOI. Chaque exemption est
 * nommée : une liste d'exemptions sans raison est une liste qui grandit.
 */
const NOT_PUBLISHED: Record<string, string> = {
  archetype: "un nom de forme, jamais imprimé",
  title: "le titre du SUJET de banque, pas du post — `cardLine` est ce qui s'imprime",
  payload: "lu champ par champ par `stringsIn`, pas comme un bloc",
  svg: "le rendu, pas le texte : `checkTints` le lit pour la couleur",
  eyebrow: "contrôlé par `checkEyebrow`, qui a ses propres bornes de bande",
  footer: "contrôlé par `checkLicence`, qui y cherche la mention exacte",
};

describe("chaque surface publiée arrive dans les contrôles d'écriture", () => {
  const surfaces = surfacesOf();

  it("le type porte bien les surfaces attendues", () => {
    expect(surfaces).toContain("cardLine");
    expect(surfaces).toContain("caption");
    expect(surfaces).toContain("altText");
    expect(surfaces.length).toBeGreaterThanOrEqual(8);
  });

  /*
   * ⚠ LE TEST QUI ÉCHOUE QUAND UNE SURFACE APPARAÎT SANS ÊTRE LUE. Un champ
   * nouveau dans `PostUnderCheck` n'est ni dans les exemptions nommées ni dans
   * `writtenLinesIn` : il fait tomber ce test, et quelqu'un doit décider
   * lequel des deux il rejoint.
   */
  it("aucune surface n'est ni lue ni exemptée", () => {
    const body = SOURCE.slice(
      SOURCE.indexOf("export function writtenLinesIn("),
      SOURCE.indexOf("/* ── 12.")
    );
    const orphans = surfaces.filter(
      (f) => !(f in NOT_PUBLISHED) && !body.includes(`post.${f}`)
    );
    expect(orphans, `surface(s) ni lue(s) ni exemptée(s) : ${orphans.join(", ")}`).toEqual([]);
  });

  it("chaque exemption dit pourquoi", () => {
    for (const [field, why] of Object.entries(NOT_PUBLISHED)) {
      expect(surfaces, `${field} n'existe plus dans PostUnderCheck`).toContain(field);
      expect(why.length, field).toBeGreaterThan(20);
    }
  });
});

/*
 * ── ⚠ ET LA PREUVE PAR LE CONTENU, PAS SEULEMENT PAR LA SOURCE ──────────
 *
 * Lire le code prouve qu'une ligne existe ; faire passer un post dont chaque
 * surface porte une chaîne unique prouve qu'elle arrive.
 */
describe("un post dont chaque surface est marquée les rend toutes", () => {
  const marked: PostUnderCheck = {
    archetype: "single_statement",
    title: "SUJET-DE-BANQUE",
    cardLine: "MARQUE-LIGNE-DE-CARTE",
    payload: { statement: "MARQUE-PAYLOAD" },
    caption: "MARQUE-LEGENDE",
    altText: "MARQUE-ALTERNATIF",
    eyebrow: "MARQUE-SURTITRE",
    footer: "MARQUE-PIED",
  };

  const texts = writtenLinesIn([marked]).map((l) => l.text);

  it("la ligne de carte, le payload, la légende et l'alternatif arrivent", () => {
    for (const mark of [
      "MARQUE-LIGNE-DE-CARTE", "MARQUE-PAYLOAD", "MARQUE-LEGENDE", "MARQUE-ALTERNATIF",
    ]) expect(texts, mark).toContain(mark);
  });

  /*
   * ⚠ LE SURTITRE ET LE PIED N'Y SONT PAS, ET C'EST VOULU : ils ont leurs
   * propres contrôles, avec leurs propres bornes. Les verser ici ferait passer
   * une bande de quatre mots sous des règles écrites pour des phrases.
   */
  it("le surtitre et le pied ont leurs contrôles, pas ceux-ci", () => {
    expect(texts).not.toContain("MARQUE-SURTITRE");
    expect(texts).not.toContain("MARQUE-PIED");
    expect(SOURCE).toContain("checkEyebrow(month.posts");
    expect(SOURCE).toContain("checkLicence(month.posts");
  });

  /*
   * ⚠ ET LA PROSE EST MARQUÉE. Un contrôle de LIGNE — « cette ligne se
   * tient-elle seule ? » — n'a pas de sens sur un paragraphe de six phrases.
   */
  it("la légende et l'alternatif sont marqués comme de la prose", () => {
    const lines = writtenLinesIn([marked]);
    expect(lines.find((l) => l.text === "MARQUE-LEGENDE")?.kind).toBe("prose");
    expect(lines.find((l) => l.text === "MARQUE-ALTERNATIF")?.kind).toBe("prose");
    expect(lines.find((l) => l.text === "MARQUE-LIGNE-DE-CARTE")?.kind).toBeUndefined();
  });
});

/*
 * ── ⚠ ET LES CONTRÔLES DE TEXTE LISENT TOUS LA MÊME LISTE ───────────────
 *
 * Ce qui a coûté 341 légendes n'était pas qu'un contrôle manquait : c'est
 * qu'il lisait une liste plus courte que les autres. Tous ceux qui prennent
 * `written` prennent la même.
 */
describe("les contrôles de texte prennent tous `written`", () => {
  const body = hubBody();

  /*
   * ⚠ CE QUI A COÛTÉ 341 LÉGENDES N'EST PAS QU'UN CONTRÔLE MANQUAIT : c'est
   * qu'il lisait une liste plus courte que les autres. Tous ceux qui prennent
   * du texte prennent la MÊME liste.
   */
  it("les neuf contrôles de texte lisent la même liste", () => {
    const onWritten = [...body.matchAll(/check(\w+)\(written[,)]/g)].map((m) => m[1]).sort();
    expect(onWritten).toEqual([
      "Borrowed", "Caseload", "ClinicalClaim", "ComparativeClaim", "FalseMechanism",
      "Pathologised", "SellsSlots", "StraightQuotes", "Unfinished",
    ]);
  });

  /*
   * ⚠ ET CEUX QUI PRENNENT `month.posts` SONT NOMMÉS, AVEC LEUR RAISON. Un
   * contrôle qui prend les posts plutôt que les lignes regarde une STRUCTURE,
   * pas un texte — et c'est la seule raison acceptable de ne pas lire la liste
   * commune. Un nouveau venu dans cette liste fait tomber ce test, et
   * quelqu'un doit dire pourquoi il y est.
   */
  const STRUCTURAL: Record<string, string> = {
    Count: "compte les posts, pas leurs mots",
    Mix: "regarde la répartition des archétypes",
    DuplicateTitles: "compare les titres entre eux",
    IdenticalPayloads: "compare les payloads entiers",
    Eyebrow: "a ses propres bornes de bande",
    Licence: "cherche une mention exacte dans le pied",
    CarouselPanels: "compare les volets d'un même carrousel",
    Acronym: "a besoin de l'archétype pour juger un sigle",
    CrisisRoute: "regarde le POST entier, toutes surfaces réunies",
    AdvertisingEthics:
      "lit TOUTES les surfaces, y compris le pied et le surtitre que la liste commune exempte",
  };

  it("ceux qui prennent les posts regardent une structure, et le disent", () => {
    const onPosts = [...body.matchAll(/check(\w+)\(month\.posts[,)]/g)].map((m) => m[1]);
    for (const name of onPosts) {
      expect(STRUCTURAL, `check${name} prend les posts sans raison nommée`).toHaveProperty(name);
    }
    expect(onPosts.length).toBeGreaterThanOrEqual(5);
  });
});

/*
 * ── ⚠ LE SOCLE DÉONTOLOGIQUE, SURFACE PAR SURFACE ───────────────────────
 *
 * `checkAdvertisingEthics` est le contrôle le plus grave du jeu — dix-huit
 * règles qu'un board d'État applique — et il est arrivé en dernier, parce que
 * personne ne l'avait mis dans `checkMonth` : il ne vivait que dans le harnais,
 * une fois, sur quatre champs choisis à la main.
 *
 * Ce bloc plante la même phrase interdite dans CHAQUE champ porteur de texte de
 * `PostUnderCheck`, un à la fois, et exige un constat pour chacun. La liste des
 * champs est lue dans le type, pas recopiée : un post qui gagne une surface
 * gagne un cas de test.
 */
const FORBIDDEN = "Guaranteed relief from anxiety.";

/** Les champs de `PostUnderCheck` qui portent du texte publié. */
const TEXT_BEARING: Record<string, "string" | "payload" | "fallback" | "not-text"> = {
  cardLine: "string",
  // ⚠ LE TITRE DE BANQUE N'EST PAS IMPRIMÉ quand une ligne de carte existe :
  // `writtenLinesIn` lit `cardLine || title`. Il est donc lu en SECOURS, et
  // c'est comme secours qu'il est éprouvé.
  title: "fallback",
  caption: "string",
  altText: "string",
  footer: "string",
  eyebrow: "string",
  payload: "payload",
  archetype: "not-text",
  svg: "not-text",
};

function postWith(field: string): PostUnderCheck {
  const base: PostUnderCheck = {
    archetype: "single_statement",
    title: "A quiet title",
    cardLine: "A quiet line",
    payload: { archetype_key: "single_statement", statement: "Something ordinary." },
  } as PostUnderCheck;
  if (TEXT_BEARING[field] === "payload") {
    return { ...base, payload: { archetype_key: "single_statement", statement: FORBIDDEN } };
  }
  // Le secours ne se lit que si la surface qui le supplante est vide.
  if (TEXT_BEARING[field] === "fallback") {
    return { ...base, cardLine: "", [field]: FORBIDDEN } as PostUnderCheck;
  }
  return { ...base, [field]: FORBIDDEN } as PostUnderCheck;
}

describe("la déontologie publicitaire est lue sur chaque surface", () => {
  const surfaces = surfacesOf();

  it("chaque champ du type est classé", () => {
    const unclassified = surfaces.filter((f) => !(f in TEXT_BEARING));
    expect(
      unclassified,
      `champ(s) de PostUnderCheck non classé(s) — porte-t-il du texte publié ? ${unclassified.join(", ")}`
    ).toEqual([]);
  });

  const bearing = Object.entries(TEXT_BEARING)
    .filter(([, kind]) => kind !== "not-text")
    .map(([field]) => field);

  it.each(bearing)("un post interdit est relevé quand la faute est dans %s", (field) => {
    const findings = checkAdvertisingEthics([postWith(field)]);
    expect(
      findings.map((f) => f.check),
      `« ${FORBIDDEN} » dans ${field} n'a produit aucun constat`
    ).toContain("ethics.blocked");
  });

  it("un post propre ne produit rien", () => {
    expect(checkAdvertisingEthics([postWith("archetype")])).toEqual([]);
  });

  /*
   * ⚠ ET LE CONTRÔLE EST BRANCHÉ. Il a existé hors de `checkMonth` pendant tout
   * le temps où il ne servait à rien ; un contrôle qu'on n'appelle pas n'est pas
   * un contrôle.
   */
  it("le hub l'appelle", () => {
    /*
     * ⚠ SUR `month.posts`, ET `checkPostAlone` LUI EN PASSE UN SEUL. C'est ce
     * qui permet au contrôle déontologique — le plus grave du jeu — de refuser
     * un post à son arrivée, avant que les vingt-neuf autres soient payés.
     */
    expect(hubBody()).toContain("checkAdvertisingEthics(month.posts)");
  });

  /*
   * ⚠ UNE RÈGLE ENFREINTE DEUX FOIS DANS UN POST EST UN DÉFAUT, PAS DEUX. Sinon
   * un post fautif consommerait deux remplaçants du banc pour une réparation.
   */
  it("la même règle dans deux surfaces d'un post ne compte qu'une fois", () => {
    const post = { ...postWith("caption"), altText: FORBIDDEN } as PostUnderCheck;
    expect(checkAdvertisingEthics([post])).toHaveLength(1);
  });
});
