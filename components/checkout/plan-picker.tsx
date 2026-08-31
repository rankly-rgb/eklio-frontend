"use client";

import { useState, useTransition } from "react";

import { startCheckout } from "@/lib/actions/checkout";

export type PlanCard = {
  tier: string;
  label: string;
  price_cents: number;
  regenerations_limit: number;
  directions_limit: number;
};

export function PlanPicker({ plans, configured }: { plans: PlanCard[]; configured: boolean }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const buy = (tier: string) => {
    setError(null);
    setChosen(tier);
    startTransition(async () => {
      const result = await startCheckout(tier);
      if (result.ok) {
        window.location.href = result.url;
        return;
      }
      setChosen(null);
      setError(result.message);
    });
  };

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.tier} className="flex flex-col gap-4 rounded-[14px] border border-line bg-white p-6">
            <div className="overline text-muted">{plan.label}</div>
            <div className="font-display text-[34px] leading-none">
              ${Math.round(plan.price_cents / 100)}
            </div>
            <ul className="flex flex-col gap-2 text-[14px] leading-snug text-muted">
              <li>Your brand kit, yours to keep.</li>
              <li>The prompt for your site builder.</li>
              <li>
                {1 + plan.regenerations_limit} {1 + plan.regenerations_limit === 1 ? "run" : "runs"} of{" "}
                {plan.directions_limit} directions.
              </li>
            </ul>
            <button
              type="button"
              onClick={() => buy(plan.tier)}
              disabled={busy || !configured}
              className="mt-auto flex h-10 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-40"
            >
              {busy && chosen === plan.tier ? "Opening…" : `Choose ${plan.label}`}
            </button>
          </div>
        ))}
      </div>

      {!configured ? (
        <p className="mt-6 text-sm text-accent">
          Payments are not connected yet. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to turn
          this on.
        </p>
      ) : null}
      {error ? <p className="mt-6 text-sm text-accent">{error}</p> : null}
    </div>
  );
}
