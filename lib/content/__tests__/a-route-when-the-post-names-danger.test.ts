import { describe, expect, it } from "vitest";
import { checkCrisisRoute, namesAcuteRisk, carriesCrisisRoute } from "@/lib/content/writing-checks";

/*
 * ── ⚠ CE QU'UNE PUBLICATION DOIT PORTER, ET À QUELLES CONDITIONS ────────
 *
 * L'audit du corpus (F35) relève zéro mention de 988 ou d'une ligne d'écoute
 * sur quatre cents posts, sur un contenu qui s'adresse à des lectrices en
 * deuil, en dissociation, en effondrement.
 *
 * ⚠ ET LA RÉPONSE N'EST PAS « UNE MENTION SUR CHAQUE POST ». Aucun board
 * d'État, ni l'ACA ni l'APA, n'exige une ligne de crise sur chaque publicité.
 * En poser une sur quatre cents posts qui parlent de fatigue au retour de
 * congé la rendrait invisible exactement là où elle compte.
 *
 * ⚠ LA RÈGLE RETENUE, EN UNE PHRASE : une lectrice à qui l'on parle de risque
 * aigu ne doit pas rester sans route vers de l'aide immédiate. C'est le devoir
 * de bienfaisance de l'ACA (section A) et la non-malfaisance de l'APA.
 */
const post = (...texts: string[]) => checkCrisisRoute([{ where: "post", texts }]);

describe("un risque aigu nommé sans route est refusé", () => {
  it("les formes qui nomment le danger", () => {
    for (const t of [
      "Some days you do not want to be here.",
      "Self-harm is a way a nervous system tries to cope.",
      "When someone is suicidal, the body is already exhausted.",
      "Thoughts of ending your life are a symptom, not a verdict.",
      "Hurting yourself is not weakness.",
    ]) {
      expect(namesAcuteRisk(t), t).toBe(true);
      expect(post(t).map((f) => f.check), t).toEqual(["text.noCrisisRoute"]);
    }
  });

  it("et la même phrase avec une route passe", () => {
    for (const route of [
      "If you are in danger, call or text 988.",
      "The Suicide & Crisis Lifeline is 988.",
      "Go to the nearest emergency room.",
      "Call 911.",
    ]) {
      expect(carriesCrisisRoute(route), route).toBe(true);
      expect(post("Some days you do not want to be here.", route), route).toEqual([]);
    }
  });

  /*
   * ⚠ LA ROUTE PEUT ÊTRE DANS UN AUTRE CHAMP. Une carte dit trois mots, la
   * légende trois cents : exiger la route dans le MÊME champ obligerait à
   * écrire « 988 » sur une carte de quatre mots. C'est le post que la lectrice
   * voit, pas le champ.
   */
  it("la route comptée sur le post entier, pas sur la ligne", () => {
    expect(post("Some days you do not want to be here.", "", "If you are in danger, call 988."))
      .toEqual([]);
  });
});

/*
 * ── ⚠ « crisis » SEUL A ÉTÉ RETIRÉ, ET C'EST MESURÉ ─────────────────────
 *
 * Il faisait cinq refus sur 1 356 posts, et les cinq étaient faux : « in
 * crisis mode », « in crisis, arousal has a job », « not in crisis, but in a
 * kind of steady depletion ». Le mot décrit le système nerveux dans tout ce
 * vocabulaire-là ; il ne nomme pas une lectrice en danger.
 *
 * Un contrôle déontologique qui refuse cinq fois à tort sur un corpus où il ne
 * devrait rien refuser se fait désarmer au premier mois perdu — et il serait
 * absent le jour où il compte.
 */
describe("la détresse ordinaire n'est pas un risque aigu", () => {
  it("les cinq faux positifs mesurés passent", () => {
    for (const t of [
      "Your body can stay in crisis mode long after your mind knows you are safe.",
      "In crisis, arousal has a job. It keeps you moving.",
      "This is often where people start therapy: not in crisis, but in a kind of steady depletion.",
      "The way your nervous system stayed in crisis mode even after the crisis ended.",
      "When you're in crisis, your nervous system is locked in.",
    ]) {
      expect(namesAcuteRisk(t), t).toBe(false);
      expect(post(t), t).toEqual([]);
    }
  });

  it("et l'écriture ordinaire ne le déclenche pas", () => {
    for (const t of [
      "Rest is not a reward you earn after everything else.",
      "Back at the desk, still braced",
      "Grief for a plan that will not happen",
    ]) expect(post(t), t).toEqual([]);
  });
});

/*
 * ── ⚠ IL EST DORMANT SUR CE CORPUS, ET IL FAUT LE DIRE ──────────────────
 *
 * Mesuré sur les 1 356 posts de la base : **zéro refus**. Le corpus parle de
 * fatigue au retour de congé, pas de risque aigu — le contrôle ne trouve rien
 * parce qu'il n'y a rien, et non parce qu'il ne voit rien. Les cas ci-dessus
 * prouvent qu'il mord ; ce chiffre-là dit seulement que l'occasion ne s'est
 * pas présentée.
 */
describe("ce que la mesure dit et ne dit pas", () => {
  it("le contrôle mord, même si le corpus ne le déclenche pas", () => {
    expect(post("Self-harm is a way a nervous system tries to cope.")).toHaveLength(1);
  });
});
