import { firstSentence, openingFamilies } from "@/lib/content/variety";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA VARIÉTÉ SE CONTRÔLE OÙ LES SUJETS S'ÉCRIVENT (F80, 2026-11-04)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le mois de décembre récrit le 2026-11-04 a été refusé sur `variety.opening` :
 * 7 ouvertures en « when… », 6 en « an unwanted… », 5 en « EMDR is… ». Le
 * recensement de la banque (186 sujets, 6 segments) les y trouve déjà :
 *
 *   titres          46/186 commencent par « when » (25 %)
 *   lignes d'image  18 en « an unwanted / an unchosen », 17 en « EMDR is / does »
 *   « corriger un mythe »  37/186, dont 7 lignes d'image en « EMDR is »
 *
 * La ligne d'image d'un sujet passe TELLE QUELLE sur le post (`onImageText`) :
 * la banque impose ses ouvertures au mois, et le contrôle du mois ne peut que
 * les constater. Il est donc posé ici, au moment où un sujet entre dans son
 * segment, avec LA MÊME notion d'ouverture (`openingFamilies`) que celui du mois.
 *
 * ⚠ ON AJOUTE, ON NE RETIRE PAS. `topic_id` est en ON DELETE SET NULL : retirer
 * un sujet annule le lien de posts déjà écrits. Un segment déjà saturé le reste
 * jusqu'à ce que des sujets neufs le diluent ; ce contrôle garantit seulement
 * qu'aucun sujet neuf n'y ajoute.
 */

/** Part maximale des sujets d'un segment qui partagent une famille d'ouverture. */
export const BANK_OPENING_MAX_SHARE = 0.1;

/** Part maximale de l'intention « corriger un mythe » dans un segment. */
export const MYTH_MAX_SHARE = 0.2;
export const MYTH_INTENT = "correct_a_myth";

export function bankOpeningCap(n: number): number {
  return Math.max(2, Math.floor(n * BANK_OPENING_MAX_SHARE));
}

export type BankTopicText = { title: string; hook: string; intent: string };

/** Les familles d'ouverture d'un sujet : celles de son titre et de sa ligne d'image, préfixées. */
export function topicOpenings(t: Pick<BankTopicText, "title" | "hook">): string[] {
  return [
    ...openingFamilies(firstSentence(t.title)).map((f) => `title/${f}`),
    ...openingFamilies(firstSentence(t.hook)).map((f) => `hook/${f}`),
  ];
}

function counts(topics: Array<Pick<BankTopicText, "title" | "hook">>): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of topics) for (const f of new Set(topicOpenings(t))) out.set(f, (out.get(f) ?? 0) + 1);
  return out;
}

/** Les familles qu'un sujet neuf ne peut plus prendre dans ce segment : à dire au rédacteur. */
export function saturatedOpenings(segment: Array<Pick<BankTopicText, "title" | "hook">>): string[] {
  const cap = bankOpeningCap(segment.length + 1);
  return [...counts(segment)].filter(([, n]) => n + 1 > cap).map(([f]) => f).sort();
}

/**
 * Un sujet neuf entre-t-il dans son segment ? `null` s'il entre, sinon la raison.
 *
 * ⚠ LE PLAFOND EST CELUI DU SEGMENT APRÈS L'AJOUT. Un segment de trente sujets
 * admet trois titres « when… » ; un quatrième est refusé, quelle que soit sa
 * qualité, et le rédacteur est relancé avec la liste des ouvertures fermées.
 */
export function admitToSegment(segment: BankTopicText[], candidate: BankTopicText): string | null {
  const n = segment.length + 1;
  const cap = bankOpeningCap(n);
  const held = counts(segment);
  for (const f of new Set(topicOpenings(candidate))) {
    if ((held.get(f) ?? 0) + 1 > cap) return `opening ${f}: ${(held.get(f) ?? 0) + 1} of ${n}, cap ${cap}`;
  }
  if (candidate.intent === MYTH_INTENT) {
    const myths = segment.filter((t) => t.intent === MYTH_INTENT).length + 1;
    if (myths > Math.floor(n * MYTH_MAX_SHARE)) return `intent ${MYTH_INTENT}: ${myths} of ${n}, cap ${Math.floor(n * MYTH_MAX_SHARE)}`;
  }
  return null;
}

/** La mesure d'un segment : sa famille d'ouverture la plus fréquente et sa part. */
export function worstOpening(segment: Array<Pick<BankTopicText, "title" | "hook">>): { family: string; count: number; of: number } | null {
  const top = [...counts(segment)].sort((a, b) => b[1] - a[1])[0];
  return top ? { family: top[0], count: top[1], of: segment.length } : null;
}

/*
 * ── L'AXE DE SITUATION ──────────────────────────────────────────────────
 *
 * Trente sujets d'une population parlaient tous du même moment de vie. Chaque
 * sujet neuf reçoit une SITUATION, prise à tour de rôle dans la liste de sa
 * population ; une population inconnue n'en reçoit pas (rien n'est inventé).
 */
export const SITUATIONS: Record<string, readonly string[]> = {
  crossroads: [
    "a move to a new city",
    "a job loss or a career change",
    "a breakup or a divorce",
    "becoming a parent",
    "children leaving home",
    "retirement",
    "a health diagnosis",
    "a friendship that ended",
    "caring for an aging parent",
    "finishing school or training",
  ],
  carrying_old_thing: [
    "family holidays",
    "starting a new relationship",
    "a demanding boss",
    "parenting one's own child",
    "an anniversary date",
    "medical appointments",
    "saying no to a request",
    "receiving praise",
    "conflict with a partner",
    "visiting the childhood home",
  ],
};

export function situationFor(personaId: string, k: number): string | null {
  const list = SITUATIONS[personaId];
  return list && list.length > 0 ? list[k % list.length] : null;
}
