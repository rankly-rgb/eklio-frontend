import {
  checkEthics,
  hasBlockingViolation,
  type EthicsViolation,
} from "@/lib/ethics/rules";

/*
 * Garde-fou de niveau 2 : la vérification côté code, avec régénération.
 *
 * Strictement serveur — les violations sont journalisées ici et ne doivent
 * jamais transiter vers le client (aucun import "server-only" dans le repo,
 * même convention que lib/ai/client.ts : la règle est tenue par convention et
 * par le fait que seuls des Server Actions appellent cette couche).
 */

/**
 * Levée quand le modèle produit encore du contenu bloquant après toutes les
 * tentatives. L'appelant doit échouer proprement plutôt que persister.
 *
 * `violations` sert au diagnostic serveur : ne pas la renvoyer telle quelle au
 * client, elle cite les extraits fautifs.
 */
export class EthicsComplianceError extends Error {
  readonly violations: EthicsViolation[];
  readonly attempts: number;

  constructor(violations: EthicsViolation[], attempts: number) {
    super(
      `Le contenu généré viole encore le socle déontologique après ${attempts} tentative(s).`
    );
    this.name = "EthicsComplianceError";
    this.violations = violations;
    this.attempts = attempts;
  }
}

/**
 * Transforme des violations en instruction corrective courte, à concaténer au
 * prompt lors de la tentative suivante.
 *
 * Citer l'extrait fautif est ce qui fait atterrir la reprise : un « sois plus
 * prudent » générique ne suffit pas. Les `warn` ne sont reprises que s'il n'y a
 * aucune violation bloquante — sinon elles diluent la consigne.
 */
export function buildRegenerationFeedback(
  violations: EthicsViolation[]
): string {
  const blocking = violations.filter((v) => v.severity === "block");
  const relevant = blocking.length > 0 ? blocking : violations;

  if (relevant.length === 0) return "";

  const items = relevant.map((v) => `- "${v.excerpt}" — ${v.reason}`).join("\n");

  return `YOUR PREVIOUS DRAFT WAS REJECTED FOR ADVERTISING-ETHICS VIOLATIONS.

These passages broke the rules:
${items}

Rewrite the whole response. Use psychoeducation only: explain the concept and
what the work looks like, with no promise of results, no timeline, no guarantee,
no testimonial or paraphrased client praise, and no self-awarded superlative.
Keep the same structure and the same voice — change only what makes the copy
non-compliant.`;
}

export type EthicsGuardOptions<T> = {
  /**
   * Chaînes du résultat que le praticien pourrait publier. Seules celles-ci
   * sont vérifiées : un identifiant ou un code hex n'est pas de la copy.
   */
  publishableText: (result: T) => string[];
  /** Étiquette du contexte pour les logs serveur, ex. "directions" ou "kit". */
  label: string;
  /** Nombre de reprises après la première tentative. Défaut 2 (3 appels max). */
  maxRetries?: number;
};

/*
 * Journalisation serveur des violations. Point de couture unique : le jour où
 * l'on voudra des statistiques, c'est ici que ça se branche.
 *
 * TODO(post-MVP): persister les violations dans une table Supabase
 * ethics_violations (project_id, label, attempt, severity, reason, excerpt,
 * created_at) — ce lot trace en logs serveur uniquement, aucun changement de
 * schéma.
 */
function logViolations(
  label: string,
  attempt: number,
  violations: EthicsViolation[]
): void {
  for (const violation of violations) {
    console.warn(
      `[ethics] ${label} tentative ${attempt} — ${violation.severity} : ${violation.reason} · extrait : ${JSON.stringify(violation.excerpt)}`
    );
  }
}

/**
 * Génère → vérifie chaque chaîne publiable → régénère avec feedback correctif
 * si une violation bloquante est présente → lève `EthicsComplianceError` une
 * fois les tentatives épuisées.
 *
 * Ne renvoie jamais de contenu bloqué : ce qui sort d'ici est persistable.
 *
 * `callModel` reçoit `null` à la première tentative, puis le feedback
 * correctif à concaténer au prompt lors de chaque reprise.
 */
export async function generateWithEthicsGuard<T>(
  callModel: (feedback: string | null) => Promise<T>,
  { publishableText, label, maxRetries = 2 }: EthicsGuardOptions<T>
): Promise<T> {
  const totalAttempts = Math.max(1, maxRetries + 1);
  let feedback: string | null = null;
  let lastViolations: EthicsViolation[] = [];

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const result = await callModel(feedback);

    const violations = publishableText(result).flatMap(
      (text) => checkEthics(text).violations
    );
    lastViolations = violations;

    if (violations.length > 0) {
      logViolations(label, attempt, violations);
    }

    if (!hasBlockingViolation(violations)) {
      return result;
    }

    feedback = buildRegenerationFeedback(violations);
  }

  console.error(
    `[ethics] ${label} — abandon après ${totalAttempts} tentative(s), ${lastViolations.length} violation(s) restante(s).`
  );
  throw new EthicsComplianceError(lastViolations, totalAttempts);
}
