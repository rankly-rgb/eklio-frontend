/*
 * ── GATE 5 — LE REGISTRE : NI MODALITÉ, NI DÉMOGRAPHIE ──────────────────
 *
 * L'offre du 13 septembre dit, littéralement : « sa niche, formulée dans les
 * mots de ses patients, pas en modalités ni en démographie ».
 *
 * ⚠ LE PROMPT NE SUFFIT PAS, ET C'EST LA LEÇON DE CE DÉPÔT. Les quatre gates
 * existantes existent parce qu'« un modèle à qui on demande de retirer une
 * garantie produit souvent une garantie plus douce » (`lib/check/rewrite.ts`).
 * Le même raisonnement vaut ici : un modèle à qui on interdit « EMDR » écrira
 * « une approche fondée sur le retraitement des souvenirs ». Une gate
 * déterministe mesure ce qui est sorti, pas ce qui a été demandé.
 *
 * ── LA LISTE VIENT DE SON PROPRE BRIEF, ET C'EST CE QUI LA REND JUSTE ────
 *
 * On ne maintient PAS une liste universelle de modalités : elle serait
 * incomplète le jour de son écriture et fausse un mois plus tard. On compare
 * la phrase à ce qu'ELLE a coché — `modality_cards` pour les modalités,
 * `client_persona_cards` pour les personas. Deux conséquences, et les deux
 * sont voulues :
 *
 *   - une thérapeute EMDR est protégée contre « EMDR » sans qu'on ait à
 *     connaître EMDR ;
 *   - une modalité que personne n'a cochée ne peut pas apparaître dans la
 *     phrase, puisque la gate de spécificité exige déjà que chaque candidat
 *     reprenne un élément du brief.
 *
 * ⚠ LES ACRONYMES SONT LE SEUL AJOUT. Un catalogue porte « Cognitive
 * behavioral therapy » ; un modèle écrit « CBT ». Ce n'est pas une liste de
 * modalités, c'est la façon dont on écrit CELLES QU'ELLE A COCHÉES en abrégé,
 * dérivée de son propre libellé.
 */

/** Ce que la gate a besoin de savoir, et rien d'autre. */
export type RegisterVocabulary = {
  /** Les libellés des modalités qu'elle a cochées, longs et courts. */
  modalityLabels: readonly string[];
  /** Les libellés des personas qu'elle a cochés. */
  personaLabels: readonly string[];
};

export type RegisterVerdict =
  | { ok: true }
  | { ok: false; kind: "modality" | "demographic"; matched: string };

/**
 * L'acronyme d'un libellé : les initiales des mots significatifs.
 *
 * « Cognitive behavioral therapy » → `CBT`. « Eye movement desensitization
 * and reprocessing » → `EMDR` (les mots-outils sont écartés).
 *
 * ⚠ TROIS LETTRES AU MINIMUM. Deux lettres attrapent trop : `IT`, `AS`, `OF`
 * apparaissent dans du texte ordinaire, et une gate qui refuse une phrase
 * correcte coûte une régénération à chaque fois.
 */
export function acronymOf(label: string): string | null {
  const skip = new Set(["and", "of", "the", "for", "in", "on", "with", "to", "a", "an"]);
  const initials = label
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0 && !skip.has(word))
    .map((word) => word[0])
    .join("");
  return initials.length >= 3 ? initials.toUpperCase() : null;
}

/**
 * Une occurrence sur limite de mot, insensible à la casse.
 *
 * ⚠ LA LIMITE DE MOT N'EST PAS DÉCORATIVE — c'est la même discipline que
 * `usp_banned_phrases_check` en base (`\y … \y`) et que les patterns de
 * `lib/ethics/rules.ts`. Sans elle, « art » attrape « part », « started »,
 * « heartbreak ».
 */
function mentions(text: string, term: string): boolean {
  const cleaned = term.trim();
  if (cleaned.length < 3) return false;
  const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/**
 * La phrase reste-t-elle dans le registre de la patiente ?
 *
 * Rend le premier terme fautif plutôt qu'un booléen : la raison est renvoyée
 * au modèle lors de la reprise, et « évite les modalités » ne fait pas
 * atterrir une reprise — « le mot "EMDR" » si.
 */
export function checkRegister(
  statement: string,
  vocabulary: RegisterVocabulary
): RegisterVerdict {
  for (const label of vocabulary.modalityLabels) {
    if (mentions(statement, label)) {
      return { ok: false, kind: "modality", matched: label };
    }
    const acronym = acronymOf(label);
    if (acronym && mentions(statement, acronym)) {
      return { ok: false, kind: "modality", matched: acronym };
    }
  }

  for (const label of vocabulary.personaLabels) {
    /*
     * ⚠ UN PERSONA N'EST PAS TOUJOURS UNE DÉMOGRAPHIE, et la distinction est
     * celle que l'offre fait : « nommer une SITUATION de vie est permis,
     * nommer un segment de marché ne l'est pas ». Le catalogue mélange les
     * deux — « new parents » est une situation, « high-achieving
     * professionals » est un segment.
     *
     * On ne tranche donc pas sur le persona lui-même : on refuse la reprise
     * LITTÉRALE de son libellé, qui est la forme sous laquelle un segment de
     * marché arrive dans une phrase. Reformuler la situation dans les mots de
     * la personne reste permis, et c'est précisément ce qu'on demande.
     */
    if (mentions(statement, label)) {
      return { ok: false, kind: "demographic", matched: label };
    }
  }

  return { ok: true };
}

/** La raison, telle qu'elle repart au modèle à la reprise. */
export function registerReason(verdict: Extract<RegisterVerdict, { ok: false }>): string {
  return verdict.kind === "modality"
    ? `names the modality "${verdict.matched}" — say what the person is carrying, not how you work with it`
    : `reuses the segment label "${verdict.matched}" — name the situation in her own words, not the bracket`;
}
