/*
 * ── L'INTERRUPTEUR DES PAGES SEO, EN UN SEUL ENDROIT ────────────────────
 *
 * Même construction que `lib/content/generate/armed.ts`, et pour la même raison :
 * générer un mois de pages dépense de l'argent réel au nom de quelqu'un.
 *
 * DEUX VERROUS, ET IL FAUT LES DEUX :
 *
 *   1. `vercel.json` ne planifie PAS `/api/cron/seo-pages` ;
 *   2. `SEO_GENERATION_ARMED` doit valoir exactement `"true"`. Sans lui, la
 *      route répond 503, même à un appelant qui tient `CRON_SECRET`.
 *
 * ⚠ C'EST UN DRAPEAU DISTINCT DE `CONTENT_GENERATION_ARMED`. Armer les posts
 * Instagram n'arme pas les pages, et inversement : ce sont deux dépenses, deux
 * décisions.
 *
 * ⚠ TOUTE VALEUR AUTRE QUE LA CHAÎNE EXACTE EST « ÉTEINT » — `"false"`, `"1"`,
 * `"TRUE"` et l'absence compris.
 */
export const SEO_ARMED_ENV_VAR = "SEO_GENERATION_ARMED";

export function seoGenerationArmed(env: Record<string, string | undefined> = process.env): boolean {
  return env[SEO_ARMED_ENV_VAR] === "true";
}
