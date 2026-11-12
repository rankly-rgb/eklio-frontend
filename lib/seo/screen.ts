import type { PieceStatus } from "@/lib/seo/db";
import { stateName } from "@/lib/seo/checks";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  CE QUE L'ÉCRAN « WEBSITE PAGES » MONTRE — UNE FONCTION PURE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le texte d'interface est en anglais américain, sobre, sans jargon SEO : on
 * parle des « people searching for EMDR therapy in Oakland », jamais d'un
 * « primary keyword ».
 *
 * Les quatre états, et pourquoi chacun est honnête :
 *
 *   no_subscription  pas de Monthly Presence, et rien d'écrit avant : une
 *                    explication et un lien vers l'offre ;
 *   not_yet          abonnée, mais rien pour ce mois (génération éteinte ou pas
 *                    encore passée) : la date d'arrivée, pas un faux « en cours » ;
 *   list             ses pièces du mois ;
 *   read_only        plus d'abonnement, mais un historique : il reste à elle,
 *                    en lecture seule (la base refuse l'écriture, RLS).
 */

export type PagesScreen =
  | { kind: "no_subscription" }
  | { kind: "not_yet"; arrives: string }
  | { kind: "state_unavailable"; state: string }
  | { kind: "empty_month" }
  | { kind: "list"; readOnly: boolean };

export function pagesScreen(input: {
  entitled: boolean;
  hasHistory: boolean;
  monthHasPieces: boolean;
  /**
   * Ce que `licenceEligibility` a répondu — LA source qui fait aussi refuser la
   * génération au pipeline. `state_unverified` : l'État n'a pas de règle publicitaire
   * vérifiée (F12) ; rien ne sera généré tant qu'il ne l'est pas.
   */
  eligibility: { ok: true } | { ok: false; reason: "licence_missing" | "state_unverified"; state: string | null };
  /**
   * Le drapeau `SEO_GENERATION_ARMED`. ⚠ IL NE CHANGE PAS CE QUE L'ÉCRAN DIT : un État
   * non vérifié l'est, drapeau allumé ou éteint, et une praticienne d'un État vérifié lit
   * la date d'arrivée dans les deux cas (consigne de la session 1). Il est passé pour que
   * le test le prouve.
   */
  armed: boolean;
  /** Le mois affiché, `YYYY-MM-01`. */
  month: string;
  now: Date;
}): PagesScreen {
  // Son historique reste à elle, abonnement ou pas.
  if (!input.entitled && input.hasHistory) return { kind: "list", readOnly: true };
  if (input.entitled && input.monthHasPieces) return { kind: "list", readOnly: false };
  /*
   * ⚠ SESSION 3 : PAS DE PROMESSE À UN ÉTAT NON VÉRIFIÉ. Le profil B (New York) lisait
   * « Your first pages arrive on December 1, 2026. » alors que le pipeline la refuse à
   * chaque mois. Ni date ni promesse de disponibilité — et pas non plus l'offre « three
   * pages every month » à une praticienne qui n'en recevrait aucune : ce cas passe AVANT
   * l'absence d'abonnement.
   */
  if (!input.eligibility.ok && input.eligibility.reason === "state_unverified") {
    return { kind: "state_unavailable", state: stateName(input.eligibility.state) ?? "your state" };
  }
  if (!input.entitled) return { kind: "no_subscription" };
  const current = monthKey(input.now);
  // Un mois passé sans pièce reste vide ; le mois courant et les suivants attendent le prochain 1ᵉʳ.
  if (input.month < current) return { kind: "empty_month" };
  return { kind: "not_yet", arrives: arrivalDate(input.now) };
}

/** Le premier du mois de `now`, `YYYY-MM-01`. */
export function monthKey(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** Un `?month=` valide, sinon le mois courant. */
export function parseMonthParam(raw: string | string[] | undefined, now: Date): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(v) ? v : monthKey(now);
}

/**
 * Le jour où les pages arrivent : le 1ᵉʳ du mois suivant. Le cron écrit le mois
 * qui vient (`nextMonthKey`), comme le mois Instagram.
 */
export function arrivalDate(now: Date): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(next);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Où en est la pièce, en mots à elle. */
export const STATUS_TEXT: Record<Exclude<PieceStatus, "draft" | "quarantined">, string> = {
  needs_review: "Ready for your review",
  approved: "Reviewed — ready to copy",
  exported: "Copied — not marked as published yet",
  published: "On your site",
};

/** Le seul appel à l'action de la ligne. */
export const STATUS_CTA: Record<Exclude<PieceStatus, "draft" | "quarantined">, string> = {
  needs_review: "Review",
  approved: "Copy to your site",
  exported: "Mark as published",
  published: "View",
};

/** « People searching for “EMDR therapy in Oakland, CA” » — la cible, sans jargon. */
export function searchLine(query: string): string {
  return `For people searching “${query}”`;
}

/** Ce que l'export demande avant de s'ouvrir. */
export function exportOpen(status: PieceStatus): boolean {
  return status === "approved" || status === "exported" || status === "published";
}

/** Le message d'un État non vérifié, mot pour mot (session 3). */
export function stateUnavailableText(state: string): string {
  return `Website pages aren't available yet for clinicians licensed in ${state}. Nothing is generated or counted for you until they are.`;
}
