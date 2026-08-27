"use client";

import { useState, useTransition } from "react";
import { startCheckout } from "@/app/app/checkout/actions";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/text-field";
import { formatUsd, KIT_PLANS, MONTHLY_PRESENCE } from "@/lib/billing/plans";
import type { KitTier } from "@/lib/kit/tiers";

/*
 * Le dernier écran avant Stripe : le tier choisi, l'add-on, et le total.
 *
 * L'add-on est COCHÉ PAR DÉFAUT, et la case le dit. Cocher par défaut sans le
 * dire serait un dark pattern — et ce produit s'adresse à des cliniciens tenus
 * de ne pas en employer dans leur propre publicité. La case est décochable en
 * un clic, à côté de sa microcopy, pas enterrée dans un lien.
 *
 * Le total est calculé depuis le catalogue, donc depuis la même source que les
 * lignes de la session Stripe : ce qui est affiché ici est ce qui sera
 * facturé.
 */
export function CheckoutForm({
  tier,
  projectId,
}: {
  tier: KitTier;
  projectId: string | null;
}) {
  const plan = KIT_PLANS[tier];
  const [withMonthlyPresence, setWithMonthlyPresence] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout({
        tier,
        projectId,
        withMonthlyPresence,
      });
      // En cas de succès, `startCheckout` redirige vers Stripe.
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-card border border-line p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-card-title font-medium tracking-card-title">{plan.label} brand kit</h2>
          <span className="font-mono text-mono tracking-mono-14">
            {formatUsd(plan.amountCents)} once
          </span>
        </div>
        <p className="text-ui leading-prose text-ink-2">{plan.tagline}</p>
      </div>

      <label
        className={`flex cursor-pointer gap-4 rounded-card border p-6 transition-colors ${
          withMonthlyPresence
            ? "border-line bg-card"
            : "border-line bg-bg"
        }`}
      >
        <input
          type="checkbox"
          checked={withMonthlyPresence}
          onChange={(event) => setWithMonthlyPresence(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--ink)]"
        />
        <span className="flex flex-col gap-3">
          <span className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-display text-card-title font-medium tracking-card-title">
              {MONTHLY_PRESENCE.label}
            </span>
            <span className="font-mono text-mono tracking-mono-14">
              {formatUsd(MONTHLY_PRESENCE.amountCents)}/
              {MONTHLY_PRESENCE.interval}
            </span>
          </span>
          <span className="text-ui leading-prose text-ink-2">
            {MONTHLY_PRESENCE.tagline}
          </span>
          <ul className="flex flex-col gap-1 text-ui text-ink-2">
            {MONTHLY_PRESENCE.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2">
                <span aria-hidden="true" className="text-ink-2">
                  —
                </span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
          <span className="font-mono text-mono tracking-mono-14 text-ink-2">
            {MONTHLY_PRESENCE.defaultOnMicrocopy}
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        <dl className="flex flex-col gap-2 text-ui">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">{plan.label} brand kit</dt>
            <dd className="font-mono text-mono tracking-mono-14">{formatUsd(plan.amountCents)}</dd>
          </div>
          {withMonthlyPresence && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">
                {MONTHLY_PRESENCE.label}, first month
              </dt>
              <dd className="font-mono text-mono tracking-mono-14">
                {formatUsd(MONTHLY_PRESENCE.amountCents)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-line pt-2">
            <dt>Due today</dt>
            <dd className="font-mono text-mono tracking-mono-14">
              {formatUsd(
                plan.amountCents +
                  (withMonthlyPresence ? MONTHLY_PRESENCE.amountCents : 0)
              )}
            </dd>
          </div>
        </dl>

        {withMonthlyPresence && (
          <p className="text-ui text-ink-2">
            After today, {formatUsd(MONTHLY_PRESENCE.amountCents)} per month for
            Monthly Presence. The brand kit is not charged again.
          </p>
        )}

        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Opening secure checkout…" : "Continue to payment"}
        </Button>
        <p className="text-helper leading-prose text-ink-2">
          Payment is handled by Stripe. We never see your card details.
        </p>
        {error ? <InlineError>{error}</InlineError> : null}
      </div>
    </div>
  );
}
