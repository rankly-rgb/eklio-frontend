import type { ContrastPair, ContrastReport } from "@/lib/site/types";

/*
 * Le rapport de contraste, LU — jamais recalculé.
 *
 * Les ratios arrivent en `numeric` exact, arrondis à deux décimales, et
 * `level` est dérivé du ratio ARRONDI : les deux ne peuvent pas se
 * contredire. Une implémentation en flottant côté client, elle, tombera un
 * jour à côté sur une frontière, et la praticienne lira « 4.50 » à côté du
 * mot « fail ». Ce module ne fait donc que mettre en forme.
 */

/** Le seuil AA du texte courant. C'est LUI la cible, y compris pour AA_large. */
export const AA_THRESHOLD = 4.5;

/** `4.51:1 · AA` — la ligne mono d'une paire. */
export function pairReading(pair: ContrastPair): string {
  return `${pair.ratio.toFixed(2)}:1 · ${pair.level === "AA_large" ? "AA large" : pair.level}`;
}

/**
 * La paire est-elle en dessous d'AA ?
 *
 * `AA_large` compte comme un échec ici, et c'est voulu : le seuil de 3:1 est
 * celui du GRAND texte, or ces sept paires mesurent du texte courant. Le
 * contrat le dit — une paire `AA_large` porte un `suggested_fix`, parce que la
 * cible est 4.5.
 */
export function isBelowAa(pair: ContrastPair): boolean {
  return pair.ratio < AA_THRESHOLD;
}

/** La pastille du haut : « AA verified — 4.51:1 » ou « 2 pairs below AA ». */
export function contrastSummary(contrast: ContrastReport): {
  passes: boolean;
  label: string;
  failing: number;
} {
  const failing = contrast.pairs.filter(isBelowAa).length;

  if (contrast.passes_aa) {
    return {
      passes: true,
      label: `AA verified — ${contrast.worst_ratio.toFixed(2)}:1`,
      failing: 0,
    };
  }

  return {
    passes: false,
    label: failing === 1 ? "1 pair below AA" : `${failing} pairs below AA`,
    failing,
  };
}

/**
 * La prochaine paire à corriger : LA PIRE qui propose un correctif.
 *
 * L'ordre compte, et il a été mesuré. Sur CLAY & SAND, corriger
 * `secondary_on_paper` (2.80) d'abord puis `primary_on_paper` finit en deux
 * écritures ; l'ordre inverse en gaspille une, parce que la suggestion du
 * premier correctif est recalculée de toute façon.
 *
 * Renvoie `null` quand tout passe, ou quand aucune paire restante n'a de
 * correctif — le second cas du §4 : aucune clarté de cette couleur n'atteint
 * 4.5:1 sans sortir de la bande où la teinte existe encore. Il faut alors
 * s'arrêter et montrer l'avertissement, pas boucler.
 */
export function nextPairToFix(contrast: ContrastReport): ContrastPair | null {
  const candidates = contrast.pairs.filter(
    (pair) => isBelowAa(pair) && pair.suggested_fix !== null
  );
  if (candidates.length === 0) return null;

  return candidates.reduce((worst, pair) => (pair.ratio < worst.ratio ? pair : worst));
}

/**
 * Reste-t-il une paire en échec que RIEN ne peut corriger ?
 *
 * C'est ce qui doit être dit à la fin d'une boucle « tout corriger » : on n'a
 * pas fini, et il n'y a rien de plus à appliquer.
 */
export function hasUnfixableFailure(contrast: ContrastReport): boolean {
  return contrast.pairs.some((pair) => isBelowAa(pair) && pair.suggested_fix === null);
}

/**
 * Le plafond de la boucle « tout corriger ».
 *
 * Quatre est généreux : le pire cas observé sur les six familles livrées est
 * deux. La boucle termine parce que chaque correctif pousse son jeton vers la
 * clarté opposée à celle de la surface, et que `paper` et `light_neutral` ne
 * bougent jamais — la cible est fixe. Le plafond est là pour le jour où une
 * palette éditée à la main sort de ce raisonnement.
 */
export const FIX_ALL_MAX_STEPS = 4;
