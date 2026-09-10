import { record } from "@/lib/funnel/sink";
import type { AnalyticsEvent, AnalyticsProperties } from "@/lib/analytics-events";

/*
 * Le tunnel, en événements — SERVEUR UNIQUEMENT, et cette fois c'est vrai :
 * ce module importe `next/headers`, donc un composant client qui l'importerait
 * casserait le build au lieu de faire semblant de mesurer.
 *
 * PAS DE FOURNISSEUR, ET C'EST DÉLIBÉRÉ. Un SDK d'analytics côté client
 * ajouterait un script tiers, un cookie, une bannière de consentement, et une
 * dépendance — pour un produit dont les utilisateurs sont des cliniciens et
 * dont les données touchent à leur pratique. Ce qu'on veut savoir tient dans
 * une ligne de journal structurée, que Vercel draine déjà.
 *
 * AUCUNE DONNÉE PERSONNELLE. Un identifiant de projet ou de kit, jamais un
 * e-mail, jamais un nom de practice, jamais un extrait de copy. Ce qui est
 * journalisé ici part chez qui héberge les logs.
 *
 * ⚠ CE QUI A CHANGÉ AU LOT « INSTRUMENTATION ». La ligne de journal reste,
 * mais elle n'est plus la seule destination : `lib/funnel/sink.ts` écrit
 * chaque événement dans `public.funnel_events`. Sur Vercel, un journal de
 * fonction vit quelques heures à quelques jours sans Log Drain — une semaine
 * après l'envoi des e-mails, la preuve avait disparu. Le tunnel avait besoin
 * d'un ÉVIER, pas d'une réécriture.
 *
 * L'écriture part dans `after()` : elle ne bloque aucune réponse et ne peut
 * pas lever. Une mesure ne doit jamais pouvoir casser ce qu'elle mesure.
 *
 * Le jour où un vrai fournisseur arrive, c'est cette fonction qu'on remplace,
 * et elle seule.
 */

export type { AnalyticsEvent, AnalyticsProperties };

export function track(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {}
): void {
  // Une ligne, préfixée, parsable — `[analytics] event {json}`.
  console.info(`[analytics] ${event} ${JSON.stringify(properties)}`);
  // Puis l'évier, hors du chemin de la réponse. Il n'échoue jamais bruyamment.
  record(event, properties);
}
