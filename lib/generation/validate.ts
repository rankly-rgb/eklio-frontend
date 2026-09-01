import { TONE_KEYWORD_SEPARATOR } from "@/lib/brand/shapes";

/*
 * Les contraintes de RENDU que la base impose, vérifiées AVANT l'écriture.
 *
 * Chacune vient d'un CHECK lu dans le projet US, et chacune a une raison
 * géométrique qui est citée en commentaire là-bas : la carte de direction
 * réserve deux lignes pour la justification, le titre est rendu à 27px dans
 * une maquette de 250px, la ligne de mots-clés est en `nowrap`.
 *
 * Les vérifier ici, et reprendre le champ fautif UNE FOIS (§7), est ce qui
 * évite qu'un CHECK rejeté remonte en 500 sur l'écran de révélation d'un
 * praticien qui vient d'attendre une minute.
 */

export type FieldConstraint = {
  /** Chemin lisible, repris dans les logs et dans la consigne de reprise. */
  field: string;
  /** Contrainte exprimée pour un humain — et pour le modèle. */
  requirement: string;
  ok: (value: string) => boolean;
};

const words = (value: string) => value.trim().split(/\s+/).filter(Boolean);

/** `directions[].name` — 20 caractères au plus, et un ou deux mots. */
export const nameConstraint = (field: string): FieldConstraint => ({
  field,
  requirement:
    "one or two words, 20 characters at most, no punctuation at the end",
  ok: (value) =>
    value.length <= 20 && words(value).length >= 1 && words(value).length <= 2,
});

/** `directions[].rationale` — entre 60 et 95 caractères. */
export const rationaleConstraint = (field: string): FieldConstraint => ({
  field,
  requirement: "between 60 and 95 characters, a single sentence",
  ok: (value) => value.length >= 60 && value.length <= 95,
});

export const maxLengthConstraint = (
  field: string,
  max: number,
  shape: string
): FieldConstraint => ({
  field,
  requirement: `${max} characters at most — ${shape}`,
  ok: (value) => value.length <= max,
});

/**
 * `directions[].tone_keywords` — trois mots sans espace, joints par « · » sur
 * 32 caractères au plus.
 *
 * Vérifié sur la ligne JOINTE, pas mot à mot : c'est la ligne entière qui est
 * en `white-space: nowrap` sous la carte.
 */
export function toneKeywordsIssue(keywords: string[]): string | null {
  if (keywords.length !== 3) return "exactly three keywords";
  if (keywords.some((word) => /\s/.test(word.trim()) || word.trim() === "")) {
    return "three single words, no spaces inside a word";
  }
  const joined = keywords.map((word) => word.trim()).join(TONE_KEYWORD_SEPARATOR);
  if (joined.length > 32) {
    return `three short single words — joined they must stay under 33 characters (currently ${joined.length})`;
  }
  return null;
}

export type FieldFailure = {
  field: string;
  requirement: string;
  value: string;
};

/** Les champs qui ne passent pas, avec ce qu'on attend d'eux. */
export function failures(
  checks: { constraint: FieldConstraint; value: string }[]
): FieldFailure[] {
  return checks
    .filter(({ constraint, value }) => !constraint.ok(value))
    .map(({ constraint, value }) => ({
      field: constraint.field,
      requirement: constraint.requirement,
      value,
    }));
}

/**
 * La consigne de reprise d'un champ.
 *
 * Elle CITE la valeur refusée et la contrainte : un « fais plus court »
 * générique n'atterrit pas. Elle rappelle aussi la déontologie, parce qu'un
 * champ raccourci est un champ réécrit.
 */
export function repairInstruction(failure: FieldFailure): string {
  return `Rewrite this line so it is ${failure.requirement}.

Current line (${failure.value.length} characters):
${failure.value}

Keep the same meaning and the same voice. Reply with the rewritten line only —
no quotes, no explanation, no trailing punctuation beyond what the line needs.
It is copy a licensed clinician may publish: no promise of results, no
timeframe, no guarantee, no client voice, no urgency, no superlative.`;
}

/**
 * Dernier recours quand la reprise échoue elle aussi : couper sur une frontière
 * de mot.
 *
 * Ne s'applique qu'aux contraintes de MAXIMUM. Une justification trop COURTE ne
 * se répare pas en coupant — elle fait échouer la génération, et le praticien
 * relance. Mieux vaut ça qu'une carte au texte tronqué en plein mot.
 */
export function truncateOnWordBoundary(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
