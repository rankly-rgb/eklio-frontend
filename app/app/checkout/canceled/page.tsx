import Link from "next/link";

/*
 * Retour de Stripe quand le praticien a fermé le checkout.
 *
 * Rien n'a été facturé, rien n'a changé, et l'écran le dit sans insister : pas
 * de relance, pas d'offre de dernière minute, pas d'urgence. Le produit tient
 * le même ton que la copy qu'il fait écrire.
 */

export const metadata = {
  title: "Checkout canceled — Eklio",
};

export default function CheckoutCanceledPage() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-mono uppercase tracking-mono-16 text-ink-2">Payment</p>
        <h1 className="font-display text-question font-medium leading-tight tracking-h1">
          Nothing was charged.
        </h1>
      </header>

      <p className="text-body leading-prose text-ink-2">
        You closed the payment page before finishing. Your brief and your
        creative directions are exactly where you left them.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/app"
          className="inline-flex h-10 items-center rounded-pill bg-ink px-[30px] text-ui font-semibold text-bg transition-colors hover:bg-ink-2"
        >
          Back to my projects
        </Link>
        <Link
          href="/pricing"
          className="inline-flex h-10 items-center rounded-pill border border-line px-[26px] text-ui text-ink transition-colors hover:bg-card"
        >
          See the plans again
        </Link>
      </div>
    </div>
  );
}
