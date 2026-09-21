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
 * Le voisin le plus proche qui porte moins de libellés.
 *
 * ⚠ DEUX, PAS TROIS. `surface_and_beneath` est le seul archétype du catalogue
 * à porter exactement deux libellés, et deux est le plus petit diagramme qui
 * reste un diagramme. Descendre à un, ce n'est plus une forme, c'est une
 * phrase — et c'est la marche 3.
 */
function narrower(payload: unknown): unknown | null {
  const entries = entriesOf(payload);
  if (entries.length < 2) return null;
  const [surface, beneath] = entries;
  if (!surface?.label || !beneath?.label) return null;
  return {
    surface: { label: surface.label, gloss: surface.gloss ?? surface.label },
    beneath: { label: beneath.label, gloss: beneath.gloss ?? beneath.label },
  };
}

export function composeWithFallback(
  input: RenderInput,
  /** La ligne de carte déjà écrite pour ce post, pour la marche 3. */
  cardLine?: string | null
): Composed {
  const steps: string[] = [];

  /* ── 0. Ce qui a été demandé ──────────────────────────────────────── */
  const asked = tryRender(input, input.archetype, input.payload);
  if (asked) return { kind: "card", archetype: input.archetype, payload: input.payload, result: asked, steps };

  /* ── 1. Moins de libellés ─────────────────────────────────────────── */
  if (input.archetype !== "surface_and_beneath") {
    const narrow = narrower(input.payload);
    if (narrow) {
      const result = tryRender(input, "surface_and_beneath", narrow);
      if (result) {
        steps.push(`${input.archetype} → surface_and_beneath (fewer labels)`);
        return { kind: "card", archetype: "surface_and_beneath", payload: narrow, result, steps };
      }
      steps.push(`surface_and_beneath refused too`);
    }
  }

  /* ── 2. Un carrousel, une idée par carte ──────────────────────────── */
  const statements = entriesOf(input.payload)
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
