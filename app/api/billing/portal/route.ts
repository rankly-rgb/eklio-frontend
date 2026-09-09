import { authenticate, json, serverError } from "@/lib/api/handler";
import { getSubscription } from "@/lib/billing/entitlements";
import { createPortalSession } from "@/lib/stripe/portal";
import { StripeConfigError } from "@/lib/stripe/client";
import { track } from "@/lib/analytics";

/*
 * POST /api/billing/portal — ouvre le portail Stripe de cette praticienne.
 *
 * C'est le chemin de résiliation du produit, et le seul. Il est atteint depuis
 * les réglages ET depuis le préavis d'avant-prélèvement, où « comment annuler »
 * n'est pas une politesse mais une mention exigée (cf. `lib/stripe/portal.ts`).
 *
 * `?intent=cancel` ouvre Stripe directement sur l'écran de résiliation plutôt
 * que sur le tableau de bord.
 */
export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { supabase, userId } = auth.session;

  const intent =
    new URL(request.url).searchParams.get("intent") === "cancel"
      ? "cancel"
      : "manage";

  /*
   * L'abonnement sert UNIQUEMENT à viser le bon écran. Son absence n'est pas
   * un refus : elle peut vouloir gérer sa carte ou relire ses factures sans
   * être abonnée à quoi que ce soit.
   */
  const subscription = await getSubscription(supabase, userId);

  try {
    const url = await createPortalSession(supabase, {
      userId,
      intent,
      subscriptionId: subscription?.stripeSubscriptionId ?? null,
    });

    /*
     * Pas de customer Stripe : cette personne n'a jamais rien payé. On le dit
     * plutôt que de rendre une erreur — il n'y a rien de cassé, il n'y a rien
     * à gérer.
     */
    if (!url) return json({ url: null, reason: "nothing_to_manage" });

    track("billing_portal_opened", { intent });
    return json({ url });
  } catch (error) {
    if (error instanceof StripeConfigError) {
      console.error(`[billing/portal] configuration : ${error.message}`);
    }
    return serverError("POST /api/billing/portal", error);
  }
}
