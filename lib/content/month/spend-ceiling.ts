/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PLAFOND DE DÉPENSE DE LA RÉDACTION — F58, ET C'EST UN PRÉREQUIS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ SANS LUI, L'ORCHESTRATEUR DÉPENSE AUTANT QUE LA BANQUE A DE SUJETS.
 *
 * `WriterPort` est le seul accès payant de tout l'enchaînement, et il reçoit la
 * liste des sujets tirés. Cette liste vient de `drawMonth`, qui vient de la
 * banque : la banque locale portait **1 331 tirables** le 2026-09-26. Rien, dans
 * le chemin, ne borne ce qu'on fait rédiger — un `candidates` mal calculé, une
 * reprise qui repart de zéro, un tirage qui rend plus que prévu, et la facture
 * suit la banque au lieu de suivre l'abonnement.
 *
 * ── ⚠ DEUX BORNES, PARCE QU'UNE SEULE SE LAISSE CONTOURNER ──────────────
 *
 *   LE NOMBRE   on ne fait jamais rédiger plus de `maxTopics` sujets. C'est la
 *               borne qui ne dépend d'aucune estimation : elle tient même si le
 *               prix par post est faux.
 *   LES DOLLARS on refuse quand le déjà-dépensé plus l'estimation franchiraient
 *               `capUsd`. C'est la borne qui tient même si le nombre est juste et
 *               le modèle cher.
 *
 * Le nombre seul laisserait passer trente posts à dix dollars pièce ; les dollars
 * seuls dépendent d'une estimation qui peut se tromper. Les deux ensemble bornent
 * les deux façons de se tromper.
 *
 * ── ⚠ IL REFUSE AVANT D'APPELER, JAMAIS APRÈS ───────────────────────────
 *
 * Un plafond qui constate le dépassement n'est pas un plafond, c'est un journal.
 * C'est la règle que `withCallCeiling` tenait déjà pour le générateur retiré, et
 * la seule qui protège de quoi que ce soit.
 *
 * ── ⚠ ET IL EST OBLIGATOIRE DANS `OrchestrateInput` ─────────────────────
 *
 * Pas de valeur par défaut. Une valeur par défaut est un plafond qu'on hérite sans
 * l'avoir décidé, donc un plafond que personne ne relit — et la leçon de F56 est
 * qu'un paramètre facultatif finit par ne pas être passé. Le compilateur exige
 * donc que chaque appelant dise son plafond.
 */

export type SpendCeiling = {
  /**
   * Le plafond en dollars pour CE mois, reprise comprise.
   *
   * ⚠ IL COUVRE LE MOIS, PAS L'APPEL. Un plafond par appel se contourne en
   * appelant deux fois, et c'est exactement ce qu'une reprise fait.
   */
  capUsd: number;
  /**
   * Ce qu'un post rédigé coûte, MESURÉ.
   *
   * ⚠ MESURÉ, PAS ESPÉRÉ. Les deux mois livrés du 2026-09-26 ont coûté 0,5612 $ et
   * 0,5868 $ pour 102 candidats soumis, soit environ 0,0056 $ par candidat. Une
   * estimation optimiste ici est un plafond qui ne se déclenche jamais — la forme
   * de F41, où un rendement dérivé d'un ratio tautologique s'est confirmé lui-même
   * pendant deux sessions.
   */
  estimatedCostPerPostUsd: number;
  /**
   * Combien de sujets au plus on fait rédiger, quoi qu'en dise la banque.
   *
   * ⚠ C'EST LA BORNE QUI NE DÉPEND D'AUCUNE ESTIMATION. Elle se déduit de ce que
   * le mois promet plus sa surgénération — jamais de ce que la banque contient.
   */
  maxTopics: number;
};

export type CeilingVerdict =
  | { ok: true; estimateUsd: number }
  | {
      ok: false;
      /** `count` quand c'est le nombre, `spend` quand ce sont les dollars. */
      bound: "count" | "spend";
      /** Une phrase qui dit les chiffres, destinée à être lue telle quelle. */
      refusal: string;
    };

/**
 * Cette rédaction tient-elle dans le plafond ?
 *
 * ⚠ PURE, ET APPELÉE AVANT LE PORT. Aucune lecture, aucune écriture : les trois
 * nombres qu'elle compare viennent du journal et de l'appelant. C'est ce qui permet
 * de l'éprouver sans base et sans dépense.
 */
export function withinCeiling(
  ceiling: SpendCeiling,
  input: {
    /** Combien de sujets on s'apprête à faire rédiger. */
    topics: number;
    /** Ce que ce mois a DÉJÀ coûté, reprise comprise. */
    spentUsd: number;
  }
): CeilingVerdict {
  /*
   * ⚠ LE NOMBRE D'ABORD. Il ne dépend d'aucune estimation, donc il refuse même
   * quand le prix par post est faux — et c'est le cas que F58 nomme : une liste de
   * sujets qui suit la banque.
   */
  if (input.topics > ceiling.maxTopics) {
    return {
      ok: false,
      bound: "count",
      refusal:
        `refus avant tout appel : ${input.topics} sujets à rédiger pour un plafond de ` +
        `${ceiling.maxTopics} — la liste suit la banque au lieu de suivre l'abonnement. ` +
        `Rien n'a été rédigé et rien n'a été dépensé.`,
    };
  }

  const estimateUsd = input.topics * ceiling.estimatedCostPerPostUsd;
  /*
   * ⚠ ON COMPARE LE TOTAL DU MOIS, PAS L'APPEL. Un plafond par appel se contourne
   * en appelant deux fois, et une reprise le fait par construction : elle repart
   * avec ce que le premier passage a déjà payé.
   */
  if (input.spentUsd + estimateUsd > ceiling.capUsd) {
    return {
      ok: false,
      bound: "spend",
      refusal:
        `refus avant tout appel : ${input.spentUsd.toFixed(4)} $ déjà dépensés plus ` +
        `${estimateUsd.toFixed(4)} $ estimés (${input.topics} × ` +
        `${ceiling.estimatedCostPerPostUsd.toFixed(4)} $) franchiraient le plafond de ` +
        `${ceiling.capUsd.toFixed(2)} $. Rien n'a été rédigé et rien n'a été dépensé.`,
    };
  }

  return { ok: true, estimateUsd };
}
