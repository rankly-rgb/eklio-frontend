import { NextResponse } from "next/server";

/*
 * Garde des routes de cron.
 *
 * Vercel Cron appelle ces routes en GET avec `Authorization: Bearer
 * $CRON_SECRET`. Sans ce contrôle, n'importe qui pourrait déclencher le
 * remplissage mensuel — c'est-à-dire une génération payante par utilisateur,
 * autant de fois qu'il le voudrait.
 *
 * ── DEUX ÉCHECS QUI NE SE RESSEMBLENT PAS ────────────────────────────────
 *
 * 1. `CRON_SECRET` ABSENTE DE L'ENVIRONNEMENT → **503**, en nommant la
 *    variable. Ce n'est pas un problème d'appelant, c'est un problème de
 *    déploiement : la route existe, elle n'est pas armée, et voici
 *    l'interrupteur. C'est la forme que `app/api/cron/content-month/route.ts`
 *    avait déjà écrite pour `CONTENT_GENERATION_ARMED`, mot pour mot : « un 404
 *    dirait que la route n'existe pas, et qui a réglé CRON_SECRET correctement
 *    irait chercher un problème de déploiement ». Elle n'avait jamais été
 *    appliquée à `CRON_SECRET` elle-même.
 *
 * 2. SECRET PRÉSENT MAIS MAUVAIS → **404**. Une porte fermée ne se présente
 *    pas : l'appelant n'apprend rien de ce qui existe derrière.
 *
 * ⚠ CE QUE LE 503 CONCÈDE, DÉLIBÉRÉMENT. Un appelant anonyme peut désormais
 * apprendre que ce déploiement n'a pas de `CRON_SECRET`. On l'accepte, parce
 * que quand la variable est absente il n'y a PAS d'autorisation à préserver —
 * personne ne peut s'authentifier, la route ne fait rien pour personne, et la
 * seule information divulguée est « ce déploiement est mal configuré », ce qui
 * est exactement ce qu'on veut visible.
 *
 * ⚠ ET CE QUE ÇA NE FAIT PLUS. `CRON_SECRET` a été, pendant quelques heures du
 * 2026-09-12, dans le registre « refuser de démarrer » de `lib/env/required.ts`.
 * Le site entier est tombé. Une variable qui ne sert que ces cinq routes ne
 * met pas la page d'accueil hors ligne : elle échoue ici, fort, et nulle part
 * ailleurs.
 */
export function authorizeCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error(
      "[cron] CRON_SECRET absente de l'environnement — route NON armée, 503."
    );
    return NextResponse.json(
      {
        error: "This cron route is not armed in this environment.",
        missing_env: "CRON_SECRET",
      },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return null;
}
