/*
 * ══════════════════════════════════════════════════════════════════════════
 *  « WHY THIS ONE: » — UN PRÉFIXE, ÉCRIT UNE FOIS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * La ligne de justification est demandée au modèle comme la SUITE de
 * « Why this one: » (`copy-batch.ts`), et l'écran pose ce préfixe devant elle.
 * Mesuré sur le mois de novembre 2026 du kit 45de0dac : 23 justifications sur
 * 24 commençaient déjà par « Why this one: ». Chaque carte du flux affichait
 * donc « Why this one: Why this one: ».
 *
 * ⚠ LE PRÉFIXE APPARTIENT À L'ÉCRAN, PAS À LA DONNÉE. Il est retiré à la
 * lecture de la réponse du modèle (rien de neuf ne l'écrit en base) ET à
 * l'affichage (les lignes déjà écrites le portent, et on ne réécrit pas la base
 * pour une question de présentation).
 */

const PREFIX = /^\s*why\s+this\s+one\s*[:：\-–—]?\s*/i;

/** La justification sans son préfixe, autant de fois qu'il a été répété. */
export function rationaleBody(text: string | null | undefined): string {
  let body = (text ?? "").trim();
  for (;;) {
    const next = body.replace(PREFIX, "");
    if (next === body) break;
    body = next.trim();
  }
  if (body.length === 0) return "";
  /* « Why this one: it names… » — la phrase reprend après le préfixe. */
  return body[0].toUpperCase() + body.slice(1);
}
