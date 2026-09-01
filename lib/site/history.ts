import type { SiteSpec } from "@/lib/site/types";

/*
 * L'historique d'annulation — les 50 derniers états du spec, côté client.
 *
 * Il porte des INSTANTANÉS, pas des opérations inverses. Une opération inverse
 * suppose qu'on sache défaire tout ce que la base a fait avec l'écriture :
 * or un correctif de contraste déplace un jeton ET recalcule quatre variantes,
 * un reset réécrit une portée entière. L'instantané, lui, se restaure en
 * envoyant les clés qui diffèrent — sans rien supposer.
 *
 * Les variantes dérivées n'y sont pas : elles ne sont pas dans `spec`. Elles
 * reviennent recalculées avec l'enveloppe de l'annulation, comme de toute
 * autre écriture.
 */

export const HISTORY_LIMIT = 50;

export type SpecHistory = {
  past: SiteSpec[];
  present: SiteSpec;
  future: SiteSpec[];
};

/** Gabarit vide — `present` est posé au montage, depuis l'enveloppe initiale. */
export const EMPTY_HISTORY = {
  past: [] as SiteSpec[],
  future: [] as SiteSpec[],
} as const;

/**
 * Empile un état. Une écriture qui n'a rien changé au spec — un patch `{}`,
 * un champ remis à sa valeur — n'entre pas : elle donnerait un Cmd+Z sans
 * effet visible, et c'est exactement ce qui fait douter d'un annulateur.
 *
 * Empiler EFFACE le futur : c'est la règle de tout historique linéaire, et la
 * seule qui ne mente pas une fois qu'on a réédité après une annulation.
 */
export function pushHistory(history: SpecHistory, next: SiteSpec): SpecHistory {
  if (next.spec_version === history.present.spec_version) return history;

  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}
