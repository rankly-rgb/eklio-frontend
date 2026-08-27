import type { NextRequest } from "next/server";
import { authenticate, json, notFound, serverError } from "@/lib/api/handler";
import {
  getSubscription,
  isEntitledToMonthlyPresence,
} from "@/lib/billing/entitlements";
import { createMonthlyPresenceCheckout } from "@/lib/stripe/checkout";

/*
 * POST /api/content/[id]/unlock — ouvre le checkout Monthly Presence depuis
 * une tuile verrouillée.
 *
 * La décision d'accès passe par `isEntitledToMonthlyPresence`, comme partout
 * ailleurs (§7) : un praticien déjà couvert — y compris en `past_due` dans sa
 * grâce de trois jours — ne doit pas se voir proposer de repayer.
 */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/content/[id]/unlock">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { supabase, userId, email } = auth.session;

  // La RLS de `monthly_presence_content` est propriétaire-only en lecture :
  // une tuile d'autrui ne remonte rien, donc 404.
  const { data: item } = await supabase
    .from("monthly_presence_content")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!item) return notFound();

  const subscription = await getSubscription(supabase, userId);
  if (isEntitledToMonthlyPresence(subscription)) {
    /*
     * Déjà abonné, et pourtant devant une tuile verrouillée : c'est le cron du
     * mois qui n'est pas encore passé, pas un droit manquant. On ne renvoie
     * surtout pas vers un second paiement.
     */
    return json({ entitled: true, checkoutUrl: null });
  }

  if (!email) return serverError("POST /api/content/unlock", "no email on session");

  try {
    const checkoutUrl = await createMonthlyPresenceCheckout(supabase, {
      userId,
      email,
    });
    return json({ entitled: false, checkoutUrl });
  } catch (error) {
    return serverError("POST /api/content/unlock", error);
  }
}
