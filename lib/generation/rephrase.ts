import { callRewrite } from "@/lib/generation/model";

/*
 * « Help me say it » (§2.1), pas « Write it for me ».
 *
 * La fonction de suggestion « Write it for me » (lib/generation/pipeline.ts)
 * ÉCRIT depuis le contexte du brief — c'est un premier jet. Ce module ne fait
 * QUE réécrire une phrase déjà
 * écrite : resserrer, jamais inventer. Volontairement hors de pipeline.ts et
 * de son socle déontologique (§8.11 / §9.11 côté contrat) : ce n'est pas la
 * même garantie — l'Ethics Guard empêche une PROMESSE, cette fonction empêche
 * un FAIT ajouté. Les deux textes qu'elle traite (`referral_quote`,
 * `not_a_fit_text`) ne sont d'ailleurs jamais publiés tels quels ; ils
 * alimentent la génération USP, qui a ses propres portes (§2.5).
 */

export const REPHRASE_MIN_CHARS = 40;

export const REPHRASABLE_FIELDS = ["referral_quote", "not_a_fit_text"] as const;
export type RephrasableField = (typeof REPHRASABLE_FIELDS)[number];

const FIELD_FRAMING: Record<RephrasableField, string> = {
  referral_quote:
    "This is what a colleague would say about this therapist, in the third person.",
  not_a_fit_text:
    "This names who this therapist is not the right fit for.",
};

const REPHRASE_SYSTEM_PROMPT = `You rewrite a single sentence or two for a therapist's private-practice brief. You do not draft, you do not add, you only tighten what is already there.

Rules, without exception:
- Never introduce a fact, name, credential, adjective, number, or claim that is not already present in the text you are given.
- Never add a proper noun (a person's name, a place, a diagnosis, a modality) that isn't already in the input.
- You may cut words, reorder, fix grammar, and sharpen the phrasing. That is the entire job.
- American English. Plain language. No exclamation marks, no hype words.
- Reply with the rewritten line only — no quotes, no explanation, no preamble.`;

export type RephraseCall = (system: string, instruction: string) => Promise<string>;

export class ProperNounIntroducedError extends Error {
  constructor(public readonly word: string) {
    super(`The rewrite introduced "${word}", which the original text didn't say.`);
    this.name = "ProperNounIntroducedError";
  }
}

/**
 * Un mot capitalisé, hors début de phrase, absent de l'original — le
 * meilleur signal DÉTERMINISTE d'un fait ajouté (§2.1 : « rejects a result
 * introducing a proper noun absent from the input »).
 *
 * Comparaison insensible à la casse : un mot déjà présent dans l'original,
 * même en minuscules, ne compte pas comme introduit.
 */
export function findIntroducedProperNoun(
  original: string,
  rewritten: string
): string | null {
  const knownWords = new Set(
    (original.match(/[A-Za-z]+/g) ?? []).map((word) => word.toLowerCase())
  );

  const sentences = rewritten.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const words = sentence.match(/[A-Za-z]+/g) ?? [];
    for (const [index, word] of words.entries()) {
      if (index === 0) continue; // Une majuscule de début de phrase ne compte pas.
      if (!/^[A-Z][a-z]+$/.test(word)) continue; // Ni un sigle tout en capitales (EMDR).
      if (!knownWords.has(word.toLowerCase())) return word;
    }
  }
  return null;
}

/**
 * Réécrit `text` sans y ajouter de fait. Lève `ProperNounIntroducedError` si
 * le résultat en introduit un malgré la consigne — la seule vérification
 * déterministe possible sur un texte libre, donc la seule sur laquelle
 * s'appuyer plutôt que de faire confiance au modèle.
 */
export async function rephrase(
  field: RephrasableField,
  text: string,
  rewriteCall: RephraseCall = callRewrite
): Promise<string> {
  const rewritten = await rewriteCall(
    REPHRASE_SYSTEM_PROMPT,
    `${FIELD_FRAMING[field]}\n\nOriginal text:\n${text}\n\nRewrite it tighter. Do not add anything it doesn't already say.`
  );

  const introduced = findIntroducedProperNoun(text, rewritten);
  if (introduced) throw new ProperNounIntroducedError(introduced);

  return rewritten;
}
