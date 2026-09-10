"use client";

import type { AnalyticsEvent, AnalyticsProperties } from "@/lib/analytics-events";

/*
 * ── CE QUI EST ÉMIS DEPUIS LE NAVIGATEUR, ET CE QUE ÇA VAUT ─────────────
 *
 * ⚠ CES ÉVÉNEMENTS N'ATTEIGNENT PAS `funnel_events`, ET LE FICHIER LE DIT
 * PLUTÔT QUE DE LAISSER CROIRE LE CONTRAIRE.
 *
 * Deux composants client appelaient `track()` depuis toujours —
 * `asset-library-view.tsx` et `in-situ-panel.tsx`. `lib/analytics.ts` porte
 * « SERVEUR UNIQUEMENT » dans son en-tête depuis le premier jour, et ça
 * compilait quand même : tant que `track()` ne faisait qu'un `console.info`,
 * rien ne distinguait un appel serveur d'un appel navigateur. Ces
 * `console.info` partaient donc dans la console de la PRATICIENNE, où
 * personne ne les a jamais lus. Ce n'était pas de la mesure, c'était du bruit
 * qui ressemblait à de la mesure.
 *
 * Le comportement est conservé À L'IDENTIQUE ici — même ligne, même format —
 * pour ne rien casser et ne rien inventer. Ce qui change, c'est que le nom du
 * module dit ce qui se passe.
 *
 * ── POURQUOI PAS UNE BALISE, COMME LA PAGE D'ATTERRISSAGE ───────────────
 *
 * `POST /api/e` est non authentifié : son vocabulaire est fermé à deux noms
 * précisément parce que n'importe qui peut l'appeler. Ces événements-ci
 * portent des identifiants de kit et des clés d'actifs, donc ils auraient
 * besoin d'un chemin d'écriture authentifié — ce qui est du travail, pas une
 * ligne. Aucun d'eux n'est une étape du tunnel : ils décrivent ce qu'une
 * cliente PAYANTE fait de sa bibliothèque d'actifs, pas comment quelqu'un
 * devient cliente.
 *
 * Le jour où l'un d'eux devient une question qu'on se pose vraiment, il
 * déménage côté serveur — la route qui rend l'écran est déjà là.
 */

export function trackClient(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {}
): void {
  console.info(`[analytics] ${event} ${JSON.stringify(properties)}`);
}
