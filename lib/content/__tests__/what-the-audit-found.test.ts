import { describe, expect, it } from "vitest";
import {
  checkCaseload, checkComparativeClaim, checkFalseMechanism, checkPathologised,
} from "@/lib/content/writing-checks";

/*
 * ── ⚠ QUATRE CLASSES TROUVÉES D'UN COUP, AU LIEU D'UNE PAR NOTATION ─────
 *
 * Jusqu'au 2026-09-24, chaque classe de défauts avait été découverte par une
 * notation de planche, un défaut à la fois : F26 en a trouvé sept, F29 un, F34
 * un. C'est lent, et ça garantit qu'il en reste.
 *
 * Le corpus entier — 5 381 lignes de carte, 400 légendes, 399 alternatifs — a
 * été soumis à un audit mené À L'AVEUGLE : l'auditeur n'avait pas la liste des
 * contrôles existants, seulement les règles de publicité de l'ACA et de l'APA.
 * Il a rendu dix-sept catégories, classées par exposition juridique.
 *
 * Les quatre ci-dessous sont celles qui sont à la fois GRAVES et FORMULABLES.
 */

const say = (fn: (l: Array<{ where: string; text: string }>) => unknown[], text: string) =>
  fn([{ where: "légende", text }]).length > 0;

describe("du contenu tiré de la patientèle réelle", () => {
  /*
   * ⚠ SOIXANTE-SEIZE LÉGENDES SUR QUATRE CENTS, dont trente-et-une datées du
   * mois. ACA B.1.c et B.4, APA 4.01 et 4.07 restreignent l'usage
   * d'informations tirées de la patientèle à des fins promotionnelles. Sur un
   * cabinet nommé dans une ville nommée, « presque tout le monde ce mois-ci »
   * est ré-identifiant : une personne revenue de congé ce mois-là se reconnaît.
   */
  it("un agrégat daté sur le cabinet est refusé", () => {
    for (const t of [
      "Almost everyone who came in this month had just gone back to work after leave.",
      "We've had a pattern this month: people back at work after leave.",
      "A lot of people came in this month saying the same thing.",
      "This month several people walked in with the same story.",
      "My clients often describe it that way.",
    ]) expect(say(checkCaseload, t), t).toBe(true);
  });

  /*
   * ⚠ ET UN PROPOS GÉNÉRAL PASSE. C'est la frontière, et un premier motif l'a
   * franchie : il prenait tout agrégat de personnes suivi d'un verbe de venue,
   * et refusait de la psychoéducation ordinaire qui ne parle de personne.
   * Ce qui fait la divulgation est le CADRE CLINIQUE ou la DATATION, jamais
   * l'agrégat seul.
   */
  it("un propos général sur les gens n'est pas une divulgation", () => {
    for (const t of [
      "Many people come back to work and find their nervous system had other ideas.",
      "Most people describe the same thing after leave.",
      "High achievers often notice it as fatigue that rest does not touch.",
    ]) expect(say(checkCaseload, t), t).toBe(false);
  });
});

describe("une comparaison d'efficacité avec un autre traitement", () => {
  /*
   * ⚠ « faster » EST UNE GRANDEUR MESURABLE, et rien ne la mesure. Les
   * allégations comparatives sont la catégorie la plus lourdement encadrée par
   * la FTC, et les règles de publicité des boards interdisent une supériorité
   * non étayée. ACA C.6.d et APA 5.01 ajoutent qu'on ne dénigre pas la
   * modalité d'une consœur.
   */
  it("une supériorité affirmée sur la parole est refusée", () => {
    for (const t of [
      "The processing happens faster than talk alone.",
      "EMDR processes things that talk therapy alone sometimes can't touch.",
      "A heaviness that talking alone cannot reach.",
      "It works better than talking about it.",
    ]) expect(say(checkComparativeClaim, t), t).toBe(true);
  });

  /*
   * ⚠ UNE COMPARAISON SANS TRAITEMENT N'EST PAS UNE ALLÉGATION. Un premier
   * motif acceptait `faster|deeper|better than` seul, et refusait deux phrases
   * du corpus qui ne comparent aucun traitement : une métaphore et une
   * description de symptôme.
   */
  it("une comparaison ordinaire n'est pas une allégation", () => {
    for (const t of [
      "When you slow down, what you've been moving faster than catches up.",
      "The fatigue is deeper than tired.",
      "EMDR works differently with identity than talk does.",
    ]) expect(say(checkComparativeClaim, t), t).toBe(false);
  });
});

describe("un mécanisme neurologique faux", () => {
  /*
   * ⚠ CE SONT DES FAUSSETÉS, PAS DES RACCOURCIS. Le récit hémisphérique de la
   * stimulation bilatérale est discrédité nommément ; la répartition
   * amygdale/cortex telle qu'imprimée est anatomiquement fausse ; et « le
   * cerveau ne distingue pas » est une prémisse fabriquée qui porte tout le
   * raisonnement étendant un traitement du SSPT au deuil.
   */
  it("les formes établies comme fausses sont refusées", () => {
    for (const t of [
      "Bilateral processing — working with both sides of your brain — helps settle it.",
      "The brain doesn't distinguish between almost dying and losing someone.",
      "Amygdala processes",
      "Cortex rewires",
      "This is left brain work.",
    ]) expect(say(checkFalseMechanism, t), t).toBe(true);
  });

  /* ⚠ Et la vulgarisation légitime passe : le contrôle ne juge pas le niveau. */
  it("une explication simplifiée mais juste passe", () => {
    for (const t of [
      "Bilateral stimulation is part of how the protocol works.",
      "Your nervous system keeps a timeline the calendar does not.",
      "Memory changes when it is revisited.",
    ]) expect(say(checkFalseMechanism, t), t).toBe(false);
  });
});

describe("un trait ordinaire requalifié en pathologie", () => {
  /*
   * ⚠ DEUX TORTS D'UN COUP : une affirmation clinique non étayée, et un
   * mécanisme de vente — il convertit une non-patiente en patiente en
   * dévaluant un trait qui fonctionne. ACA E.5 et APA 9.01 interdisent un
   * diagnostic sans examen, et la destinataire est une inconnue qui lit un fil.
   *
   * `checkClinicalClaim` attrapait déjà « X BECOMES a trauma response » ; il ne
   * voyait pas la forme nominale, qui dit la même chose sans verbe.
   */
  it("la forme nominale est refusée comme la verbale", () => {
    for (const t of [
      "Competence as a Trauma",
      "Hyperproductivity as a trauma",
      "Efficiency as a freeze",
      "Perfectionism as a symptom",
    ]) expect(say(checkPathologised, t), t).toBe(true);
  });

  it("nommer un trait sans le pathologiser passe", () => {
    for (const t of [
      "Competence has a cost",
      "Productivity as a habit",
      "Efficiency is not the same as rest",
    ]) expect(say(checkPathologised, t), t).toBe(false);
  });
});

/*
 * ── ⚠ CALIBRÉS SUR LE CORPUS, PAS SUR UNE INTUITION ────────────────────
 *
 * Taux de refus mesurés sur les 9 357 lignes écrites de la base, légendes et
 * alternatifs compris :
 *
 *   `text.caseload`         73 = 0,78 %
 *   `text.comparative`       2 = 0,02 %
 *   `text.falseMechanism`    9 = 0,10 %
 *   `text.pathologised`      4 = 0,04 %
 *
 * Un contrôle qui en refuserait dix fois plus se ferait relâcher au premier
 * mois perdu à tort, ce qui est la façon dont un contrôle meurt.
 */
describe("les quatre restent étroits", () => {
  it("ils laissent passer une écriture ordinaire", () => {
    const ordinary = [
      "Rest is not a reward you earn after everything else.",
      "Back at the desk, still braced",
      "Your body keeps a timeline the calendar does not.",
      "Notice the cost, then name it",
      "When the plan stops fitting",
    ];
    for (const t of ordinary) {
      expect(say(checkCaseload, t), t).toBe(false);
      expect(say(checkComparativeClaim, t), t).toBe(false);
      expect(say(checkFalseMechanism, t), t).toBe(false);
      expect(say(checkPathologised, t), t).toBe(false);
    }
  });
});
