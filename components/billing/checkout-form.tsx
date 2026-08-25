"use client";

import { useState, useTransition } from "react";
import { startCheckout } from "@/app/app/checkout/actions";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
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
      <div className="flex flex-col gap-4 rounded border border-rule p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl">{plan.label} brand kit</h2>
          <span className="font-mono text-sm">
            {formatUsd(plan.amountCents)} once
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">{plan.tagline}</p>
      </div>

      <label
        className={`flex cursor-pointer gap-4 rounded border p-6 transition-colors ${
          withMonthlyPresence
            ? "border-rule-strong bg-accent-tint"
            : "border-rule bg-paper"
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
            <span className="font-display text-xl">
              {MONTHLY_PRESENCE.label}
            </span>
            <span className="font-mono text-sm">
              {formatUsd(MONTHLY_PRESENCE.amountCents)}/
              {MONTHLY_PRESENCE.interval}
            </span>
          </span>
          <span className="text-sm leading-relaxed text-ink-soft">
            {MONTHLY_PRESENCE.tagline}
          </span>
          <ul className="flex flex-col gap-1 text-sm text-ink-soft">
            {MONTHLY_PRESENCE.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2">
                <span aria-hidden="true" className="text-ink-muted">
                  —
                </span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
          <span className="font-mono text-xs text-ink-muted">
            {MONTHLY_PRESENCE.defaultOnMicrocopy}
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-4 border-t border-rule pt-6">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">{plan.label} brand kit</dt>
            <dd className="font-mono">{formatUsd(plan.amountCents)}</dd>
          </div>
          {withMonthlyPresence && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">
                {MONTHLY_PRESENCE.label}, first month
              </dt>
              <dd className="font-mono">
                {formatUsd(MONTHLY_PRESENCE.amountCents)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-rule pt-2">
            <dt>Due today</dt>
            <dd className="font-mono">
              {formatUsd(
                plan.amountCents +
                  (withMonthlyPresence ? MONTHLY_PRESENCE.amountCents : 0)
              )}
            </dd>
          </div>
        </dl>

        {withMonthlyPresence && (
          <p className="text-sm text-ink-muted">
            After today, {formatUsd(MONTHLY_PRESENCE.amountCents)} per month for
            Monthly Presence. The brand kit is not charged again.
          </p>
        )}

        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Opening secure checkout…" : "Continue to payment"}
        </Button>
        <p className="font-mono text-xs text-ink-muted">
          Payment is handled by Stripe. We never see your card details.
        </p>
        {error && <ErrorNotice message={error} />}
      </div>
    </div>
  );
}
