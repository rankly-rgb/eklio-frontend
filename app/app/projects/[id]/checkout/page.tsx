import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/billing/checkout-form";
import { EthicsDisclaimer } from "@/components/ethics-disclaimer";
import { startCheckout } from "@/lib/actions/billing";
import { getEntitlement } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPage(
  props: PageProps<"/app/projects/[id]/checkout">
) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const wasCanceled = search.purchase === "canceled";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, user_id")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) redirect("/app");

  const { tier } = await getEntitlement(id);
  const checkoutAction = startCheckout.bind(null, id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/app"
          className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce hover:opacity-60"
        >
          {project.name}
        </Link>
        <h1 className="font-display text-3xl leading-tight md:text-4xl">
          Choose what you need.
        </h1>
        <p className="max-w-xl text-gris-fonce">
          Every plan includes the three directions you have already seen and the
          full identity behind them. What changes is how much of the site we
          write for you.
        </p>
      </header>

      {wasCanceled && (
        <p className="rounded-lg border border-noir/20 bg-cream-light p-4 text-sm text-gris-fonce">
          Checkout was canceled — nothing was charged. Your brief and your
          directions are exactly where you left them.
        </p>
      )}

      {tier && (
        <p className="rounded-lg border border-noir/20 bg-cream-light p-4 text-sm text-gris-fonce">
          You already have <strong>{tier.name}</strong> on this practice. Buying
          a higher plan adds to it — nothing you already have is taken away.
        </p>
      )}

      <CheckoutForm action={checkoutAction} />

      <EthicsDisclaimer />
    </div>
  );
}
