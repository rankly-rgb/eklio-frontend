import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConfirmationPoll } from "@/components/billing/confirmation-poll";
import { KIT_PLANS, MONTHLY_PRESENCE } from "@/lib/billing/plans";
import { parseKitTier } from "@/lib/kit/tiers";
import {
  getSubscription,
  isEntitledToMonthlyPresence,
} from "@/lib/billing/entitlements";

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
  const subscription = user ? await getSubscription(supabase, user.id) : null;
  // Une seule règle d'accès dans toute l'application (§7) — y compris ici,
  // sur un écran qui ne fait que raconter ce qui vient d'être encaissé.
  const subscribed = isEntitledToMonthlyPresence(subscription);

  const header = (
    <header className="flex flex-col gap-3">
      <p className="font-mono text-mono uppercase tracking-mono-16 text-ink-2">Payment</p>
      <h1 className="font-display text-question font-medium leading-tight tracking-h1">
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
            <p className="text-body leading-prose text-ink-2">
              We&rsquo;re confirming it with our payment provider. This usually
              takes a few seconds — this page updates on its own.
            </p>
            <p className="text-ui text-ink-2">
              We deliberately wait for that confirmation rather than trusting
              the redirect. Your kit unlocks the moment it lands.
            </p>
          </div>
        </ConfirmationPoll>
        <Link
          href="/app"
          className="text-ui text-ink-2 underline decoration-[var(--line)] underline-offset-4 hover:text-ink hover:decoration-[var(--accent)]"
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
        <p className="text-body leading-prose text-ink-2">
          {tier ? `Your ${KIT_PLANS[tier].label} brand kit is unlocked.` : "Your brand kit is unlocked."}{" "}
          {subscribed
            ? `${MONTHLY_PRESENCE.label} is active — your first month of content is ready to generate.`
            : "You can build it from your project as soon as you've picked a creative direction."}
        </p>
        <p className="text-ui text-ink-2">
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
          className="inline-flex h-10 items-center rounded-pill bg-ink px-[30px] text-ui font-semibold text-bg transition-colors hover:bg-ink-2"
        >
          {purchase?.project_id ? "Go to my project" : "Go to my projects"}
        </Link>
        {subscribed && purchase?.project_id && (
          <Link
            href={`/app/projets/${purchase.project_id}/presence`}
            className="inline-flex h-10 items-center rounded-pill border border-line px-[26px] text-ui text-ink transition-colors hover:bg-card"
          >
            {MONTHLY_PRESENCE.label}
          </Link>
        )}
      </div>
    </div>
  );
}
