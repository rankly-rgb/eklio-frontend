import { FORMAT_FAMILIES } from "@/lib/content/month-checks";
import { PRACTITIONER_CARDS_PER_MONTH } from "@/lib/content/practitioner";

/*
 * ── ⚠ F13 DIMENSIONNE DIX MOIS QUI SE SUIVENT. LE CRON N'EN FAIT PAS UN ──
 *
 * Le dimensionnement écrit jusqu'ici — 580 sujets par segment, « dix mois
 * tenus » — suppose une praticienne qui tire son mois, puis la suivante le
 * mois d'après. Ce n'est pas ce que le produit fera : un `cron` mensuel
 * génère UN SEGMENT ENTIER LE MÊME JOUR. Dix praticiennes EMDR de Californie
 * tirent en parallèle, et la fenêtre anti-collision de 90 jours interdit à
 * chacune ce que les neuf autres viennent de prendre.
 *
 * ⚠ CE N'EST PAS LE MÊME CHIFFRE, ET L'ÉCART N'EST PAS UNE MARGE. Ce module
 * calcule le stock qu'il faut AU MOMENT DU TIRAGE, par archétype, pour une
 * génération simultanée de tout un segment.
 */

/** Combien de candidats un essai tire. */
export const CANDIDATES_PER_ATTEMPT = 72;

/** Combien de posts un mois livre. */
export const POSTS_PER_MONTH = 30;

/**
 * La fenêtre anti-collision, en tours de `cron` mensuel.
 *
 * ⚠ 90 JOURS, DONC TROIS MOIS DE TIRAGES BLOQUÉS EN MÊME TEMPS. Ce qu'une
 * praticienne a pris en janvier est encore interdit à ses consœurs en mars :
 * le stock doit porter trois tours de segment, pas un.
 */
export const WINDOW_ROUNDS = 3;

/**
 * La part des sujets tirés que le dédoublonnage refuse.
 *
 * ⚠ MESURÉE SUR LA BANQUE RÉELLE, ET ELLE VIENT DE LA BANQUE ELLE-MÊME : les
 * sujets d'un segment sortent tous des mêmes trois thèmes, donc leurs titres
 * se recouvrent. `redundantAgainst` en écarte environ quatre sur dix au
 * tirage.
 *
 * ⚠ ELLE NE COMPTE QUE DANS LE PIC, PAS DANS LE BLOQUÉ. Un sujet refusé au
 * tirage est RELÂCHÉ (F19) : il ne quitte pas la banque pour 90 jours. Mais il
 * faut qu'il ait été là pour être refusé — c'est exactement l'erreur du
 * quatrième essai du 2026-09-23, où `cycle` portait cinq sujets libres pour un
 * tirage de cinq, et n'en a fait accepter aucun.
 */
export const DEDUP_REFUSAL = 0.4;

/** Combien tirer pour en faire accepter `n`. */
const withRefusals = (n: number) => n / (1 - DEDUP_REFUSAL);

/**
 * Ce que le tirage demande, archétype par archétype, pour UN essai.
 *
 * ⚠ CALCULÉ SUR LA BOUCLE DE TIRAGE, PAS RECOPIÉ. La table écrite à la main
 * dans `10-topic-bank.ts` datait de `CANDIDATES = 54` et disait 9
 * `practitioner_card` par mois pour un plafond de 2, et 5 carrousels pour un
 * format tiré deux fois par tour. Trois chiffres faux sur onze, invisibles
 * tant que personne ne refaisait le calcul.
 *
 * La boucle, elle, est simple : `ceil(CANDIDATES / 3)` par famille, pris à
 * tour de rôle sur les créneaux de la famille — `carousel` en occupe deux —
 * et `practitioner_card` sort de la ronde dès son plafond atteint.
 */
export function drawnPerAttempt(candidates = CANDIDATES_PER_ATTEMPT): Record<string, number> {
  const perFamily = Math.ceil(candidates / Object.keys(FORMAT_FAMILIES).length);
  const out: Record<string, number> = {};

  for (const [family, keys] of Object.entries(FORMAT_FAMILIES)) {
    /* Les créneaux du tirage : `carousel` pèse double, et c'est mesuré. */
    const slots = family === "varied" ? [keys[0], keys[1], keys[0], ...keys.slice(2)] : [...keys];
    const live = [...slots];
    let taken = 0;
    let k = 0;
    while (taken < perFamily && live.length > 0) {
      const archetype = live[k % live.length];
      out[archetype] = (out[archetype] ?? 0) + 1;
      taken += 1;
      /*
       * ⚠ LA CARTE PRATICIENNE SORT DE LA RONDE À SON PLAFOND. Son payload
       * vient du brief et ne varie pas : au-delà de deux, c'est la même image
       * avec un autre titre, et `maxIdenticalPayloads` refuse le mois.
       */
      if (archetype === "practitioner_card" && out[archetype] >= PRACTITIONER_CARDS_PER_MONTH) {
        live.splice(live.indexOf(archetype), 1);
        continue;
      }
      k += 1;
    }
  }
  for (const key of Object.values(FORMAT_FAMILIES).flat()) out[key] ??= 0;
  return out;
}

/**
 * Ce qu'un essai RETIENT, archétype par archétype.
 *
 * ⚠ UN ESSAI TIRE 72 SUJETS ET N'EN GARDE QUE 30, MAIS LES 30 SONT PERDUS
 * POUR 90 JOURS. Les sur-générés reviennent à la banque, que le mois soit
 * livré ou refusé (F19) ; les trente publiés restent assignés — et un mois
 * REFUSÉ les garde aussi, puisqu'il reste en `proposed` et qu'on le relit.
 *
 * La forme suit celle du tirage : la sélection prend les trente premiers d'un
 * tirage alterné, donc les mêmes proportions à l'arrondi près.
 */
export function retainedPerAttempt(candidates = CANDIDATES_PER_ATTEMPT): Record<string, number> {
  const drawn = drawnPerAttempt(candidates);
  const share = POSTS_PER_MONTH / candidates;
  return Object.fromEntries(Object.entries(drawn).map(([k, n]) => [k, n * share]));
}

export type BankDemand = {
  /** Combien de praticiennes le segment sert, toutes générées le même jour. */
  practitioners: number;
  /** Combien d'essais il faut pour un mois livré. ⚠ MESURÉ, pas espéré. */
  attempts: number;
  /**
   * Combien de tours de génération restent bloqués EN MÊME TEMPS.
   *
   * ⚠ TROIS POUR UN `cron` MENSUEL — la fenêtre dure 90 jours, donc trois
   * tours se chevauchent. Mais dix mois générés dans la même journée, ce que
   * fait le harnais de mesure, en bloquent DIX : la fenêtre ne s'ouvre pas
   * entre deux essais lancés à dix minutes d'intervalle. C'est le même stock
   * qui sert les deux cas, et seul ce nombre les distingue.
   */
  rounds?: number;
  candidates?: number;
};

/**
 * Le stock tirable qu'un segment doit porter, par archétype.
 *
 * ⚠ DEUX TERMES, ET LE SECOND EST CELUI QU'ON OUBLIE :
 *
 *   `WINDOW_ROUNDS × N × essais × retenus`  ce que trois tours de segment
 *                                            gardent bloqué pendant 90 jours ;
 *   `N × tirés`                              ce que le tirage simultané exige
 *                                            d'un coup, en plus du bloqué.
 *
 * Sans le second, la banque a « assez de sujets » et le tirage n'en trouve
 * pas : c'est le quatrième essai du 2026-09-23, 88 sujets libres au total et
 * 18 candidats tirés sur 54.
 */
export function bankTarget(demand: BankDemand): Record<string, number> {
  const candidates = demand.candidates ?? CANDIDATES_PER_ATTEMPT;
  const drawn = drawnPerAttempt(candidates);
  const retained = retainedPerAttempt(candidates);
  const out: Record<string, number> = {};
  for (const key of Object.keys(drawn)) {
    const rounds = demand.rounds ?? WINDOW_ROUNDS;
    const locked = rounds * demand.practitioners * demand.attempts * retained[key];
    const peak = withRefusals(demand.practitioners * drawn[key]);
    out[key] = Math.ceil(locked + peak);
  }
  return out;
}

/**
 * Le seuil sous lequel un remplissage doit partir AVANT la génération.
 *
 * ⚠ UN TOUR DE SEGMENT, PAS UNE MARGE DE CONFORT. Sous ce chiffre, le tirage
 * simultané ne peut pas se composer : ce n'est pas « la banque est basse »,
 * c'est « le mois va sortir court ». Le seuil est donc ce qu'UN tour exige,
 * et il se mesure par archétype — le total ment, et il a menti.
 */
export function fillTrigger(demand: BankDemand): Record<string, number> {
  const candidates = demand.candidates ?? CANDIDATES_PER_ATTEMPT;
  const drawn = drawnPerAttempt(candidates);
  return Object.fromEntries(
    Object.entries(drawn).map(([k, n]) => [k, Math.ceil(withRefusals(n * demand.practitioners))])
  );
}

/**
 * Ce qui manque, archétype par archétype, pour que la génération puisse partir.
 *
 * Une liste vide veut dire « la banque tient ce tour-ci ».
 */
export function bankShortfall(
  drawable: Record<string, number>,
  demand: BankDemand
): Array<{ archetype: string; drawable: number; needed: number }> {
  const trigger = fillTrigger(demand);
  const out: Array<{ archetype: string; drawable: number; needed: number }> = [];
  for (const [archetype, needed] of Object.entries(trigger)) {
    if (needed === 0) continue;
    const have = drawable[archetype] ?? 0;
    if (have < needed) out.push({ archetype, drawable: have, needed });
  }
  return out.sort((a, b) => a.drawable - b.drawable);
}
