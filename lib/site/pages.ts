import type {
  SectionType,
  SiteCatalog,
  SpecPage,
  SpecSection,
} from "@/lib/site/types";

/*
 * Les pages et leurs sections — opérations pures sur `spec.pages`.
 *
 * Elles renvoient TOUJOURS le tableau complet : `site_spec_patch` fusionne les
 * clés de premier niveau, donc `pages` s'écrit en entier ou pas du tout. Le
 * découper en opérations partielles inventerait un protocole que la base
 * n'a pas.
 *
 * ⚠ `order` est une CLÉ DE TRI. Ces fonctions le manipulent comme telle : on
 * échange deux valeurs d'`order`, on n'énumère pas des positions. Une section
 * désactivée garde la sienne, et `preview` la retire sans renuméroter le reste
 * — c'est ce qui donne `[1, 2, 4]` sur la page Services.
 */

/** Trie une liste de sections comme la base le fait : par `order`, puis par `key`. */
export function sortSections(sections: SpecSection[]): SpecSection[] {
  return [...sections].sort(
    (a, b) => a.order - b.order || a.key.localeCompare(b.key)
  );
}

function mapPage(
  pages: SpecPage[],
  pageKey: string,
  transform: (page: SpecPage) => SpecPage
): SpecPage[] {
  return pages.map((page) => (page.key === pageKey ? transform(page) : page));
}

export function togglePage(
  pages: SpecPage[],
  pageKey: string,
  enabled: boolean
): SpecPage[] {
  return mapPage(pages, pageKey, (page) => ({ ...page, enabled }));
}

export function toggleSection(
  pages: SpecPage[],
  pageKey: string,
  sectionKey: string,
  enabled: boolean
): SpecPage[] {
  return mapPage(pages, pageKey, (page) => ({
    ...page,
    sections: page.sections.map((section) =>
      section.key === sectionKey ? { ...section, enabled } : section
    ),
  }));
}

/**
 * Déplace une section d'un cran.
 *
 * On ÉCHANGE les deux `order` plutôt que de renuméroter la page : renuméroter
 * ferait bouger des valeurs que personne n'a demandé de changer, et le tri de
 * la base ne s'en porterait pas mieux. Le voisin est le voisin DANS LE TRI —
 * sections désactivées comprises, puisqu'elles occupent bien une place dans
 * l'ordre.
 */
export function moveSection(
  pages: SpecPage[],
  pageKey: string,
  sectionKey: string,
  direction: -1 | 1
): SpecPage[] {
  return mapPage(pages, pageKey, (page) => {
    const sorted = sortSections(page.sections);
    const index = sorted.findIndex((section) => section.key === sectionKey);
    const neighbour = index + direction;
    if (index === -1 || neighbour < 0 || neighbour >= sorted.length) return page;

    const a = sorted[index];
    const b = sorted[neighbour];
    return {
      ...page,
      sections: page.sections.map((section) =>
        section.key === a.key
          ? { ...section, order: b.order }
          : section.key === b.key
            ? { ...section, order: a.order }
            : section
      ),
    };
  });
}

/** Déplace une section à la place d'une autre — la cible du glisser-déposer. */
export function reorderSection(
  pages: SpecPage[],
  pageKey: string,
  sectionKey: string,
  beforeKey: string
): SpecPage[] {
  return mapPage(pages, pageKey, (page) => {
    const sorted = sortSections(page.sections);
    const from = sorted.findIndex((section) => section.key === sectionKey);
    const to = sorted.findIndex((section) => section.key === beforeKey);
    if (from === -1 || to === -1 || from === to) return page;

    const moved = sorted.splice(from, 1)[0];
    sorted.splice(to, 0, moved);

    /*
     * Ici on RÉASSIGNE la suite des `order` existants dans leur nouvel ordre :
     * on réutilise exactement les mêmes valeurs, donc on n'en invente aucune,
     * et le trou laissé par une section désactivée reste un trou.
     */
    const values = sortSections(page.sections).map((section) => section.order);
    const next = new Map(sorted.map((section, index) => [section.key, values[index]]));

    return {
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        order: next.get(section.key) ?? section.order,
      })),
    };
  });
}

/** Une clé de section libre sur cette page — `faq`, puis `faq-2`, `faq-3`… */
function freeKey(page: SpecPage, type: string): string {
  const taken = new Set(page.sections.map((section) => section.key));
  if (!taken.has(type)) return type;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${type}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Ajoute une section en bas de la page.
 *
 * Les champs partent VIDES, dans la forme que `section_types.fields` décrit —
 * une chaîne pour `text` et `longtext`, un tableau pour `list`. Les
 * pré-remplir inventerait de la copy, et c'est précisément ce que ce produit
 * ne fait pas sans qu'on le lui demande.
 */
export function addSection(
  pages: SpecPage[],
  pageKey: string,
  sectionType: SectionType
): SpecPage[] {
  return mapPage(pages, pageKey, (page) => {
    const highest = page.sections.reduce(
      (max, section) => Math.max(max, section.order),
      0
    );
    const fields = Object.fromEntries(
      sectionType.fields.map((field) => [field.key, field.kind === "list" ? [] : ""])
    );

    return {
      ...page,
      sections: [
        ...page.sections,
        {
          key: freeKey(page, sectionType.type),
          type: sectionType.type,
          order: highest + 1,
          fields,
          enabled: true,
        },
      ],
    };
  });
}

export function removeSection(
  pages: SpecPage[],
  pageKey: string,
  sectionKey: string
): SpecPage[] {
  return mapPage(pages, pageKey, (page) => ({
    ...page,
    sections: page.sections.filter((section) => section.key !== sectionKey),
  }));
}

/**
 * Les types de section qu'on peut ajouter à une page.
 *
 * Filtrés par `allowed_pages` : une section posée hors de ses pages autorisées
 * est refusée avec `invalid_field` sur `pages`, et le refus arriverait après
 * coup, sur un contrôle qui n'a rien fait de mal. Mieux vaut ne pas la
 * proposer.
 *
 * `hero` et `intro` sont écartés une fois posés : ils lisent une colonne de
 * haut niveau (`spec.hero`, `spec.about_excerpt`), donc en mettre deux sur la
 * même page afficherait deux fois la même chose.
 */
const SINGLE_PER_PAGE = new Set(["hero", "intro", "footer"]);

export function addableSectionTypes(
  catalog: SiteCatalog,
  page: SpecPage
): SectionType[] {
  const present = new Set(page.sections.map((section) => section.type));

  return catalog.section_types.filter(
    (type) =>
      type.active &&
      type.allowed_pages.includes(page.key) &&
      !(SINGLE_PER_PAGE.has(type.type) && present.has(type.type))
  );
}

/** Le type de section d'un `type`, pour son libellé et ses champs. */
export function sectionTypeOf(
  catalog: SiteCatalog,
  type: string
): SectionType | null {
  return catalog.section_types.find((entry) => entry.type === type) ?? null;
}

/**
 * Le libellé d'une section, tel que le catalogue le donne.
 *
 * Repli sur le `type` brut plutôt que sur une chaîne inventée : un type que
 * la base a ajouté et que le catalogue en cache ne connaît pas encore doit
 * rester identifiable, pas devenir « Section ».
 */
export function sectionLabel(catalog: SiteCatalog, section: SpecSection): string {
  return sectionTypeOf(catalog, section.type)?.label ?? section.type;
}
