import { NextResponse } from "next/server";

/*
 * Garde des routes de cron.
 *
 * Vercel Cron appelle ces routes en GET avec `Authorization: Bearer
 * $CRON_SECRET`. Sans ce contrôle, n'importe qui pourrait déclencher le
 * remplissage mensuel — c'est-à-dire une génération payante par utilisateur,
 * autant de fois qu'il le voudrait.
 *
 * Sans `CRON_SECRET` en environnement, la route REFUSE tout : un secret
 * manquant est une porte ouverte, pas une commodité de développement.
 *
 * ⚠ CE 404-LÀ EST SILENCIEUX. Vu de Vercel, rien ne distingue une variable
 * absente d'une route qui n'existe pas, et le corps de la réponse est
 * identique dans les deux cas d'échec (absente, ou simplement fausse). C'est
 * pourquoi `CRON_SECRET` est entrée dans `lib/env/required.ts` : EN
 * PRODUCTION le serveur refuse désormais de démarrer sans elle, et la
 * branche ci-dessous y est devenue inatteignable. Elle reste le comportement
 * normal en développement et en test, où l'absence de la clé est le cas
 * courant.
 *
 * Le 404 rendu à un appelant qui présente un mauvais secret, lui, ne change
 * pas : il n'apprend rien de ce qui existe derrière.
 */
export function authorizeCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron] CRON_SECRET absente — appel refusé.");
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return null;
}
