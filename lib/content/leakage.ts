import { keysOf } from "@/lib/content/dedup";

/*
 * ── LES RÉPONSES DE BILAN NE SE RECOPIENT PAS SUR UNE CARTE ─────────────
 *
 * Le mois rendu le 2026-09-21b portait « Oakland, California » et « Evening
 * slots opening October » comme LIBELLÉS DE DIAGRAMME, sur des cartes qui
 * parlaient d'épuisement.
 *
 * ⚠ CE N'EST PAS UNE MALADRESSE DE STYLE, C'EST UNE CONFUSION DE RÔLE. Le
 * bilan mensuel demande ce qui est remonté en séance et ce qui se passe au
 * cabinet. Ces réponses servent à CHOISIR les sujets du mois — elles orientent
 * la dérivation des thèmes, et c'est tout ce qu'elles font. Recopiées sur une
 * carte, elles deviennent une affirmation publique qu'elle n'a pas écrite :
 * une ville sur un post qui n'en parle pas, une disponibilité d'octobre sur un
 * diagramme de novembre.
 *
 * La seule exception est l'archétype `practitioner_card`, dont le contenu EST
 * un petit nombre de faits qu'elle a donnés sur sa façon de travailler. Elle
 * est nommée ici plutôt que devinée.
 */

/** Le seul archétype où un fait du bilan a sa place sur la carte. */
export const ARCHETYPE_THAT_MAY_QUOTE_THE_CHECKIN = "practitioner_card";

export type CheckinFacts = {
  /** « ce qui est remonté en séance ce mois-ci » */
  sessionsTheme?: string | null;
  /** « ce qui se passe au cabinet » — créneaux, liste d'attente, congés */
  happening?: string | null;
  /** La ville et l'état du cabinet, qui viennent du brief et non du bilan. */
  location?: string | null;
};

/**
 * Combien de mots consécutifs font une citation plutôt qu'une coïncidence.
 *
 * ⚠ DEUX, ET PAS UN. Un seul mot en commun entre un bilan et une carte est le
 * cas NORMAL : le bilan dit « épuisement » et le mois parle d'épuisement,
 * c'est précisément ce à quoi il sert. Deux mots porteurs à la suite — « Oakland
 * California », « evening slots » — ne se retrouvent pas par hasard.
 */
const QUOTE_LENGTH = 2;

/** Les suites de deux clefs porteuses d'un texte. */
function bigrams(text: string | null | undefined): string[] {
  const keys = keysOfInOrder(text);
  const out: string[] = [];
  for (let i = 0; i + QUOTE_LENGTH <= keys.length; i += 1) {
    out.push(keys.slice(i, i + QUOTE_LENGTH).join(" "));
  }
  return out;
}

/*
 * ⚠ `keysOf` DÉDOUBLONNE, ET UNE SUITE A BESOIN DE L'ORDRE COMPLET. Elle est
 * écrite pour comparer des ensembles de titres, où un mot répété n'ajoute
 * rien ; ici, retirer la deuxième occurrence d'un mot souderait deux suites
 * qui ne se touchent pas. Les clefs sont donc recalculées mot à mot, avec la
 * même normalisation — même découpage, mêmes mots outils, même radical de
 * quatre lettres — pour que les deux vues ne divergent jamais.
 */
function keysOfInOrder(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/[^A-Za-z']+/)
    .map((w) => keysOf(w)[0])
    .filter((k): k is string => Boolean(k));
}

/**
 * Ce que cette carte recopie du bilan, ou rien.
 *
 * `cardText` est tout ce qui sera imprimé : libellés, gloses, phrase,
 * lignes — ce que `payloadPublishedText` rassemble déjà pour le contrôle
 * éthique.
 */
export function checkinLeaks(
  archetypeKey: string,
  cardText: string,
  facts: CheckinFacts
): string[] {
  if (archetypeKey === ARCHETYPE_THAT_MAY_QUOTE_THE_CHECKIN) return [];

  const onCard = new Set(bigrams(cardText));
  const quoted: string[] = [];
  for (const source of [facts.sessionsTheme, facts.happening, facts.location]) {
    for (const gram of bigrams(source)) {
      if (onCard.has(gram) && !quoted.includes(gram)) quoted.push(gram);
    }
  }
  return quoted;
}
