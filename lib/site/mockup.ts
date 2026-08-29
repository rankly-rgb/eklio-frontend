import type { PreviewPage, PreviewSection, SectionFields } from "@/lib/site/types";

/*
 * Lecture du modèle de maquette. RIEN ne se recompose ici.
 *
 * Quelles pages apparaissent, quelles sections, dans quel ordre, et d'où vient
 * la copy de chacune : ce sont des décisions que la base a déjà prises. En
 * particulier la copy du hero vit dans `spec.hero` et celle de l'intro dans
 * `spec.about_excerpt` — la base les a DÉJÀ résolues dans
 * `preview.pages[].sections[].fields`. Les résoudre une seconde fois ici
 * ferait deux implémentations d'un même modèle, et le jour où elles divergent,
 * la maquette cesse de montrer ce que la praticienne va coller.
 *
 * Ce module ne fait donc que LIRE : un champ, une liste, la page courante.
 */

/** Une chaîne d'un `fields`, ou `null`. Une liste n'est pas une chaîne. */
export function fieldText(fields: SectionFields, key: string): string | null {
  const value = fields[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Une liste d'un `fields`, vide si le champ est absent ou n'est pas une liste. */
export function fieldItems(fields: SectionFields, key: string): string[] {
  const value = fields[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

/**
 * Les sections d'une page, prêtes à rendre.
 *
 * ⚠ `order` EST UNE CLÉ DE TRI, JAMAIS UN INDEX. Une section désactivée est
 * omise de `preview` et rien n'est renuméroté : la page Services de
 * l'enveloppe de référence porte `[1, 2, 4]`. Le tableau arrive déjà trié par
 * `order` puis par `key` — on le rend dans l'ordre où il arrive, et on ne se
 * sert de `order` ni comme position, ni comme dénominateur. « Section 4 sur
 * 4 » est faux sur cette page : il y en a trois.
 */
export function sectionsOf(page: PreviewPage): PreviewSection[] {
  return page.sections;
}

/** La page à afficher : celle demandée, sinon la première. */
export function activePage(
  pages: PreviewPage[],
  key: string | null
): PreviewPage | null {
  return pages.find((page) => page.key === key) ?? pages[0] ?? null;
}
