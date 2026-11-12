/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE DÉBIT DU CRON SEO — UNE CONSTANTE, UNE GARDE DE TEMPS (session 3)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * En session 2, la route servait UNE abonnée par appel de 120 s : tout était
 * séquentiel, abonnée après abonnée, pièce après pièce. Ici :
 *
 *   - les pièces d'une abonnée partent ensemble (`runSeoMonth`, phase A) ;
 *   - plusieurs abonnées tournent à la fois.
 *
 * ⚠ UNE SEULE CONSTANTE BORNE LES APPELS SIMULTANÉS AU FOURNISSEUR :
 * `SEO_MAX_PARALLEL_CALLS`. Une abonnée a au plus `PIECES_PER_SUBSCRIBER` appels en
 * vol (un par pièce : la réparation et la réécriture d'une pièce suivent son premier
 * jet, jamais en même temps), donc on fait tourner `floor(cap / 3)` abonnées à la fois.
 * Si le fournisseur répond 429 (`rate_limited`), c'est elle qu'on baisse.
 *
 * ⚠ LA GARDE DE TEMPS. On ne commence pas une abonnée si le temps qui reste ne
 * suffit pas à finir la plus lente mesurée. `maxDuration` ne change pas.
 *
 * Aucune file externe, aucun service : un pool en mémoire, le temps d'un appel.
 * Ce qui n'est pas commencé reste dû, et le déclenchement suivant le reprend
 * (la base sait ce qui est fait : `claim_seo_slot`).
 */

/** Appels simultanés au fournisseur, toutes abonnées confondues. LA constante à régler. */
export const SEO_MAX_PARALLEL_CALLS = 15;

/** Pièces d'un mois standard (1 page locale + 2 articles), donc appels en vol par abonnée. */
export const PIECES_PER_SUBSCRIBER = 3;

/**
 * La plus lente des abonnées mesurées avant le premier retour de cet appel : 186 s
 * (profil D, décembre, session 2 — séquentielle, avec une quarantaine). Le pool la
 * remplace par ce qu'il mesure dès qu'une abonnée a fini plus lentement.
 */
export const SLOWEST_SUBSCRIBER_MS = 186_000;

/** Ce qu'on garde entre la fin prévue de la dernière abonnée et `maxDuration`. */
export const SAFETY_MARGIN_MS = 20_000;

export function subscribersInFlight(maxParallelCalls: number = SEO_MAX_PARALLEL_CALLS): number {
  return Math.max(1, Math.floor(maxParallelCalls / PIECES_PER_SUBSCRIBER));
}

export type PoolResult<R> = {
  served: R[];
  /** Pas commencées : la garde de temps les a laissées au déclenchement suivant. */
  deferred: string[];
  /** Durée de chaque abonnée servie, en ms, dans l'ordre de fin. */
  durations: Array<{ userId: string; ms: number }>;
  slowestMs: number;
};

/**
 * Sert les candidates par un pool de `subscribersInFlight(cap)` travailleuses. Une
 * travailleuse prend la suivante seulement si `écoulé + la plus lente ≤ délai`.
 */
export async function runSeoPool<R>(input: {
  candidates: readonly string[];
  serve: (userId: string) => Promise<R>;
  /** Le temps total de l'appel, en ms (`maxDuration` − marge). */
  windowMs: number;
  maxParallelCalls?: number;
  slowestMs?: number;
  now?: () => number;
}): Promise<PoolResult<R>> {
  const now = input.now ?? Date.now;
  const started = now();
  let slowest = input.slowestMs ?? SLOWEST_SUBSCRIBER_MS;
  const queue = [...input.candidates];
  const served: R[] = [];
  const deferred: string[] = [];
  const durations: Array<{ userId: string; ms: number }> = [];

  const worker = async () => {
    for (;;) {
      const userId = queue.shift();
      if (userId === undefined) return;
      if (now() - started + slowest > input.windowMs) {
        deferred.push(userId, ...queue.splice(0));
        return;
      }
      const t0 = now();
      served.push(await input.serve(userId));
      const ms = now() - t0;
      durations.push({ userId, ms });
      slowest = Math.max(slowest, ms);
    }
  };
  await Promise.all(Array.from({ length: subscribersInFlight(input.maxParallelCalls) }, worker));
  return { served, deferred, durations, slowestMs: slowest };
}
