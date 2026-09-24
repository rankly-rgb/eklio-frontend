import { describe, expect, it } from "vitest";
import { checkClinicalClaim } from "@/lib/content/writing-checks";

/*
 * ── ⚠ UN MOIS VERT PORTAIT UNE PROMESSE D'EFFICACITÉ ───────────────────
 *
 * Relevée par une notation indépendante sur le mois du 2026-12 de
 * `cleo.nightingale`, livré sans un seul constat, à contrôles gelés :
 *
 *   « Bilateral stimulation gives an overworked nervous system a way to
 *     power down. »
 *
 * ⚠ C'EST LE SEUL DÉFAUT DE LA PLANCHE QUE LA NOTATION AIT DIT « NE DOIT PAS
 * SORTIR DU BÂTIMENT ». Tout le reste relevait du métier — un quadrant sans
 * ses axes, des libellés qui se renvoient la balle. Celle-ci est une
 * affirmation d'efficacité clinique, sans nuance, sous le nom d'une licenciée.
 *
 * Les trois motifs existants attrapaient « X guérit Y », « X EST un
 * diagnostic », « votre corps VA s'effondrer ». Aucun n'attrapait une
 * TECHNIQUE sujet d'un verbe de résultat — la forme la plus naturelle qu'un
 * modèle produise quand on lui demande d'expliquer comment le travail marche.
 */
const say = (text: string, modalities = ["EMDR"]) =>
  checkClinicalClaim([{ where: "carte", text }], modalities).map((f) => f.check);

describe("la promesse nue est refusée", () => {
  /* ⚠ La ligne exacte, telle qu'elle a été imprimée. */
  it("la ligne que la notation a relevée", () => {
    expect(say("Bilateral stimulation gives an overworked nervous system a way to power down."))
      .toEqual(["text.clinicalClaim"]);
  });

  it("les autres formes de la même promesse", () => {
    for (const line of [
      "EMDR helps the nervous system settle after a hard week.",
      "Therapy rewires the response.",
      "Grounding stops the spiral.",
      "EMDR quiets it",
      "Therapy helps",
      "Reprocessing removes what the body kept.",
    ]) {
      expect(say(line), line).toEqual(["text.clinicalClaim"]);
    }
  });

  /*
   * ⚠ LA MODALITÉ VIENT DU BRIEF, PAS DU TEXTE. C'est la règle de F16 :
   * aucun contrôle ne tire sa référence de la source qu'il surveille. Une
   * praticienne qui ne fait pas d'EMDR n'a pas à voir ce mot-là refusé, et
   * celle qui en fait doit le voir.
   */
  it("la modalité du brief entre dans le sujet de la promesse", () => {
    expect(say("Somatic experiencing helps the body finish.", ["somatic experiencing"]))
      .toEqual(["text.clinicalClaim"]);
    expect(say("Somatic experiencing helps the body finish.", ["EMDR"])).toEqual([]);
  });
});

describe("⚠ la nuance est la frontière, et elle sauve la phrase", () => {
  /*
   * « EMDR CAN help the nervous system settle » est ce qu'un ordre
   * professionnel demande d'écrire ; « EMDR helps » est ce qu'il refuse. Un
   * contrôle qui interdirait le SUJET interdirait l'intention `educate` tout
   * entière — un cinquième de la banque — et se ferait relâcher au premier
   * mois refusé à tort.
   */
  it("une promesse nuancée passe", () => {
    for (const line of [
      "EMDR can help the nervous system settle after a hard week.",
      "Reprocessing may let the body finish what it started.",
      "The work is designed to give the body a way to finish.",
      "For some, grounding quiets the spiral.",
      "Therapy sometimes helps the body land.",
    ]) {
      expect(say(line), line).toEqual([]);
    }
  });

  /* ⚠ Et nommer une modalité sans rien promettre n'est pas une promesse. */
  it("nommer la modalité n'est pas promettre", () => {
    for (const line of ["EMDR for burnout", "EMDR, Oakland, CA", "What EMDR asks of a nervous system"]) {
      expect(say(line), line).toEqual([]);
    }
  });

  it("une phrase sans technique n'est pas concernée", () => {
    expect(say("Rest is not a reward you earn after everything else.")).toEqual([]);
    expect(say("Your body keeps a timeline the calendar does not.")).toEqual([]);
  });
});

describe("les trois motifs d'origine tiennent toujours", () => {
  it("un diagnostic en prédicat", () => {
    expect(say("Efficiency can become trauma")).toEqual(["text.clinicalClaim"]);
  });

  it("une promesse de guérison", () => {
    expect(say("This cures your anxiety")).toEqual(["text.clinicalClaim"]);
  });

  it("un effondrement annoncé", () => {
    expect(say("Your nervous system will collapse")).toEqual(["text.clinicalClaim"]);
  });
});

/*
 * ── ⚠ CALIBRÉ SUR CE QUI A ÉTÉ ÉCRIT, PAS SUR UNE INTUITION ────────────
 *
 * Mesuré sur les 7 199 lignes écrites de la base : **29 refusées, soit
 * 0,40 %**, et chacune est une vraie promesse nue — « Therapy rewires… »,
 * « EMDR quiets it », « Therapy helps ». Un contrôle qui en refuserait dix
 * fois plus se ferait relâcher au premier mois perdu à tort, ce qui est la
 * façon dont un contrôle meurt.
 */
describe("le motif reste étroit", () => {
  it("il laisse passer ce qui n'est pas une promesse", () => {
    const innocent = [
      "When the plan stops fitting",
      "Back at the desk, still braced",
      "Nothing left by Friday",
      "The body remembers longer than the calendar",
      "Notice the cost, then name it",
      "A soft invitation",
    ];
    for (const line of innocent) expect(say(line), line).toEqual([]);
  });
});
