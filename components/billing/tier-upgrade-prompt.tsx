import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { KIT_PLANS } from "@/lib/billing/plans";
import type { SurfaceAccess } from "@/lib/billing/surface-access";

/*
 * What she sees when a surface is above her tier.
 *
 * ⚠ NEVER A DEAD CONTROL, NEVER A SILENT ABSENCE. Those are the two ways this
 * normally goes wrong, and both are worse than saying no. A greyed button
 * teaches her the product is broken; a section that simply is not there
 * teaches her nothing at all and she never asks — which also means Eklio never
 * learns that anyone wanted it.
 *
 * So: the thing is named, the tier that contains it is named, the price is
 * named, and one link goes to the checkout already carrying that tier. She
 * can read the whole trade in one card without leaving the page she is on.
 *
 * ⚠ IT NAMES WHAT SHE ALREADY HAS, TOO. "Signature — $249" alone reads as a
 * demand; "You're on Starter. Type is part of Practice." reads as an answer.
 * A customer who paid should never have to work out which of three things she
 * bought.
 *
 * ⚠ AND IT IS NOT AN UPSELL PANEL. It renders only where a surface is
 * actually gated, in place of that surface — never beside one she already
 * has. Today it renders NOWHERE, because every row of `SURFACE_MIN_TIER` is
 * `starter`; that is the permissive default being visible rather than
 * assumed. The day a row moves, this is already what appears.
 */
export function TierUpgradePrompt({
  access,
  projectId,
}: {
  /** The refusal itself, so the card cannot disagree with the guard. */
  access: Extract<SurfaceAccess, { reason: "payment_required" }>;
  /** Where the checkout attaches the payment. Null before a project exists. */
  projectId: string | null;
}) {
  const plan = KIT_PLANS[access.requiredTier];
  const current = access.currentTier ? KIT_PLANS[access.currentTier] : null;
  const price = `$${Math.round(plan.amountCents / 100)}`;

  const checkoutHref = projectId
    ? `/app/checkout?plan=${plan.tier}&project=${projectId}`
    : `/pricing#${plan.tier}`;

  return (
    <section className="flex max-w-[560px] flex-col gap-4 rounded-card border border-line p-6">
      <MonoLabel tracking="16" as="h2">
        {access.label}
      </MonoLabel>

      <p className="text-body leading-prose text-ink">
        {access.label} is part of {plan.label}.
        {current ? ` You're on ${current.label}.` : ""}
      </p>

      <p className="text-helper leading-prose text-ink-2">{plan.tagline}</p>

      <div className="flex flex-wrap items-center gap-5">
        <Link
          href={checkoutHref}
          className="inline-flex h-11 items-center whitespace-nowrap rounded-pill bg-ink px-[30px] text-ui font-semibold text-bg hover:bg-ink-2"
        >
          {`Upgrade to ${plan.label} — ${price}`}
        </Link>
        <Link
          href="/pricing"
          className="text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
        >
          Compare what each one includes →
        </Link>
      </div>
    </section>
  );
}
