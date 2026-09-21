/*
 * ── THE WORD BUDGET, CHECKED BEFORE ANYTHING IS DRAWN ───────────────────
 *
 * The database already refuses a malformed payload (`content_topic_payload_
 * valid`, backend `20260920150000`): a quadrant with three items, a label of
 * four words, a gloss of seven. This is the same rule on the near side of the
 * wire, and it exists for a reason the CHECK cannot serve: the renderer is
 * handed payloads that have not been to the database yet — a live preview, a
 * layout alternative, a test fixture.
 *
 * ⚠ A PAYLOAD OVER BUDGET IS REJECTED, NEVER TRUNCATED. Cutting a therapist's
 * sentence to make it fit produces a card that says something she did not say,
 * and it produces it silently. The pipeline's answer to a rejection is to
 * regenerate the copy, which is the only honest one.
 */

export type BudgetError = { path: string; said: number; allowed: number };

export function words(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/** Word bounds per archetype, mirroring the SQL validator exactly. */
export const BUDGET = {
  label: { min: 1, max: 3 },
  gloss: { min: 1, max: 6 },
  axis: { min: 1, max: 3 },
  statement: { min: 3, max: 24 },
  practitionerLine: { min: 1, max: 8 },
  /** The eyebrow is mono and one line. Beyond this it wraps, and a wrapped eyebrow is a headline. */
  eyebrow: { min: 1, max: 6 },
  headline: { min: 2, max: 14 },
  footer: { min: 1, max: 6 },
} as const;

function check(
  errors: BudgetError[],
  path: string,
  text: unknown,
  bound: { min: number; max: number }
): void {
  if (typeof text !== "string") {
    errors.push({ path, said: -1, allowed: bound.max });
    return;
  }
  const n = words(text);
  if (n < bound.min || n > bound.max) errors.push({ path, said: n, allowed: bound.max });
}

/** Un seul objet `{label, gloss}`, sous son VRAI chemin. */
function checkItem(errors: BudgetError[], path: string, item: unknown): void {
  const it = item as Record<string, unknown> | undefined;
  check(errors, `${path}.label`, it?.label, BUDGET.label);
  check(errors, `${path}.gloss`, it?.gloss, BUDGET.gloss);
}

function checkItems(errors: BudgetError[], path: string, items: unknown): void {
  if (!Array.isArray(items)) {
    errors.push({ path, said: -1, allowed: 0 });
    return;
  }
  items.forEach((item, i) => {
    const it = item as Record<string, unknown>;
    check(errors, `${path}[${i}].label`, it?.label, BUDGET.label);
    check(errors, `${path}[${i}].gloss`, it?.gloss, BUDGET.gloss);
  });
}

/**
 * Every budget violation in this payload, or an empty array.
 *
 * ⚠ EVERY violation, not the first. A generator handed one error at a time
 * makes one fix at a time, and a caption with three long glosses takes three
 * round trips to a paid model to discover that.
 */
export function budgetErrors(archetype: string, payload: unknown): BudgetError[] {
  const errors: BudgetError[] = [];
  const p = (payload ?? {}) as Record<string, unknown>;

  switch (archetype) {
    case "single_statement":
      check(errors, "statement", p.statement, BUDGET.statement);
      break;
    case "quadrant_model":
      check(errors, "axis_x", p.axis_x, BUDGET.axis);
      check(errors, "axis_y", p.axis_y, BUDGET.axis);
      checkItems(errors, "items", p.items);
      break;
    case "cycle":
      checkItems(errors, "nodes", p.nodes);
      break;
    case "surface_and_beneath":
      /*
       * ⚠ `surface` ET `beneath`, PAS `pair[0]` ET `pair[1]`. Ce chemin-là
       * n'existe nulle part dans le payload : il était fabriqué pour réutiliser
       * `checkItems`, et il a tenu tant que personne n'a essayé de S'EN SERVIR.
       *
       * Le 2026-09-21, la réparation champ par champ a essayé. Elle lit le
       * texte à réécrire au chemin que l'erreur donne, n'a rien trouvé, n'a
       * rien réécrit, et a compté huit échecs qu'elle aurait pu corriger. Un
       * chemin d'erreur est une adresse ; une adresse qui ne mène nulle part
       * est pire qu'une erreur sans adresse, parce qu'elle a l'air d'en être
       * une.
       */
      checkItem(errors, "surface", p.surface);
      checkItem(errors, "beneath", p.beneath);
      break;
    case "comparison_pair":
      checkItems(errors, "left", p.left);
      checkItems(errors, "right", p.right);
      break;
    case "numbered_strategies":
    case "lettered_technique":
      checkItems(errors, "items", p.items);
      break;
    case "concentric_control":
      checkItems(errors, "rings", p.rings);
      break;
    case "annotated_curve":
      check(errors, "axis_x", p.axis_x, BUDGET.axis);
      check(errors, "axis_y", p.axis_y, BUDGET.axis);
      checkItems(errors, "points", p.points);
      break;
    case "practitioner_card": {
      const lines = Array.isArray(p.lines) ? p.lines : [];
      lines.forEach((line, i) => check(errors, `lines[${i}]`, line, BUDGET.practitionerLine));
      break;
    }
    case "carousel": {
      const cards = Array.isArray(p.cards) ? p.cards : [];
      cards.forEach((card, i) => {
        const c = card as Record<string, unknown>;
        budgetErrors(String(c?.archetype_key ?? ""), c?.payload).forEach((e) =>
          errors.push({ ...e, path: `cards[${i}].${e.path}` })
        );
      });
      break;
    }
    default:
      errors.push({ path: "archetype", said: -1, allowed: 0 });
  }

  return errors;
}

/** Thrown by `render` when the payload was over budget. Named, so a pipeline can tell it from a bug. */
export class BudgetExceededError extends Error {
  readonly errors: BudgetError[];
  constructor(archetype: string, errors: BudgetError[]) {
    super(
      `${archetype}: payload over the word budget — ` +
        errors.map((e) => `${e.path} has ${e.said}, allowed ${e.allowed}`).join("; ")
    );
    this.name = "BudgetExceededError";
    this.errors = errors;
  }
}
