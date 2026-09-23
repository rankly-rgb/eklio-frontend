import { BUDGET } from "@/lib/compose/budget";

/*
 * ── LA CARTE PRATICIENNE NE S'ÉCRIT PAS, ELLE SE REMPLIT ────────────────
 *
 * ⚠ CE MODULE EXISTE PARCE QU'UN MODÈLE A INVENTÉ UNE THÉRAPEUTE.
 *
 * Le 2026-09-21, une carte praticienne du mois d'Isla Thornbury portait
 * « Rowan Mercier Therapy » et « rowan@rowanmercier.com ». Le nom et
 * l'adresse n'existaient nulle part : le modèle les a FABRIQUÉS, parce que la
 * forme de l'archétype lui demandait « des faits sur sa façon de travailler »
 * et qu'il n'avait aucun fait à sa disposition.
 *
 * Un contrôle bloquant a été posé le jour même (F16). Il attrape la carte,
 * mais il l'attrape APRÈS : le modèle a été payé pour l'écrire, et il suffit
 * d'une tournure que l'expression régulière ne reconnaît pas pour qu'une
 * identité passe.
 *
 * ── CE QU'IL NE PEUT PAS ÉCRIRE, IL NE PEUT PAS L'INVENTER ──────────────
 *
 * Aucun nom, aucune adresse, aucun téléphone, aucun identifiant social n'est
 * demandé au modèle. Ces lignes sont ASSEMBLÉES ICI, à partir du brief que la
 * praticienne a rempli elle-même, au moment de composer. Si le brief ne les
 * porte pas, la carte n'existe pas — et c'est un cas normal, pas une panne :
 * `null` remonte jusqu'au tirage, qui ne propose alors plus cet archétype.
 */

export type PractitionerFacts = {
  practiceName: string | null;
  city: string | null;
  state: string | null;
  /** Les libellés des modalités, déjà résolus — « EMDR », « IFS ». */
  modalities: string[];
  /** La réponse du bilan : `yes`, `waitlist`, `no`, ou rien. */
  takingClients: "yes" | "waitlist" | "no" | null;
};

/** Ce que le bilan dit de la disponibilité, en une ligne ou rien. */
function availability(taking: PractitionerFacts["takingClients"]): string | null {
  switch (taking) {
    case "yes":
      return "Taking new clients";
    case "waitlist":
      return "Waitlist open";
    /*
     * ⚠ « NO » NE DONNE PAS DE LIGNE, ET NE DOIT PAS EN DONNER. « Not taking
     * new clients » sur un post public est une information qui se périme en
     * une semaine et qui décourage une lectrice qui aurait écrit le mois
     * suivant. Le silence est le bon message ; la carte se compose avec les
     * deux autres lignes.
     */
    default:
      return null;
  }
}

/** Le nombre de lignes que l'archétype exige, tel que son `parse` l'impose. */
export const PRACTITIONER_LINES = { min: 2, max: 4 } as const;

/**
 * Les lignes de la carte, ou `null` quand le brief n'en porte pas assez.
 *
 * ⚠ CHAQUE LIGNE EST UNE DONNÉE, JAMAIS UNE PHRASE. « EMDR for burnout » est
 * une composition de deux champs du brief ; « Oakland, California » en est un
 * troisième. Rien ici n'est rédigé : tout est recopié, dans un ordre fixe.
 */
export function practitionerLines(facts: PractitionerFacts): string[] | null {
  const lines: string[] = [];

  const modality = facts.modalities.filter(Boolean)[0];
  if (modality) lines.push(modality);

  const place = [facts.city, facts.state].filter(Boolean).join(", ");
  if (place) lines.push(place);

  const free = availability(facts.takingClients);
  if (free) lines.push(free);

  /*
   * ⚠ LE NOM DU CABINET N'EST PAS UNE LIGNE. Il est déjà dans le pied de
   * chaque carte du mois : le répéter dans le champ, c'est ce que faisaient
   * les trois cartes praticiennes du 2026-09-21, et l'évaluateur indépendant
   * les a notées 2 sur 5 pour ça — « titre répété mot pour mot en ligne 1 ».
   */

  if (lines.length < PRACTITIONER_LINES.min) return null;

  const budget = BUDGET.practitionerLine;
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  if (lines.some((l) => words(l) > budget.max)) return null;

  return lines.slice(0, PRACTITIONER_LINES.max);
}

/** Tout ce qu'une carte a le droit de nommer : ce que la praticienne a saisi. */
export function identityAllowList(facts: PractitionerFacts): string[] {
  return [facts.practiceName, facts.city, facts.state, ...facts.modalities]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => v.trim());
}

/**
 * Le corps qu'un sujet de banque porte pour cet archétype, ou `null` quand
 * c'est au modèle de l'écrire.
 *
 * ⚠ MESURÉ : 36 APPELS PAYÉS SUR 260 ONT ÉTÉ JETÉS POUR CETTE RÈGLE MANQUANTE.
 *
 * Le 2026-09-23, un remplissage de banque a écrit 224 sujets pour 260 appels.
 * Les 36 manquants étaient TOUS des `practitioner_card` : on avait cessé de
 * DEMANDER au modèle le contenu d'une carte praticienne sans cesser de
 * l'EXIGER de sa réponse. On payait des lignes qu'on refusait d'écrire.
 *
 * Une banque qui détient des lignes de praticienne est aussi une banque d'où
 * une identité peut ressortir : les 39 sujets déjà en place portaient des
 * phrases écrites par un modèle pour une praticienne qui n'existe pas. Le
 * corps est donc VIDE, et `content_topic_bank_payload_valid` le vérifie en
 * base.
 */
export function bankPayloadFor(archetypeKey: string): Record<string, never> | null {
  return archetypeKey === PRACTITIONER_ARCHETYPE ? {} : null;
}

/** L'archétype dont le corps vient du brief, jamais d'un modèle. */
export const PRACTITIONER_ARCHETYPE = "practitioner_card";
