/*
 * Les variables d'environnement dont l'absence est SILENCIEUSE — et ce que
 * chacune doit faire tomber.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ POURQUOI CE FICHIER A DEUX REGISTRES ET PAS UN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le 2026-09-12, ce fichier a mis la production par terre. `CRON_SECRET` y a
 * été ajoutée le matin même, avec la bonne intention — son absence rendait un
 * 404 et les cinq crons tournaient sans jamais atteindre la base. Le garde a
 * fonctionné exactement comme écrit : `next start` a refusé de préparer le
 * serveur, et le site a répondu `Internal Server Error` en texte brut À CHAQUE
 * REQUÊTE, page d'accueil et tarifs compris.
 *
 * Reproduit à l'identique sur ce dépôt, build de production, une seule
 * variable changée : sans `CRON_SECRET`, HTTP 500 et le corps « Internal
 * Server Error » ; avec, HTTP 200 et la page.
 *
 * LA LEÇON N'EST PAS « NE PAS ÉCHOUER FORT ». C'est que le lieu de l'échec
 * doit être proportionné à ce qui manque. `CRON_SECRET` sert cinq routes de
 * cron et RIEN de ce qu'une visiteuse touche. Mettre hors ligne le site
 * vitrine, la page de tarifs et le brief anonyme parce qu'un ordonnanceur ne
 * peut pas s'authentifier, c'est transformer un problème silencieux en
 * problème total.
 *
 * Et ce dépôt avait DÉJÀ écrit la bonne forme, trois jours plus tôt, dans
 * `app/api/cron/content-month/route.ts` : échouer fort LÀ OÙ LA CHOSE SERT.
 * La route rend 503 en nommant la variable. C'est la doctrine qui existait et
 * qui n'a pas été appliquée.
 *
 * ── LE CRITÈRE D'ENTRÉE, REGISTRE 1 : REQUIS POUR SERVIR ──────────────────
 *
 * Une variable entre dans `REQUIRED_TO_SERVE` quand, sans elle, LE PRODUIT NE
 * PEUT PAS SERVIR HONNÊTEMENT — pas « une fonctionnalité casse », mais « ce
 * que le site montre à une visiteuse devient faux ». Refuser de démarrer est
 * alors la bonne réponse, parce que servir serait pire que ne rien servir.
 *
 * C'est un registre qui doit rester TRÈS court. Chaque entrée est un
 * interrupteur qui met tout le produit hors ligne si quelqu'un oublie de la
 * régler.
 *
 * ── LE CRITÈRE D'ENTRÉE, REGISTRE 2 : REQUIS POUR UNE FONCTIONNALITÉ ──────
 *
 * Une variable entre dans `REQUIRED_FOR_A_FEATURE` quand son absence casse UNE
 * PARTIE du produit en silence, pendant que le reste continue légitimement de
 * servir. Elle NE DOIT PAS empêcher le démarrage. Elle doit :
 *
 *   1. hurler au démarrage, dans les journaux, là où un exploitant regarde ; et
 *   2. être refusée BRUYAMMENT à l'usage — 503 nommant la variable, jamais un
 *      404 qui ressemble à une mauvaise adresse.
 *
 * ── CE QUI N'EST DANS NI L'UN NI L'AUTRE ─────────────────────────────────
 *
 * Les clés Stripe : `requireEnv` dans `lib/stripe/client.ts` lève une
 * `StripeConfigError` au premier appel. Un checkout sans clé échoue bruyamment,
 * tout de suite, et l'erreur nomme la variable. La panne est déjà impossible à
 * rater. `SUPABASE_SERVICE_ROLE_KEY` non plus : `lib/email/state.ts` lève
 * dessus.
 *
 * ⚠ UNE LISTE S'EST ENCORE RÉVÉLÉE ÊTRE DEUX LISTES. Cinquième fois dans ce
 * chantier. Voir CHANTIER_LOG.
 */

/**
 * REGISTRE 1 — sans elles, refuser de démarrer.
 *
 * La raison est dans la donnée et pas dans un commentaire à côté : elle est
 * imprimée dans le message d'erreur, donc la personne qui voit le boot échouer
 * lit pourquoi cette variable comptait sans ouvrir ce fichier.
 *
 * ⚠ RESEND_API_KEY EST ICI, ET C'EST DISCUTABLE. Son absence ne casse pas le
 * site vitrine ; elle casse l'envoi. Elle a été mise ici quand `sendEmail`
 * rendait `{ ok: true }` sans clé — le balayage du préavis lisait ce succès et
 * marquait la ligne « prévenue », si bien qu'un déploiement mal configuré
 * pouvait marquer trente jours d'avis envoyés sans qu'aucun parte, et le
 * prélèvement partait quand même. La loi californienne sur la reconduction
 * automatique (Cal. Bus. & Prof. Code § 17602) fait de ce préavis une
 * obligation.
 *
 * MAIS CE TROU EST DÉJÀ BOUCHÉ À L'USAGE : `lib/email/transport.ts` rend
 * désormais `{ ok: false }` en production quand la clé manque, et le balayage
 * laisse la ligne due. Au critère écrit ci-dessus, RESEND_API_KEY est donc
 * candidate au registre 2. Elle reste ici en attendant un arbitrage explicite,
 * parce que déplacer une garde légale sans qu'on me le demande serait
 * exactement l'inverse de la prudence. Voir FINDINGS.md.
 */
export const REQUIRED_TO_SERVE: Record<string, string> = {
  RESEND_API_KEY:
    "sans elle, le préavis d'avant-prélèvement (obligation légale, Cal. Bus. & Prof. Code § 17602) n'est jamais envoyé",
};

/**
 * REGISTRE 2 — sans elles, une fonctionnalité tombe, le site continue.
 *
 * `feature` nomme ce qui tombe ; `reason` dit pourquoi c'est silencieux sans
 * ce registre. Les deux sont imprimés dans l'avertissement de démarrage.
 */
export const REQUIRED_FOR_A_FEATURE: Record<
  string,
  { feature: string; reason: string }
> = {
  CRON_SECRET: {
    feature: "les cinq routes de cron (dont le préavis d'avant-prélèvement)",
    reason:
      "`authorizeCron` ne peut authentifier personne : les crons partent à l'heure dite et n'atteignent jamais la base. La route répond 503 en nommant la variable, et le site continue de servir.",
  },
};

/** Les variables manquantes du registre 1, dans l'ordre de déclaration. */
export function missingRequired(
  env: Record<string, string | undefined> = process.env
): string[] {
  return Object.keys(REQUIRED_TO_SERVE).filter((name) => !env[name]);
}

/** Les variables manquantes du registre 2, dans l'ordre de déclaration. */
export function missingFeatureEnv(
  env: Record<string, string | undefined> = process.env
): string[] {
  return Object.keys(REQUIRED_FOR_A_FEATURE).filter((name) => !env[name]);
}

/** Le message d'échec — une ligne par variable, avec sa raison. */
export function missingRequiredMessage(missing: string[]): string {
  const lines = missing.map((name) => `  - ${name} : ${REQUIRED_TO_SERVE[name]}`);
  return [
    `Démarrage refusé : ${missing.length} variable(s) d'environnement requise(s) manquante(s) en production.`,
    ...lines,
    "",
    "Ces variables sont celles SANS LESQUELLES LE PRODUIT NE PEUT PAS SERVIR",
    "HONNÊTEMENT — servir serait pire que ne rien servir.",
    "Voir lib/env/required.ts.",
  ].join("\n");
}

/** L'avertissement — bruyant, nominatif, et sans conséquence sur le service. */
export function degradedFeaturesMessage(missing: string[]): string {
  const lines = missing.map(
    (name) =>
      `  - ${name} : ${REQUIRED_FOR_A_FEATURE[name].feature}\n      ${REQUIRED_FOR_A_FEATURE[name].reason}`
  );
  return [
    `⚠ ${missing.length} fonctionnalité(s) DÉSARMÉE(S) : variable(s) d'environnement manquante(s).`,
    ...lines,
    "",
    "Le site continue de servir : ces variables ne concernent rien qu'une",
    "visiteuse touche. Les surfaces concernées répondent 503 en nommant la",
    "variable, plutôt que d'échouer en silence.",
    "Voir lib/env/required.ts.",
  ].join("\n");
}

/**
 * Vérifie la configuration.
 *
 * ⚠ NE LÈVE QUE POUR LE REGISTRE 1, ET QU'EN PRODUCTION. Le registre 2
 * avertit et laisse démarrer — c'est précisément la distinction que l'incident
 * du 2026-09-12 a payée.
 *
 * En développement et en test, rien ne lève : une clé d'envoi absente est le
 * cas normal en local, et exiger la clé empêcherait de lancer le projet ou de
 * faire tourner la suite.
 *
 * ── CE QUE ÇA FAIT VRAIMENT, MESURÉ ET PAS SUPPOSÉ ───────────────────────
 *
 * Mesuré sur ce dépôt, Next 16.3.0, `next start`, build de production :
 *
 *   - `next build` RÉUSSIT : le hook d'instrumentation n'est pas exécuté à la
 *     construction, donc un déploiement se construit normalement.
 *   - avec une variable du REGISTRE 1 manquante, `next start` affiche « Failed
 *     to prepare server » et le serveur répond **500 à chaque requête**, corps
 *     « Internal Server Error » en texte brut. Le processus ne meurt pas ; il
 *     ne sert plus rien. C'est exactement ce qui est arrivé en production.
 *   - avec une variable du REGISTRE 2 manquante, le serveur démarre, `/` rend
 *     200, et l'avertissement est dans les journaux.
 */
export function assertRequiredEnv(
  env: Record<string, string | undefined> = process.env
): void {
  if (env.NODE_ENV !== "production") return;

  const degraded = missingFeatureEnv(env);
  if (degraded.length > 0) {
    console.error(degradedFeaturesMessage(degraded));
  }

  const missing = missingRequired(env);
  if (missing.length === 0) return;

  throw new Error(missingRequiredMessage(missing));
}
