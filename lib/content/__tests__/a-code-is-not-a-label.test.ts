import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkEyebrow, type PostUnderCheck } from "@/lib/content/month-checks";
import { eyebrowFor } from "@/lib/content/bands";

/*
 * ── ⚠ QUATRE SURTITRES RELEVÉS SUR DES PLANCHES PUBLIABLES ──────────────
 *
 * Une notation indépendante a lu, en haut de cartes destinées à des
 * clinicienne : « CORRECTAMYTH », « BEHINDTHEPRACTICE », « ONLY ONE »,
 * « A SOFT INVITATION ». Trois causes, et aucune n'était celle qu'on croyait.
 *
 * Les valeurs ci-dessous ne sont pas inventées pour le test : ce sont celles
 * qui ont été imprimées.
 */
const CATALOGUE = [
  { id: "behind_the_practice", label: "Behind the practice" },
  { id: "correct_a_myth", label: "Myth, gently corrected" },
  { id: "educate", label: "How the work works" },
  { id: "invite", label: "A soft invitation" },
  { id: "normalise", label: "Not the only one" },
];

const post = (eyebrow: string | undefined): PostUnderCheck => ({
  archetype: "single_statement",
  title: "Rest is not a reward",
  cardLine: "Rest is not a reward",
  payload: {},
  eyebrow,
});

const checksOn = (eyebrow: string | undefined, practiceName = "Willow Clinic") =>
  checkEyebrow([post(eyebrow)], CATALOGUE, practiceName).map((f) => f.check);

describe("ce qui a été imprimé est refusé", () => {
  /*
   * ⚠ LE HARNAIS PASSAIT `topic.intent` DANS UN CHAMP NOMMÉ `angleLabel`.
   * Mis en capitales, le tiret bas tombe avec le reste de la ponctuation et
   * les mots se collent. Le contrôle reconnaît le code sous la couture
   * retirée.
   */
  it("« CORRECTAMYTH » est un identifiant, pas un libellé", () => {
    expect(checksOn("CORRECTAMYTH")).toEqual(["eyebrow.identifier"]);
  });

  it("« BEHINDTHEPRACTICE » aussi", () => {
    expect(checksOn("BEHINDTHEPRACTICE")).toEqual(["eyebrow.identifier"]);
  });

  /*
   * ⚠ « ONLY ONE » N'ÉTAIT PAS UN DRAPEAU DE PAGINATION, comme la notation
   * l'a lu. C'est « You are not the only one » dont le rendu a retiré les
   * mots outils — et ce qui reste dit le CONTRAIRE de la phrase d'origine.
   * Il tient dans la bande, il ne ressemble pas à un code : seule la liste
   * des libellés autorisés le refuse.
   */
  it("« ONLY ONE » ne figure dans aucun libellé autorisé", () => {
    expect(checksOn("ONLY ONE")).toEqual(["eyebrow.unlisted"]);
  });

  /*
   * ⚠ ET « A SOFT INVITATION » N'ÉTAIT PAS UN DÉFAUT. C'est le libellé
   * `invite`, rendu correctement. Ce cas est ici pour qu'on cesse de le
   * chercher — et pour qu'un tour de vis sur les trois autres ne l'emporte
   * pas par ricochet.
   */
  it("« A SOFT INVITATION » passe : c'est le libellé, bien rendu", () => {
    expect(checksOn("A SOFT INVITATION")).toEqual([]);
  });
});

describe("la forme de la bande", () => {
  it("les cinq libellés du catalogue passent", () => {
    for (const { label } of CATALOGUE) {
      expect(checksOn(label.toUpperCase()), label).toEqual([]);
    }
  });

  it("le nom du cabinet passe : c'est le dernier repli du rendu", () => {
    expect(checksOn("WILLOW CLINIC")).toEqual([]);
  });

  it("au-delà de quatre mots, la bande déborde", () => {
    expect(checksOn("YOU ARE NOT THE ONLY ONE")).toEqual(["eyebrow.length"]);
  });

  it("au-delà de vingt-deux caractères aussi", () => {
    expect(checksOn("EXTRAORDINARILY LONGISH")).toEqual(["eyebrow.length"]);
  });

  it("une bande vide n'a pas de hauteur", () => {
    expect(checksOn("   ")).toEqual(["eyebrow.empty"]);
  });

  it("un tiret bas ou un chiffre trahit un code", () => {
    expect(checksOn("CORRECT_A_MYTH")).toEqual(["eyebrow.identifier"]);
    expect(checksOn("ARCHETYPE 2")).toEqual(["eyebrow.identifier"]);
  });

  /*
   * ⚠ LE PROCHAIN CODE N'EST PAS ENCORE DANS LE CATALOGUE. La règle des mots
   * collés est la seule des six qui refuse une couture qu'aucune liste ne
   * nomme — elle découpe le mot avec le vocabulaire des libellés et des
   * identifiants, et un mot qui se découpe entièrement n'est pas un mot.
   */
  it("un mot collé est refusé même absent du catalogue", () => {
    expect(checksOn("PRACTICEINVITE")).toEqual(["eyebrow.glued"]);
  });

  it("un vrai mot long n'est pas un mot collé", () => {
    /* « invitation » contient « invite » ? Non — mais « in » non plus. */
    expect(checkEyebrow([post("INVITATION")], CATALOGUE, "X").map((f) => f.check))
      .toEqual(["eyebrow.unlisted"]);
  });

  /* ⚠ L'ABSENCE DE SURTITRE N'EST PAS UN SURTITRE FAUTIF. */
  it("un post sans bande composée n'est pas refusé", () => {
    expect(checksOn(undefined)).toEqual([]);
  });

  /*
   * ⚠ UNE LISTE VIDE N'EST PAS UNE LISTE. Sans catalogue, le contrôle
   * vérifie la forme et se tait sur l'appartenance : refuser tout, faute de
   * référence, ferait tomber chaque mois d'un appelant qui ne la fournit pas.
   */
  it("sans catalogue, la forme seule est vérifiée", () => {
    expect(checkEyebrow([post("ANYTHING AT ALL")], [], undefined)).toEqual([]);
    expect(checkEyebrow([post("A_CODE")], [], undefined).map((f) => f.check))
      .toEqual(["eyebrow.identifier"]);
  });
});

/*
 * ── ⚠ LE CONTRÔLE ET LE RENDU DOIVENT S'ACCORDER ────────────────────────
 *
 * Un contrôle qui refuserait ce que le rendu produit normalement refuserait
 * tous les mois. C'est le sens de l'aller-retour : on fait passer les cinq
 * libellés par la fonction qui les imprime, et on contrôle ce qui en sort.
 */
describe("ce que le rendu produit passe le contrôle", () => {
  it("les cinq libellés traversent `eyebrowFor` sans être rabotés", () => {
    for (const { label } of CATALOGUE) {
      const rendered = eyebrowFor({ angleLabel: label, title: "A title", theme: "A theme" }, "Willow Clinic");
      expect(rendered, label).toBe(label.toUpperCase());
      expect(checkEyebrow([post(rendered)], CATALOGUE, "Willow Clinic"), label).toEqual([]);
    }
  });

  /*
   * ⚠ ET UN LIBELLÉ TROP LONG EST ABANDONNÉ, PAS RABOTÉ. « You are not the
   * only one » donnait « ONLY ONE ». Il tombe maintenant sur le repli, que le
   * contrôle refuse à son tour — refuser vaut mieux qu'imprimer un contresens.
   */
  it("un libellé qui ne tient pas n'est plus découpé", () => {
    const rendered = eyebrowFor(
      { angleLabel: "You are not the only one", title: "Rest is not a reward", theme: "A theme" },
      "Willow Clinic"
    );
    expect(rendered).not.toBe("ONLY ONE");
    expect(checkEyebrow([post(rendered)], CATALOGUE, "Willow Clinic").map((f) => f.check))
      .toEqual(["eyebrow.unlisted"]);
  });
});

/*
 * ── ⚠ LE DÉFAUT VIVAIT DANS LE HARNAIS, PAS DANS LE RENDU ───────────────
 *
 * Le chemin produit lit `angle_label`, joint depuis `content_intents` dans
 * une RPC. Le harnais passait `topic.intent`. Même fonction de rendu, deux
 * appelants, un seul juste — et c'est le harnais qui fabrique les planches
 * qu'on note.
 */
describe("le harnais passe un libellé", () => {
  const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

  it("il ne passe plus le code d'intention au surtitre", () => {
    expect(SOURCE).not.toContain("angleLabel: candidate.topic.intent");
  });

  it("il lit le catalogue une fois, et le donne au contrôle", () => {
    expect(SOURCE).toContain('from("content_intents").select("id, label")');
    expect(SOURCE).toContain("angleLabel: intentLabels.get(candidate.topic.intent)");
    expect(SOURCE).toContain("eyebrowCatalogue: intentCatalogue");
  });

  /* ⚠ Et la valeur contrôlée est celle qui est COMPOSÉE, pas son entrée. */
  it("la bande composée est retenue jusqu'au contrôle", () => {
    // ⚠ Le pied s'est intercalé le jour où il a porté la mention de licence.
    expect(SOURCE).toContain("eyebrow, footer:");
    expect(SOURCE).toContain("eyebrow: p.eyebrow,");
  });
});
