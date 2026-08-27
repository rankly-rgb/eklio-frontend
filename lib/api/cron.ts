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
