import { render, renderCarousel, CompositionError, type RenderResult } from "@/lib/compose/engine";
import { BudgetExceededError, budgetErrors, words } from "@/lib/compose/budget";
import type { RenderInput } from "@/lib/compose/types";

/*
 * ── QUAND UNE CARTE NE TIENT PAS, ELLE SE REPLIE ────────────────────────
 *
 * Jusqu'ici, `render` levait et l'appelant jetait le post. Cinq posts sur
 * seize sont morts comme ça au premier mois réel, et le moteur NOMMAIT le
 * remède dans son propre message — « break to a carousel » — que personne
 * n'appliquait.
 *
 * L'échelle, dans cet ordre :
 *
 *   1. l'archétype le plus proche qui porte MOINS de libellés ;
 *   2. un carrousel, une idée par carte ;
 *   3. une carte à une phrase.
 *
 * ⚠ CE N'EST PAS UN RELÂCHEMENT. Chaque marche repasse par `render`, donc par
 * les mêmes planchers typographiques, les mêmes dégagements, le même contrôle
 * de lisibilité à 350px et le même budget de mots. Une marche qui ne tient pas
 * est refusée comme le reste ; on essaie une forme plus simple, jamais un
 * réglage plus permissif. La résolution interne de `render` — réduire
 * l'illustration, puis laisser tomber les glosses — continue de jouer À
 * L'INTÉRIEUR de chaque marche.
 *
 * ⚠ ET RIEN N'EST INVENTÉ. Chaque repli n'utilise que des mots déjà écrits
 * pour ce post : les libellés, leurs glosses, et la ligne de carte. Une forme
 * plus simple qui ajouterait une phrase serait une phrase que personne n'a
 * relue.
 */

export type ComposedCard = {
  kind: "card";
  archetype: string;
  /**
   * Le payload RÉELLEMENT composé.
   *
   * ⚠ PAS CELUI QU'ON A DEMANDÉ. Un repli change la forme ; enregistrer
   * l'ancienne sur le post donnerait une carte que l'écran de relecture ne
   * saurait pas redessiner, et un téléchargement qui ne ressemble pas à ce
   * qu'elle a vu.
   */
  payload: unknown;
  result: RenderResult;
  /** Ce qu'il a fallu faire, dans l'ordre, pour arriver là. */
  steps: string[];
};

export type ComposedCarousel = {
  kind: "carousel";
  archetype: "carousel";
  /** Le payload du carrousel, cartes comprises. */
  payload: unknown;
  slides: RenderResult[];
  steps: string[];
};

export type Composed = ComposedCard | ComposedCarousel;

type Item = { label: string; gloss?: string };

/** Les entrées d'un payload, quelle que soit la clef sous laquelle il les range. */
export function entriesOf(payload: unknown): Item[] {
  const p = (payload ?? {}) as Record<string, unknown>;
  for (const key of ["items", "nodes", "rings", "points"]) {
    const list = p[key];
    if (Array.isArray(list)) return list as Item[];
  }
  if (Array.isArray(p.left) && Array.isArray(p.right)) {
    return [...(p.left as Item[]), ...(p.right as Item[])];
  }
  if (p.surface && p.beneath) return [p.surface as Item, p.beneath as Item];
  if (Array.isArray(p.lines)) {
    return (p.lines as string[]).map((line) => ({ label: line }));
  }
  return [];
}

/**
 * Une phrase à partir d'une entrée, au budget de `single_statement` (3 à 24
 * mots). La glose rejoint le libellé quand les deux tiennent ; sinon le
 * libellé part seul, et s'il est trop court pour trois mots, l'entrée est
 * écartée plutôt que rallongée.
 */
function statementFrom(item: Item): string | null {
  const full = item.gloss ? `${item.label} — ${item.gloss}` : item.label;
  for (const candidate of [full, item.label]) {
    const n = words(candidate);
    if (n >= 3 && n <= 24) return candidate;
  }
  return null;
}

function tryRender(input: RenderInput, archetype: string, payload: unknown): RenderResult | null {
  if (budgetErrors(archetype, payload).length > 0) return null;
  try {
    return render({ ...input, archetype, payload });
  } catch (error) {
    if (error instanceof CompositionError || error instanceof BudgetExceededError) return null;
    throw error;
  }
}

/**
 * Les formes vers lesquelles un repli a le droit de descendre.
 *
 * ── ⚠ IL N'Y EN AVAIT QU'UNE, ET C'EST CE QUI A VIDÉ LE MOIS ────────────
 *
 * La marche 1 envoyait TOUT sur `surface_and_beneath`. À l'époque cet
 * archétype ne portait qu'un trait horizontal entre deux aplats, et le repli
 * s'en servait comme d'un fourre-tout : neuf cartes sur trente du mois rendu
 * ont fini là, c'est-à-dire en « deux boîtes séparées par un trait ». Le
 * défaut n'était pas le repli — une carte repliée vaut mieux qu'un post
 * perdu — c'était qu'il n'avait qu'une destination, et qu'elle était nue.
 *
 * Chaque destination ici porte une illustration de la bibliothèque, et elles
 * sont essayées de la plus riche à la plus pauvre : on garde le plus de
 * libellés possible, et on n'arrive à deux que si rien au-dessus ne tient.
 *
 * ⚠ AUCUNE NE FABRIQUE DE MOTS. Chaque adaptateur ne fait que RANGER
 * autrement des libellés et des glosses déjà écrits pour ce post.
 */
type Narrowing = { archetype: string; adapt: (entries: Item[]) => unknown | null };

const item = (e: Item): Item => ({ label: e.label, gloss: e.gloss ?? e.label });

const NARROWINGS: Narrowing[] = [
  // Trois à cinq entrées, sur une épine, avec la plante : la forme la plus
  // proche d'une liste, et celle qui en garde le plus.
  {
    archetype: "numbered_strategies",
    adapt: (e) => (e.length >= 3 ? { items: e.slice(0, 5).map(item) } : null),
  },
  // Trois à six : le fil noué.
  {
    archetype: "cycle",
    adapt: (e) => (e.length >= 3 ? { nodes: e.slice(0, 6).map(item) } : null),
  },
  // Deux à quatre : les anneaux, la silhouette assise au centre.
  {
    archetype: "concentric_control",
    adapt: (e) => (e.length >= 2 ? { rings: e.slice(0, 4).map(item) } : null),
  },
  /*
   * Deux, la ligne d'eau. ⚠ C'EST LE PLUS PETIT DIAGRAMME QUI RESTE UN
   * DIAGRAMME. Descendre à un libellé, ce n'est plus une forme, c'est une
   * phrase — et c'est la marche 3.
   */
  {
    archetype: "surface_and_beneath",
    adapt: (e) =>
      e.length >= 2 && e[0]?.label && e[1]?.label
        ? { surface: item(e[0]), beneath: item(e[1]) }
        : null,
  },
];

export function composeWithFallback(
  input: RenderInput,
  /** La ligne de carte déjà écrite pour ce post, pour la marche 3. */
  cardLine?: string | null
): Composed {
  const steps: string[] = [];

  /* ── 0. Ce qui a été demandé ──────────────────────────────────────── */
  const asked = tryRender(input, input.archetype, input.payload);
  if (asked) return { kind: "card", archetype: input.archetype, payload: input.payload, result: asked, steps };

  /* ── 1. Moins de libellés, mais toujours une illustration ─────────── */
  const entries = entriesOf(input.payload);
  for (const { archetype, adapt } of NARROWINGS) {
    if (archetype === input.archetype) continue;
    const narrow = adapt(entries);
    if (!narrow) continue;
    const result = tryRender(input, archetype, narrow);
    if (result) {
      steps.push(`${input.archetype} → ${archetype} (fewer labels, still drawn)`);
      return { kind: "card", archetype, payload: narrow, result, steps };
    }
    steps.push(`${archetype} refused too`);
  }

  /* ── 2. Un carrousel, une idée par carte ──────────────────────────── */
  const statements = entries
    .map(statementFrom)
    .filter((s): s is string => s !== null);
  if (statements.length >= 3) {
    const cards = statements.slice(0, 8).map((statement) => ({
      archetype_key: "single_statement",
      payload: { statement },
    }));
    try {
      const slides = renderCarousel({ ...input, archetype: "carousel", payload: { cards } });
      steps.push(`${input.archetype} → carousel of ${cards.length} (one idea per card)`);
      return { kind: "carousel", archetype: "carousel", payload: { cards }, slides, steps };
    } catch (error) {
      if (!(error instanceof CompositionError || error instanceof BudgetExceededError)) throw error;
      steps.push("carousel refused too");
    }
  }

  /* ── 3. Une phrase ────────────────────────────────────────────────── */
  const line = (cardLine ?? input.headline ?? "").trim();
  for (const candidate of [line, ...statements]) {
    if (!candidate) continue;
    const result = tryRender(input, "single_statement", { statement: candidate });
    if (result) {
      steps.push(`${input.archetype} → single_statement (one line)`);
      return { kind: "card", archetype: "single_statement", payload: { statement: candidate }, result, steps };
    }
  }

  /*
   * ⚠ ET ON LÈVE ENCORE, PLUTÔT QUE DE RENDRE QUELQUE CHOSE. Une carte à une
   * phrase qui ne tient pas veut dire que la phrase elle-même ne se pose pas
   * au-dessus du plancher d'affichage. Il n'y a pas de forme plus simple.
   */
  throw new CompositionError(
    `${input.archetype}: nothing composes, down to a single line — ${steps.join("; ") || "no step taken"}`
  );
}
