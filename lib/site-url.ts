/*
 * L'URL de base du déploiement — SERVEUR UNIQUEMENT.
 *
 * Utilisée partout où un lien doit revenir vers l'app depuis l'extérieur :
 * confirmation d'e-mail, désabonnement, retour de Stripe Checkout. Sans
 * `NEXT_PUBLIC_SITE_URL`, ces liens pointaient vers `localhost:3000` — correct
 * en dev, mais silencieusement cassé sur un déploiement Preview où personne
 * ne pense à renseigner cette variable à la main (son URL change à chaque
 * déploiement). `VERCEL_URL`, fournie automatiquement par Vercel sur CHAQUE
 * déploiement (Preview comme Production), comble ce trou sans configuration :
 * elle n'a pas de schéma, d'où le `https://` ajouté ici.
 */

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
