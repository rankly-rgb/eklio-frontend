/*
 * ── OÙ CE CODE TOURNE, ET CE QU'IL A LE DROIT DE MONTRER ────────────────
 *
 * Une seule question, posée au POINT D'USAGE et jamais au chargement d'un
 * module : peut-on afficher la cause technique d'une erreur à qui regarde cet
 * écran ?
 *
 * ⚠ LU À L'APPEL, PAS À L'IMPORT. Une constante de module fige la réponse au
 * moment où le bundle est construit, ce qui est exactement le mauvais moment :
 * `VERCEL_ENV` est posée à l'exécution, et un module qui la lit une fois au
 * démarrage répondra « production » dans une preview construite depuis la même
 * image. C'est aussi la règle générale de ce dépôt après l'incident
 * `/app/content` — voir `CONTENT_BUG_REPORT.md` §2.2.
 *
 * ⚠ ET LE DÉFAUT EST « NON ». Une variable absente, mal orthographiée ou
 * ajoutée demain doit fermer la porte, pas l'ouvrir : un détail technique
 * affiché à une praticienne est une fuite, tandis qu'un détail caché en
 * preview coûte un aller-retour dans les logs. Les deux erreurs ne se valent
 * pas.
 */

/**
 * `true` seulement sur un déploiement qui n'est PAS la production.
 *
 * `VERCEL_ENV` vaut `production`, `preview` ou `development` sur Vercel. Hors
 * Vercel on retombe sur `NODE_ENV`, ce qui couvre le poste de développement et
 * les suites.
 */
export function showsTechnicalDetail(): boolean {
  const vercel = process.env.VERCEL_ENV;
  if (vercel) return vercel !== "production";
  return process.env.NODE_ENV !== "production";
}

/**
 * Le nom de l'environnement, pour une ligne de diagnostic.
 *
 * Rend `null` quand rien ne le dit, plutôt que de deviner « production » — une
 * étiquette inventée sur un écran de débogage est pire que pas d'étiquette.
 */
export function deployEnvName(): string | null {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null;
}
