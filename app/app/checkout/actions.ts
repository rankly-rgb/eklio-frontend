"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { StripeConfigError } from "@/lib/stripe/client";
import { kitTierSchema } from "@/lib/kit/tiers";

/*
 * Départ vers Stripe Checkout.
 *
 * Rien n'est accordé ici : cette action crée une session et redirige. Le
 * paiement, lui, ne devient un droit qu'au passage du webhook.
 */

export type StartCheckoutResult = { ok: false; error: string };

const GENERIC_ERROR =
  "We couldn't open the payment page. Please try again in a moment.";

const startCheckoutSchema = z.object({
  tier: kitTierSchema,
  projectId: z.uuid().nullable(),
  withMonthlyPresence: z.boolean(),
});

/**
 * Crée la session et redirige vers l'URL hébergée par Stripe.
 *
 * Ne rend jamais `{ ok: true }` : le succès EST la redirection. Le type de
 * retour ne porte donc que l'échec — `redirect()` lève, et ce qui suit n'est
 * atteint que si quelque chose s'est mal passé.
 */
export async function startCheckout(input: {
  tier: string;
  projectId: string | null;
  withMonthlyPresence: boolean;
}): Promise<StartCheckoutResult> {
  const parsed = startCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  let url: string;
  try {
    url = await createCheckoutSession(supabase, {
      userId: user.id,
      email: user.email,
      tier: parsed.data.tier,
      projectId: parsed.data.projectId,
      withMonthlyPresence: parsed.data.withMonthlyPresence,
    });
  } catch (error) {
    /*
     * Une variable Stripe manquante est une panne de CONFIGURATION, pas une
     * panne utilisateur : on la nomme côté serveur pour qu'elle soit réparable,
     * sans jamais faire fuiter le nom d'une variable vers le navigateur.
     */
    if (error instanceof StripeConfigError) {
      console.error(`[startCheckout] configuration : ${error.message}`);
    } else {
      const detail = error as { message?: string; type?: string };
      console.error(
        `[startCheckout] ÉCHEC ${detail?.type ?? "inconnu"} : ${detail?.message ?? String(error)}`,
        error
      );
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  redirect(url);
}
