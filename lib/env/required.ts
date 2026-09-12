/*
 * Les variables d'environnement dont l'absence est SILENCIEUSE — et ce que
 * chacune doit faire tomber.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ POURQUOI CE FICHIER A DEUX REGISTRES, ET POURQUOI LE PREMIER EST VIDE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le 2026-09-12, ce fichier a mis la production par terre. `CRON_SECRET` y
 * avait été ajoutée le matin même, avec la bonne intention. Elle n'était pas
 * réglée sur Vercel. Le garde a fonctionné exactement comme écrit : le serveur
 * a refusé de préparer, et le site a répondu `Internal Server Error` en texte
 * brut À CHAQUE REQUÊTE — accueil, tarifs, brief anonyme — pour une variable
 * que seules cinq routes de cron utilisent.
 *
 * ── LA LEÇON PLUS PROFONDE, QUI A VIDÉ LE REGISTRE 1 ─────────────────────
 *
 * `RESEND_API_KEY` y était pour protéger le préavis d'avant-prélèvement. Elle
 * ne protégeait rien de tel. Un garde au démarrage ne se déclenche que si la
 * clé manque AU MOMENT DU DÉPLOIEMENT. Il ne fait RIEN si :
 *
 *   - la clé est révoquée après coup ;
 *   - le compte Resend est suspendu ou hors quota ;
 *   - l'API de Resend est en panne une semaine ;
 *   - le message est accepté puis rebondit.
 *
 * Dans chacun de ces cas l'application démarre, continue de servir, et le
 * préavis n'arrive toujours pas — ce qui est toute l'exposition § 17602,
 * intacte. Le refus de démarrer couvrait UN cas étroit, laissait le cas
 * général ouvert, et installait un interrupteur de panne totale pour le faire.
 *
 * LA VRAIE GARANTIE N'EST PAS ICI. Elle est dans
 * `app/api/cron/trial-guard/route.ts` : un essai dont le préavis n'a pas pu
 * être remis NE SE CONVERTIT PAS. C'est la seule mécanique qui tienne contre
 * les quatre pannes ci-dessus, parce qu'elle vérifie au moment qui compte et
 * pas au démarrage.
 *
 * ── LE CRITÈRE D'ENTRÉE, REGISTRE 1 : REQUIS POUR SERVIR ──────────────────
 *
 * Une variable entre dans `REQUIRED_TO_SERVE` quand, sans elle, LE PRODUIT NE
 * PEUT PAS SERVIR HONNÊTEMENT — pas « une fonctionnalité casse », mais « ce
 * que le site montre à une visiteuse devient faux ». Refuser de démarrer est
 * alors la bonne réponse, parce que servir serait pire que ne rien servir.
 *
 * ⚠ IL EST VIDE AUJOURD'HUI, ET C'EST LE BON ÉTAT. Aucune variable connue ne
 * remplit ce critère : chaque panne qu'on sait nommer se rattrape LÀ OÙ ELLE
 * SERT. Un registre vide n'est pas un registre mort — la mécanique est testée
 * et le jour où une variable le mérite vraiment, elle a sa place. Mais y
 * mettre quelque chose est une décision qui met tout le produit hors ligne si
 * quelqu'un oublie de la régler, et ce fichier a déjà payé ça une fois.
 *
 * ── LE CRITÈRE D'ENTRÉE, REGISTRE 2 : REQUIS POUR UNE FONCTIONNALITÉ ──────
 *
 * Une variable entre dans `REQUIRED_FOR_A_FEATURE` quand son absence casse UNE
 * PARTIE du produit en silence pendant que le reste continue légitimement de
 * servir. Elle NE DOIT PAS empêcher le démarrage. Elle doit :
 *
 *   1. hurler au démarrage, dans les journaux, là où un exploitant regarde ; et
 *   2. être refusée BRUYAMMENT à l'usage — 503 nommant la variable, jamais un
 *      404 qui ressemble à une mauvaise adresse, jamais un succès silencieux.
 *
 * ── CE QUI N'EST DANS NI L'UN NI L'AUTRE ─────────────────────────────────
 *
 * Les clés Stripe : `requireEnv` dans `lib/stripe/client.ts` lève une
 * `StripeConfigError` au premier appel, et l'erreur nomme la variable.
 * `SUPABASE_SERVICE_ROLE_KEY` non plus : `lib/email/state.ts` lève dessus. Une
 * panne déjà impossible à rater n'a rien à faire dans un registre.
 */

/**
 * REGISTRE 1 — sans elles, refuser de démarrer.
 *
 * ⚠ VIDE, DÉLIBÉRÉMENT. Voir l'en-tête. La raison de chaque entrée est
 * imprimée dans le message d'erreur, pour que la personne qui voit le boot
 * échouer lise POURQUOI sans ouvrir ce fichier.
 */
export const REQUIRED_TO_SERVE: Record<string, string> = {};

/**
 * REGISTRE 2 — sans elles, une fonctionnalité tombe, le site continue.
 *
 * `feature` nomme ce qui tombe ; `reason` dit pourquoi ce serait silencieux
 * sans ce registre. Les deux sont imprimés dans l'avertissement de démarrage.
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
  RESEND_API_KEY: {
    feature: "tout envoi d'e-mail (préavis d'avant-prélèvement, lien de reprise, relances)",
    reason:
      "`sendEmail` rend `ok: false` en production plutôt qu'un faux succès, et AUCUN essai ne se convertit sans préavis accepté (`app/api/cron/trial-guard`). C'est là que l'obligation § 17602 est tenue — pas au démarrage, qui ne voyait ni une clé révoquée, ni un compte suspendu, ni une API en panne.",
  },
};

/**
 * Les variables manquantes du registre 1.
 *
 * Le registre est INJECTABLE pour que la mécanique du refus reste testable
 * pendant qu'il est légitimement vide. Un mécanisme non testé parce qu'il n'a
 * rien à faire aujourd'hui est un mécanisme cassé le jour où on lui confie
 * quelque chose.
 */
export function missingRequired(
  env: Record<string, string | undefined> = process.env,
  register: Record<string, string> = REQUIRED_TO_SERVE
): string[] {
  return Object.keys(register).filter((name) => !env[name]);
}

/** Les variables manquantes du registre 2. */
export function missingFeatureEnv(
  env: Record<string, string | undefined> = process.env
): string[] {
  return Object.keys(REQUIRED_FOR_A_FEATURE).filter((name) => !env[name]);
}

/** Le message d'échec — une ligne par variable, avec sa raison. */
export function missingRequiredMessage(
  missing: string[],
  register: Record<string, string> = REQUIRED_TO_SERVE
): string {
  const lines = missing.map((name) => `  - ${name} : ${register[name] ?? "?"}`);
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
 * ⚠ N'AVERTIT QUE, tant que le registre 1 est vide — et c'est le cas
 * aujourd'hui. Le registre 2 avertit et laisse démarrer : c'est précisément la
 * distinction que l'incident du 2026-09-12 a payée.
 *
 * ── CE QUE ÇA FAIT VRAIMENT, MESURÉ ET PAS SUPPOSÉ ───────────────────────
 *
 * Mesuré sur ce dépôt, Next 16.3.0, `next start`, build de production :
 *
 *   - `next build` RÉUSSIT : le hook d'instrumentation n'est pas exécuté à la
 *     construction, donc un déploiement se construit normalement.
 *   - avec une variable du REGISTRE 1 manquante, `next start` affiche « Failed
 *     to prepare server » et le serveur répond 500 à chaque requête, corps
 *     « Internal Server Error » en texte brut. C'est ce qui est arrivé en
 *     production, et pourquoi ce registre est vide.
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
