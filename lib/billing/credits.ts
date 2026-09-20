import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── LE COMPTEUR DE CRÉDITS, CÔTÉ LECTURE ────────────────────────────────
 *
 * Une seule source, `credit_meter()` en base, scopée `auth.uid()`. Ce fichier
 * ne décide rien et ne calcule rien : il lit et il typage. Le plafond, le
 * consommé et le reste sont trois nombres que la base tient déjà, et les
 * recalculer ici produirait une quatrième réponse à une question qui en a une.
 *
 * ⚠ `limit: null` VEUT DIRE ILLIMITÉ, ET L'ÉCRAN DOIT ÉCRIRE UN MOT.
 *
 * Pas « 999 », pas « ∞ » posé sur une barre de progression vide. Le swap est
 * la seule action qui doit ne jamais la faire hésiter : c'est ce qui transforme
 * « celui-ci n'est pas moi » en un geste plutôt qu'en une décision budgétaire.
 * Un compteur qui montre un plafond, même très haut, transforme un illimité en
 * une limite qu'on n'a pas encore atteinte.
 */

type Client = SupabaseClient<Database>;

export type CreditKind = "post_generation" | "swap" | "regeneration" | "custom_visual";

export type CreditLine = {
  kind: CreditKind;
  /** `null` = unlimited. The screen writes a word here, never a number. */
  limit: number | null;
  consumed: number;
  /** `null` when `limit` is null — there is nothing to count down from. */
  remaining: number | null;
};

export type CreditMeter = Record<CreditKind, CreditLine>;

const KINDS: CreditKind[] = ["post_generation", "swap", "regeneration", "custom_visual"];

function emptyLine(kind: CreditKind): CreditLine {
  return { kind, limit: 0, consumed: 0, remaining: 0 };
}

/**
 * Le compteur de l'utilisatrice courante, pour un mois.
 *
 * ── ÉCHEC FERMÉ, ET CE QUE « FERMÉ » VEUT DIRE ICI ──────────────────────
 *
 * Une erreur de lecture rend un compteur à zéro plutôt que null. C'est le
 * repli sûr dans le seul sens qui compte : l'écran affiche « rien de
 * disponible » au lieu d'un illimité inventé, et une dépense reste de toute
 * façon impossible sans passer par `reserve_credit`, qui ne lit pas ceci.
 *
 * Un compteur faux dans ce sens-là se voit et remonte en support. Dans
 * l'autre, il ne remonte jamais.
 */
export async function getCreditMeter(
  supabase: Client,
  month?: string
): Promise<CreditMeter> {
  const { data, error } = await supabase.rpc("credit_meter", {
    p_month: month ?? undefined,
  });

  const meter = Object.fromEntries(KINDS.map((k) => [k, emptyLine(k)])) as CreditMeter;

  if (error) {
    console.error("[credits] credit_meter", error);
    return meter;
  }

  const raw = (data ?? {}) as Record<string, { limit: number | null; consumed: number; remaining: number | null }>;
  for (const kind of KINDS) {
    const line = raw[kind];
    if (!line) continue;
    meter[kind] = {
      kind,
      limit: line.limit ?? null,
      consumed: line.consumed ?? 0,
      remaining: line.remaining ?? null,
    };
  }
  return meter;
}

/**
 * La phrase qu'on met à l'écran pour une ligne.
 *
 * ⚠ ELLE NE COMPTE PAS À REBOURS QUAND IL EN RESTE BEAUCOUP. « 4 left » sur un
 * plafond de 4 est une information ; « 10 left » sur un plafond de 10 est une
 * anxiété qu'on a fabriquée avant qu'elle serve à quoi que ce soit. Le nombre
 * n'apparaît que lorsqu'il approche.
 */
export function creditPhrase(line: CreditLine): string {
  if (line.limit === null) return "unlimited";
  if (line.remaining === null) return "unlimited";
  if (line.remaining === 0) return "none left this month";
  if (line.remaining <= Math.max(1, Math.ceil(line.limit / 3))) {
    return `${line.remaining} left this month`;
  }
  return `${line.limit} a month`;
}

/**
 * Faut-il montrer cette ligne du tout ?
 *
 * ⚠ LE ZÉRO N'EST PAS AFFICHÉ, ET C'EST LA MÊME RÈGLE QUE « SUPPRIME LES
 * COMPTEURS À ZÉRO » sur le flux. Un essai n'a pas de visuel custom ; lui
 * afficher « 0 a month » est un mur là où il n'y avait pas de porte. La ligne
 * disparaît, et la fonctionnalité est proposée ailleurs, au moment où elle
 * devient vraie.
 */
export function shouldShow(line: CreditLine): boolean {
  if (line.limit === 0) return false;
  // Le swap est illimité par construction : il n'a rien à compter, et le dire
  // une fois suffit.
  if (line.kind === "swap") return true;
  return true;
}
