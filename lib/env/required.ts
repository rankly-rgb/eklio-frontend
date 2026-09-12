/*
 * Les variables d'environnement dont l'absence est SILENCIEUSE.
 *
 * ── LE CRITÈRE D'ENTRÉE DANS CETTE LISTE ─────────────────────────────────
 *
 * Pas « les variables importantes » — presque toutes le sont, et une liste de
 * tout est une liste que personne ne maintient. Le critère est étroit :
 *
 *   une variable entre ici quand son absence ne casse RIEN de visible, et
 *   qu'un chemin continue à se comporter comme s'il avait réussi.
 *
 * C'est pour ça que les clés Stripe n'y sont pas : `requireEnv` dans
 * `lib/stripe/client.ts` lève une `StripeConfigError` au premier appel. Un
 * checkout sans clé échoue bruyamment, tout de suite, et l'erreur nomme la
 * variable. Rien à ajouter ici — la panne est déjà impossible à rater.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` non plus : `lib/email/state.ts` lève dessus, et
 * un client admin sans clé échoue à la première requête.
 *
 * ── POURQUOI RESEND_API_KEY Y EST ────────────────────────────────────────
 *
 * Parce qu'elle était exactement le cas contraire. `sendEmail` rendait
 * `{ ok: true }` quand la clé manquait, le balayage du préavis lisait ce
 * succès et marquait la ligne « prévenue ». Résultat sur un déploiement mal
 * configuré : chaque essai marqué comme averti, personne averti, et le
 * prélèvement qui part. Trente jours pouvaient passer avant que ça se voie —
 * le temps qu'un premier essai arrive à terme.
 *
 * La loi californienne sur la reconduction automatique (Bus. & Prof. Code
 * § 17602) fait de ce préavis une obligation, pas une politesse. Une panne de
 * configuration qui la supprime en silence doit empêcher le démarrage, pas
 * attendre le premier débit pour se manifester.
 *
 * ── POURQUOI CRON_SECRET Y EST ───────────────────────────────────────────
 *
 * Même forme, autre chemin. `authorizeCron` rend **404** quand la variable
 * manque : une porte fermée qui a l'air d'une mauvaise adresse. Les cinq
 * crons de `vercel.json` partent alors à l'heure dite, reçoivent 404, et
 * n'atteignent jamais la base — aucune exception, aucune alerte, et un
 * panneau d'observabilité qui montre bien des invocations.
 *
 * Mesuré le 12 septembre 2026 : les journaux PostgREST de la production ne
 * portaient aucune trace des passages de 04:00, 05:00 et 06:00, alors que la
 * fenêtre de rétention les couvrait — vérifié par la présence d'événements
 * `postgres_logs` aux mêmes heures. Le silence n'était donc pas un artefact
 * de rétention.
 *
 * Ce dépôt avait déjà écrit la règle, dans `app/api/cron/content-month/
 * route.ts` : « un 404 dirait que la route n'existe pas, et qui a réglé
 * CRON_SECRET correctement irait chercher un problème de déploiement ». Elle
 * y était appliquée à `CONTENT_GENERATION_ARMED` et pas à `CRON_SECRET`.
 *
 * Le 404 reste juste pour un appelant non authentifié — une porte fermée ne
 * se présente pas. Mais l'absence de la variable n'est pas un problème
 * d'appelant, c'est un problème de déploiement, et elle doit être bruyante
 * là où l'exploitant regarde.
 */

/**
 * Les variables exigées EN PRODUCTION, avec la raison de leur présence ici.
 *
 * La raison est dans la donnée, pas dans un commentaire à côté : elle est
 * imprimée dans le message d'erreur, donc la personne qui voit le boot échouer
 * lit pourquoi cette variable comptait sans avoir à ouvrir ce fichier.
 */
export const REQUIRED_IN_PRODUCTION: Record<string, string> = {
  RESEND_API_KEY:
    "sans elle, le préavis d'avant-prélèvement (obligation légale, Cal. Bus. & Prof. Code § 17602) n'est jamais envoyé",
  CRON_SECRET:
    "sans elle, `authorizeCron` rend 404 et les cinq crons — dont le préavis d'avant-prélèvement — s'exécutent à l'heure dite sans jamais atteindre la base",
};

/** Les variables manquantes, dans l'ordre de déclaration. */
export function missingRequired(
  env: Record<string, string | undefined>
): string[] {
  return Object.keys(REQUIRED_IN_PRODUCTION).filter((name) => !env[name]);
}

/** Le message d'échec — une ligne par variable, avec sa raison. */
export function missingRequiredMessage(missing: string[]): string {
  const lines = missing.map(
    (name) => `  - ${name} : ${REQUIRED_IN_PRODUCTION[name]}`
  );
  return [
    `Démarrage refusé : ${missing.length} variable(s) d'environnement requise(s) manquante(s) en production.`,
    ...lines,
    "",
    "Ces variables sont celles dont l'absence est SILENCIEUSE — le produit",
    "continuerait à tourner en faisant croire que le travail a été fait.",
    "Voir lib/env/required.ts.",
  ].join("\n");
}

/**
 * Vérifie la configuration, et REFUSE DE DÉMARRER si elle manque.
 *
 * ⚠ NE LÈVE QU'EN PRODUCTION. En développement et en test, une clé d'envoi
 * absente est le cas normal : personne n'est facturé en local, et exiger la
 * clé empêcherait de lancer le projet ou de faire tourner la suite.
 *
 * Lever ici est délibérément brutal. L'alternative — journaliser et continuer —
 * est exactement le comportement qu'on vient de retirer à `sendEmail` : une
 * panne qui se raconte quelque part que personne ne lit.
 *
 * ── CE QUE ÇA FAIT VRAIMENT, VÉRIFIÉ ET PAS SUPPOSÉ ──────────────────────
 *
 * Mesuré sur ce dépôt, Next 16.3.0, avec `next start` et la clé retirée :
 *
 *   - `next build` RÉUSSIT. Le hook d'instrumentation n'est pas exécuté à la
 *     construction, donc un déploiement se construit normalement — la panne ne
 *     se déclenche pas au mauvais moment.
 *   - `next start` affiche « Failed to prepare server » suivi du message
 *     ci-dessous, et le serveur répond ensuite **500 à chaque requête**. Le
 *     processus ne meurt pas ; il ne sert simplement plus rien.
 *
 * Donc : bruyant, immédiat, visible au déploiement, et impossible à confondre
 * avec un fonctionnement normal. Ce n'est PAS un crash propre, et il vaut
 * mieux le savoir en lisant les logs qu'en le découvrant.
 */
export function assertRequiredEnv(
  env: Record<string, string | undefined> = process.env
): void {
  if (env.NODE_ENV !== "production") return;

  const missing = missingRequired(env);
  if (missing.length === 0) return;

  throw new Error(missingRequiredMessage(missing));
}
