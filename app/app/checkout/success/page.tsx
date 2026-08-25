import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConfirmationPoll } from "@/components/billing/confirmation-poll";
import { KIT_PLANS, MONTHLY_PRESENCE } from "@/lib/billing/plans";
import { parseKitTier } from "@/lib/kit/tiers";
import { getSubscriptionState } from "@/lib/billing/entitlements";

/*
 * Retour de Stripe après un paiement accepté.
 *
 * CETTE PAGE N'ACCORDE RIEN. Elle ne fait que RELIRE ce que le webhook a
 * écrit. La distinction est la règle de sécurité centrale du lot : un
 * `success_url` se forge à la main dans la barre d'adresse, un webhook signé
 * ne se forge pas. Tant que `purchases` ne porte pas la ligne payée, l'écran
 * dit « confirmation en cours » et le kit reste verrouillé.
 *
 * Le rendu est dynamique par construction (session + `searchParams`) : rien
 * n'est mis en cache, chaque rafraîchissement relit la base.
 */

export const metadata = {
  title: "Payment received — Eklio",
};

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/app/checkout/success">) {
  const params = await searchParams;
  const sessionId = Array.isArray(params.session_id)
    ? params.session_id[0]
    : params.session_id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * La RLS de `purchases` est propriétaire-only en lecture : cette requête ne
   * peut donc rendre que les achats de l'utilisateur connecté, même si
   * quelqu'un colle l'identifiant de session d'un autre.
   */
  const { data: purchase } = sessionId
    ? await supabase
        .from("purchases")
        .select("tier, project_id, status")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle()
    : { data: null };

  const confirmed = purchase?.status === "paid";
  const tier = parseKitTier(purchase?.tier);
  const subscription = user
    ? await getSubscriptionState(supabase, user.id)
    : null;

  const header = (
    <header className="flex flex-col gap-3">
      <p className="label-mono text-ink-muted">Payment</p>
      <h1 className="font-display text-[40px] leading-tight">
        {confirmed ? "You're all set." : "Payment received."}
      </h1>
    </header>
  );

  if (!confirmed) {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-8 px-6 py-16">
        {header}
        <ConfirmationPoll>
          <div className="flex flex-col gap-4">
            <p className="text-lg leading-relaxed text-ink-soft">
              We&rsquo;re confirming it with our payment provider. This usually
              takes a few seconds — this page updates on its own.
            </p>
            <p className="text-sm text-ink-muted">
              We deliberately wait for that confirmation rather than trusting
              the redirect. Your kit unlocks the moment it lands.
            </p>
          </div>
        </ConfirmationPoll>
        <Link
          href="/app"
          className="font-mono text-sm underline hover:opacity-60"
        >
          Back to your projects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-8 px-6 py-16">
      {header}

      <div className="flex flex-col gap-4">
        <p className="text-lg leading-relaxed text-ink-soft">
          {tier ? `Your ${KIT_PLANS[tier].label} brand kit is unlocked.` : "Your brand kit is unlocked."}{" "}
          {subscription?.isActive
            ? `${MONTHLY_PRESENCE.label} is active — your first month of content is ready to generate.`
            : "You can build it from your project as soon as you've picked a creative direction."}
        </p>
        <p className="text-sm text-ink-muted">
          A receipt is on its way to your inbox from our payment provider.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={
            purchase?.project_id
              ? `/app/projets/${purchase.project_id}/directions`
              : "/app"
          }
          className="rounded bg-ink px-5 py-2.5 font-mono text-sm text-paper transition-colors hover:bg-ink-soft"
        >
          {purchase?.project_id ? "Go to my project" : "Go to my projects"}
        </Link>
        {subscription?.isActive && purchase?.project_id && (
          <Link
            href={`/app/projets/${purchase.project_id}/presence`}
            className="rounded border border-rule px-5 py-2.5 font-mono text-sm transition-colors hover:bg-paper-raised"
          >
            {MONTHLY_PRESENCE.label}
          </Link>
        )}
      </div>
    </div>
  );
}
