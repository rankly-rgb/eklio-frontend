/*
 * Un limiteur de débit en mémoire — fenêtre glissante, par clé.
 *
 * ⚠ CE QU'IL EST, ET CE QU'IL N'EST PAS.
 *
 * Il est PAR PROCESSUS. Deux instances serverless comptent séparément, et un
 * redéploiement remet tout à zéro. Ce n'est donc PAS la limite qui protège le
 * budget : celle-là est `consume_generation_credit`, atomique, en base, et une
 * allocation épuisée le reste quelle que soit l'instance qui répond.
 *
 * Ce limiteur est un RALENTISSEUR : il coupe la boucle serrée — le script qui
 * tire mille requêtes à la seconde — avant qu'elle n'atteigne la base. Le
 * distinguer de la vraie limite compte, parce que se croire protégé par lui
 * serait précisément l'erreur que ce lot corrige.
 *
 * Le jour où un Redis existe, c'est cette fonction qu'on remplace, et elle
 * seule.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Balayage paresseux : sans lui la Map ne rétrécit jamais. */
function sweep(now: number): void {
  if (windows.size < 512) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitVerdict =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now: number = Date.now()
): RateLimitVerdict {
  sweep(now);

  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (window.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  window.count += 1;
  return { allowed: true, remaining: limit - window.count };
}

/** Vide les fenêtres — tests uniquement. */
export function resetRateLimits(): void {
  windows.clear();
}
