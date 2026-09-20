import { NextResponse } from "next/server";
import type { ContentResult } from "@/lib/data/content";

/*
 * The one place a content refusal becomes an HTTP status.
 *
 * `not_found` is 404 and never 403, because a 403 confirms that someone
 * else's item exists. `payment_required` is 402 rather than a silent empty
 * list: a refusal that renders as "nothing here" reads like a bug, and this
 * one is an offer.
 *
 * ── ⚠ `code` EST À CÔTÉ DE `error`, PAS DEDANS ──────────────────────────
 *
 * Le corps porte `{ error: "<phrase>", code: "<code>" }`.
 *
 * `error` reste une CHAÎNE parce que tous les appelants existants la lisent
 * comme telle et l'affichent — l'éditeur d'item, les préférences, le check-in.
 * La transformer en objet aurait affiché « [object Object] » partout.
 *
 * `code` est ajouté parce qu'un écran a parfois besoin de dire autre chose que
 * la phrase générique, et qu'il ne peut pas le décider sans le code. Le flux
 * de cartes en dépend : `bank_exhausted` s'y affiche « There is nothing else
 * for this one yet », et non « That could not be swapped. Try again. » — la
 * seconde phrase invite à réessayer, et réessayer tirerait le même rien.
 *
 * ⚠ CE CHAMP A DÉJÀ MANQUÉ UNE FOIS. Le flux lisait `body.error.code` sur un
 * corps où `error` était une chaîne : la branche `bank_exhausted` ne pouvait
 * pas partir, et une banque vide s'annonçait « réessayez ». Trouvé en relisant
 * la table des statuts, pas par un test — d'où `respond.test.ts`.
 */
export function contentResponse<T>(result: ContentResult<T>): NextResponse {
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.status }
    );
  }
  return NextResponse.json(result.data);
}
