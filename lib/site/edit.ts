import type {
  SectionType,
  SiteCatalog,
  SiteSpec,
  SpecPage,
} from "@/lib/site/types";
import { sectionTypeOf } from "@/lib/site/pages";

/*
 * L'édition en place — d'un texte de la maquette au patch qui l'écrit.
 *
 * ── Pourquoi un descripteur et pas un chemin en chaîne ──────────────────
 *
 * Une clé de section n'identifie PAS une section : `footer` existe sur les
 * quatre pages, `intro` sur deux, `contact` sur deux. Un chemin `footer.body`
 * écrirait la première trouvée. Le descripteur porte donc la page.
 *
 * ── Les deux exceptions du contrat ──────────────────────────────────────
 *
 * `hero` lit `spec.hero` et `intro` lit `spec.about_excerpt` : leur copy n'est
 * PAS dans les `fields` de la section, et se patche sur la colonne de haut
 * niveau. C'est `section_types.source` qui le dit, et c'est pour ça que ces
 * deux cibles sont des variantes à part ici.
 */

export type EditTarget =
  | { kind: "hero"; field: keyof SiteSpec["hero"] }
  | { kind: "about" }
  | {
      kind: "section";
      page: string;
      section: string;
      field: string;
      /** Renseigné quand le champ est une `list` : l'item édité. */
      index?: number;
    };

/** Deux descripteurs désignent-ils le même texte ? */
export function sameTarget(a: EditTarget | null, b: EditTarget | null): boolean {
  return a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b);
}

/** Le chemin que la base renvoie dans `error.field`, pour l'afficher au bon endroit. */
export function targetField(target: EditTarget): string {
  if (target.kind === "hero") return `hero.${String(target.field)}`;
  if (target.kind === "about") return "about_excerpt";
  return `pages.${target.page}.${target.section}.${target.field}`;
}

function setSectionField(
  pages: SpecPage[],
  target: Extract<EditTarget, { kind: "section" }>,
  value: string
): SpecPage[] {
  return pages.map((page) =>
    page.key !== target.page
      ? page
      : {
          ...page,
          sections: page.sections.map((section) => {
            if (section.key !== target.section) return section;

            if (target.index === undefined) {
              return { ...section, fields: { ...section.fields, [target.field]: value } };
            }

            const items = section.fields[target.field];
            const list = Array.isArray(items) ? [...items] : [];
            /*
             * Un item vidé est RETIRÉ, pas gardé en chaîne vide : la base
             * imprimerait « Areas 2 » suivi de rien dans les blocs de copy,
             * et le constructeur poserait une puce vide sur le site.
             */
            if (value.trim() === "") list.splice(target.index, 1);
            else list[target.index] = value;

            return { ...section, fields: { ...section.fields, [target.field]: list } };
          }),
        }
  );
}

/** Le patch qui écrit une valeur éditée en place. */
export function patchForTarget(
  spec: SiteSpec,
  target: EditTarget,
  value: string
): Partial<SiteSpec> {
  if (target.kind === "hero") {
    return { hero: { ...spec.hero, [target.field]: value } };
  }
  if (target.kind === "about") {
    return { about_excerpt: value };
  }
  return { pages: setSectionField(spec.pages, target, value) };
}

/** La valeur courante d'une cible, pour ouvrir le champ dessus. */
export function valueForTarget(spec: SiteSpec, target: EditTarget): string {
  if (target.kind === "hero") return spec.hero[target.field] ?? "";
  if (target.kind === "about") return spec.about_excerpt;

  const section = spec.pages
    .find((page) => page.key === target.page)
    ?.sections.find((entry) => entry.key === target.section);
  const field = section?.fields[target.field];

  if (target.index !== undefined) {
    return Array.isArray(field) ? (field[target.index] ?? "") : "";
  }
  return typeof field === "string" ? field : "";
}

/**
 * La limite d'un champ, LUE DANS LE CATALOGUE.
 *
 * `site_spec_limits` porte les plafonds des champs de haut niveau ;
 * `section_text` (800) est le plafond de TOUTE chaîne dans les `fields` d'une
 * section, item de liste compris. Quand `section_types.fields[].max_length`
 * est plus bas, c'est lui qui s'applique — on prend donc le plus petit des
 * deux, jamais une constante écrite ici.
 */
export function limitForTarget(
  catalog: SiteCatalog,
  spec: SiteSpec,
  target: EditTarget
): number {
  const limits = catalog.site_spec_limits;

  if (target.kind === "hero") {
    return {
      overline: limits.hero_overline,
      headline: limits.hero_headline,
      subhead: limits.hero_subhead,
      cta_label: limits.hero_cta_label,
      cta_target_url: limits.section_text,
    }[target.field];
  }
  if (target.kind === "about") return limits.about_excerpt;

  const type = spec.pages
    .find((page) => page.key === target.page)
    ?.sections.find((section) => section.key === target.section)?.type;
  const field = type
    ? sectionTypeOf(catalog, type)?.fields.find((entry) => entry.key === target.field)
    : null;

  return Math.min(field?.max_length ?? limits.section_text, limits.section_text);
}

/** Le seuil où le compteur passe en ambre : 90 % de la limite. */
export const COUNTER_WARNING_RATIO = 0.9;

export function counterTone(length: number, limit: number): "quiet" | "warning" | "over" {
  if (length > limit) return "over";
  return length >= limit * COUNTER_WARNING_RATIO ? "warning" : "quiet";
}

/** Les champs longs d'une section — ceux qu'on édite mieux dans le rail. */
export function longFieldsOf(
  catalog: SiteCatalog,
  type: string
): SectionType["fields"] {
  return (sectionTypeOf(catalog, type)?.fields ?? []).filter(
    (field) => field.kind === "longtext"
  );
}
