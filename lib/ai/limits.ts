/**
 * Les bornes de rendu des directions, telles que la base les publie
 * (`site_catalog().direction_limits`), et le validateur qui les applique
 * AVANT l'insert.
 *
 * ⚠ Le CHECK part à l'INSERT, quand l'appel au modèle est déjà payé. Une
 * direction refusée après paiement est une génération payée qui n'a rien
 * produit, et le CHECK ne peut rien lui rendre de mieux qu'un 400. Donc :
 * on valide ici, et on rejoue.
 *
 * ⚠ Ne pas borner la génération avec `site_spec_limits` : un titre de
 * direction fait 46 caractères, un titre de spec de site en fait 90. Ce sont
 * deux écrans différents.
 */

export type DirectionLimits = {
  name: number;
  name_words_max: number;
  rationale_min: number;
  rationale_max: number;
  hero_headline: number;
  hero_subhead: number;
  tone_keywords_count: number;
  tone_keywords_joined: number;
  directions_count: number;
};

/** Le seul repli si le catalogue est injoignable — jamais la source de vérité. */
export const FALLBACK_DIRECTION_LIMITS: DirectionLimits = {
  name: 20,
  name_words_max: 2,
  rationale_min: 60,
  rationale_max: 95,
  hero_headline: 46,
  hero_subhead: 60,
  tone_keywords_count: 3,
  tone_keywords_joined: 32,
  directions_count: 3,
};

export const TONE_KEYWORD_SEPARATOR = " · ";

/** Les cinq clés obligatoires de la palette. `accent` est admis en plus. */
export const PALETTE_KEYS = ["primary", "secondary", "light", "dark", "paper"] as const;

export type GeneratedDirection = {
  id: string;
  name: string;
  rationale: string;
  about_excerpt: string;
  type_pairing_id: string;
  palette: Record<string, string>;
  hero: { overline: string; headline: string; subhead: string; cta_label: string };
  tone_keywords: string[];
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Rend la liste des violations, vide si tout passe. Le texte de chaque
 * violation est renvoyé tel quel au modèle pour la reprise : il doit dire
 * quoi corriger, pas seulement que c'est faux.
 */
export function validateDirections(
  directions: GeneratedDirection[],
  limits: DirectionLimits,
  validPairingIds: string[]
): string[] {
  const problems: string[] = [];

  if (directions.length !== limits.directions_count) {
    problems.push(
      `Return exactly ${limits.directions_count} directions; got ${directions.length}.`
    );
    return problems;
  }

  const ids = new Set(directions.map((d) => d.id));
  if (ids.size !== directions.length) problems.push("The three direction ids must be distinct.");

  const pairings = new Set(directions.map((d) => d.type_pairing_id));
  if (pairings.size !== directions.length) {
    problems.push(
      "Each direction must use a different type_pairing_id — three cards in the same heading font read as one direction shown three times."
    );
  }

  directions.forEach((d, i) => {
    const at = `Direction ${i + 1} ("${d.name}")`;

    if (d.name.length > limits.name) {
      problems.push(`${at}: name is ${d.name.length} characters, the limit is ${limits.name}.`);
    }
    const words = d.name.trim().split(/\s+/).filter(Boolean).length;
    if (words < 1 || words > limits.name_words_max) {
      problems.push(`${at}: name must be one or two words; it has ${words}.`);
    }

    if (d.rationale.length < limits.rationale_min || d.rationale.length > limits.rationale_max) {
      problems.push(
        `${at}: rationale is ${d.rationale.length} characters. It must be between ${limits.rationale_min} and ${limits.rationale_max}, both ends.`
      );
    }

    if (d.hero.headline.length > limits.hero_headline) {
      problems.push(
        `${at}: hero.headline is ${d.hero.headline.length} characters, the limit is ${limits.hero_headline}.`
      );
    }
    if (d.hero.subhead.length > limits.hero_subhead) {
      problems.push(
        `${at}: hero.subhead is ${d.hero.subhead.length} characters, the limit is ${limits.hero_subhead}.`
      );
    }

    if (d.tone_keywords.length !== limits.tone_keywords_count) {
      problems.push(
        `${at}: tone_keywords must have exactly ${limits.tone_keywords_count} entries; got ${d.tone_keywords.length}.`
      );
    }
    if (d.tone_keywords.some((k) => /\s/.test(k) || k.length === 0)) {
      problems.push(`${at}: every tone keyword must be a single word with no spaces.`);
    }
    const joined = d.tone_keywords.join(TONE_KEYWORD_SEPARATOR);
    if (joined.length > limits.tone_keywords_joined) {
      problems.push(
        `${at}: the tone keywords joined with " · " are ${joined.length} characters, the limit is ${limits.tone_keywords_joined}. Use shorter words.`
      );
    }

    for (const key of PALETTE_KEYS) {
      const value = d.palette?.[key];
      if (typeof value !== "string" || !HEX.test(value)) {
        problems.push(`${at}: palette.${key} must be a hex value like #3B2C3A.`);
      }
    }
    if (d.palette?.accent !== undefined && !HEX.test(d.palette.accent)) {
      problems.push(`${at}: palette.accent, when present, must be a hex value like #3B2C3A.`);
    }

    if (!validPairingIds.includes(d.type_pairing_id)) {
      problems.push(
        `${at}: type_pairing_id must be one of ${validPairingIds.join(", ")}.`
      );
    }

    for (const field of ["overline", "headline", "subhead", "cta_label"] as const) {
      if (typeof d.hero[field] !== "string" || d.hero[field].length === 0) {
        problems.push(`${at}: hero.${field} must be a non-empty string.`);
      }
    }
  });

  return problems;
}
