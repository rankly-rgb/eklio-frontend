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
        <p className="label-mono text-ink-muted">Payment</p>
        <h1 className="font-display text-[40px] leading-tight">
          Nothing was charged.
        </h1>
      </header>

      <p className="text-lg leading-relaxed text-ink-soft">
        You closed the payment page before finishing. Your brief and your
        creative directions are exactly where you left them.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/app"
          className="rounded bg-ink px-5 py-2.5 font-mono text-sm text-paper transition-colors hover:bg-ink-soft"
        >
          Back to my projects
        </Link>
        <Link
          href="/pricing"
          className="rounded border border-rule px-5 py-2.5 font-mono text-sm transition-colors hover:bg-paper-raised"
        >
          See the plans again
        </Link>
      </div>
    </div>
  );
}
