import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getStripeClient } from "@/lib/stripe/client";
import { siteUrl } from "@/lib/site-url";

/*
 * Le portail de facturation Stripe — LA façon de résilier.
 *
 * ── POURQUOI UN PORTAIL HÉBERGÉ, ET PAS UN BOUTON À NOUS ─────────────────
 *
 * Parce qu'il doit MARCHER, et qu'un bouton à nous ne marcherait qu'à moitié.
 * Résilier n'est pas un appel d'API : c'est résilier, voir jusqu'à quand
 * l'accès reste ouvert, revenir sur sa décision, changer de carte quand la
 * banque en a émis une nouvelle, retrouver ses factures. Nous n'avons rien de
 * tout ça, et une résiliation qui échoue en silence sur un produit sans
 * primitive de remboursement est le pire endroit du produit pour bricoler.
 *
 * Le portail est aussi ce que la loi californienne sur la reconduction
 * automatique (Bus. & Prof. Code § 17602) exige de nommer dans le préavis
 * d'avant-prélèvement : « comment annuler ». Le lien de l'e-mail pointe donc
 * ici, et `flow_data` l'ouvre DIRECTEMENT sur l'écran de résiliation — pas sur
 * un tableau de bord où il faudrait la chercher. Un lien « annulez ici » qui
 * atterrit sur un menu est le genre de friction que ce produit interdit à ses
 * propres utilisatrices d'employer dans leur publicité.
 */

type Client = SupabaseClient<Database>;

export type PortalIntent = "manage" | "cancel";

/**
 * Le customer Stripe de cet utilisateur, s'il en a un.
 *
 * ⚠ ON N'EN CRÉE PAS ICI, contrairement à `ensureStripeCustomer`. Quelqu'un
 * sans customer n'a jamais rien payé : lui ouvrir un portail vide serait une
 * impasse, et créer un customer pour l'occasion laisserait des coquilles chez
 * Stripe pour tous ceux qui ont cliqué par curiosité.
 */
async function customerId(
  supabase: Client,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[portal] lecture profil", error);
    return null;
  }
  return data?.stripe_customer_id ?? null;
}

/**
 * Ouvre une session de portail et rend son URL, ou `null` si cette personne
 * n'a rien à y gérer.
 *
 * `subscriptionId` n'est requis que pour l'intention `cancel` : le flux de
 * résiliation de Stripe demande de quel abonnement il s'agit. Sans lui on
 * retombe sur le portail complet, qui sait résilier aussi — une marche de plus,
 * jamais une impasse.
 */
export async function createPortalSession(
  supabase: Client,
  {
    userId,
    intent = "manage",
    subscriptionId = null,
    returnPath = "/app/settings",
  }: {
    userId: string;
    intent?: PortalIntent;
    subscriptionId?: string | null;
    returnPath?: string;
  }
): Promise<string | null> {
  const customer = await customerId(supabase, userId);
  if (!customer) return null;

  const session = await getStripeClient().billingPortal.sessions.create({
    customer,
    return_url: `${siteUrl()}${returnPath}`,
    ...(intent === "cancel" && subscriptionId
      ? {
          flow_data: {
            type: "subscription_cancel" as const,
            subscription_cancel: { subscription: subscriptionId },
          },
        }
      : {}),
  });

  return session.url;
}
