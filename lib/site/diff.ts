import type { SiteDiff, SiteSpecEnvelope } from "@/lib/site/types";

/*
 * La bannière de péremption — ce qui a changé DEPUIS la dernière copie.
 *
 * ── Pourquoi elle existe ─────────────────────────────────────────────────
 *
 * Le pire résultat possible de cet écran : elle modifie sa palette, s'en va,
 * et colle chez son constructeur les instructions qu'elle avait copiées avant.
 * Le site sort différent de la maquette qu'elle a vue, et rien ne le lui a dit.
 * `diff` existe pour ça, et il n'y a pas de raison plus discrète de l'afficher.
 *
 * ── Comment elle s'efface ────────────────────────────────────────────────
 *
 * Par `site_output_mark_copied`, et par rien d'autre : l'appel avance
 * `last_copied_spec_version` sur `spec_version`, et l'enveloppe retournée
 * porte `diff.stale = false`.
 *
 * L'etag bouge avec, depuis la migration `20260829116000`. Avant elle, un
 * client qui relisait après la copie recevait un 304 et gardait la bannière à
 * l'écran — la copie qui devait l'effacer ne l'effaçait pas.
 */

export type StalenessBanner = {
  visible: boolean;
  /** Les libellés du diff, dédupliqués : la base peut répéter une zone. */
  changes: string[];
  /** « Colors and copy changed since you copied this. » */
  headline: string;
};

/** Un nom lisible pour une zone du diff. Repli sur la zone brute. */
const AREA_LABEL: Record<string, string> = {
  colors: "Colors",
  typography: "Typography",
  copy: "Copy",
  structure: "Pages",
  details: "Your details",
  instructions: "Your notes",
};

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "Something";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export function stalenessBanner(diff: SiteDiff): StalenessBanner {
  const changes = [...new Set(diff.changes.map((change) => change.label))];
  const areas = [
    ...new Set(diff.changes.map((change) => AREA_LABEL[change.area] ?? change.area)),
  ];

  return {
    visible: diff.stale,
    changes,
    headline: `${joinWords(areas)} changed since you last copied this.`,
  };
}

/**
 * Le spec a-t-il dépassé la version copiée ?
 *
 * `diff.stale` FAIT FOI — c'est la base qui le calcule. Cette fonction ne sert
 * qu'à s'en assurer dans un test : les deux doivent toujours dire la même
 * chose, et si elles divergent, c'est `diff.stale` qui a raison.
 */
export function looksStale(envelope: SiteSpecEnvelope): boolean {
  const copied = envelope.spec.last_copied_spec_version;
  return copied === null || copied < envelope.spec.spec_version;
}
