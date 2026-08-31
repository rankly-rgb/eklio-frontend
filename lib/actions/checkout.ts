"use server";

import { headers } from "next/headers";

import { stripe } from "@/lib/stripe/client";
import { getOrCreateWorkspace } from "@/lib/eklio/project";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Ouvre une session de paiement Stripe pour un palier.
 *
 * ⚠ Le montant vient de `plans`, pas d'un prix recopié dans Stripe ni d'une
 * constante ici. `plans` est le seul endroit où une allocation et son prix
 * sont écrits ; changer ce qu'un palier vaut est un UPDATE sur cette table, et
 * le checkout suit sans redéploiement.
 */
export async function startCheckout(
  tier: string
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) return { ok: false, message: "Sign in first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const { data: plan } = await supabase
    .from("plans")
    .select("tier,label,price_cents")
    .eq("tier", tier)
    .maybeSingle();

  if (!plan || plan.price_cents <= 0) {
    return { ok: false, message: "That plan is not for sale." };
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // Une seule correspondance utilisateur ↔ client Stripe, portée par
  // `profiles.stripe_customer_id` en unique, partagée par le paiement unique
  // et l'abonnement.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const client = stripe();
  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await client.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    // `profiles` n'expose pas cette colonne en écriture au client : elle passe
    // par le service_role, comme le webhook.
    await createAdminClient()
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await client.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.price_cents,
          product_data: {
            name: `Eklio — ${plan.label}`,
            description: "Your brand kit, and the prompt for your site builder.",
          },
        },
      },
    ],
    success_url: `${origin}/app/kit?paid=1`,
    cancel_url: `${origin}/app/checkout?cancelled=1`,
    // Le webhook n'a que ça pour savoir quel projet créditer. Sans project_id,
    // une cliente qui a payé reste sur le plan free.
    metadata: {
      project_id: workspace.projectId,
      user_id: user.id,
      tier: plan.tier,
    },
  });

  if (!session.url) return { ok: false, message: "Stripe did not return a checkout URL." };
  return { ok: true, url: session.url };
}
