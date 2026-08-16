"use client";

import { useActionState, useState } from "react";

import type { CheckoutState } from "@/lib/actions/billing";
import { MONTHLY_PRESENCE, TIERS, type TierId } from "@/lib/billing/plans";

/**
 * One-time tier plus the Monthly Presence add-on, in a single checkout.
 *
 * The add-on is checked by default, and the microcopy says so in plain words.
 * Defaulting it on is a business decision; hiding that we did would be a dark
 * pattern, and for an audience buying trust that would be the wrong trade.
 */
export function CheckoutForm({
  action,
  defaultTier = "practice",
}: {
  action: (state: CheckoutState, formData: FormData) => Promise<CheckoutState>;
  defaultTier?: TierId;
}) {
  const [state, formAction, isPending] = useActionState<CheckoutState, FormData>(
    action,
    null
  );
  const [selectedTier, setSelectedTier] = useState<TierId>(defaultTier);
  const [monthlyPresence, setMonthlyPresence] = useState(true);

  const tier = TIERS.find((t) => t.id === selectedTier);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-4">
        <legend className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
          Choose your kit
        </legend>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((option) => {
            const isSelected = option.id === selectedTier;
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-5 transition-colors ${
                  isSelected
                    ? "border-noir bg-cream-light"
                    : "border-noir/20 hover:border-noir/50"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-xl">{option.name}</span>
                  <span className="font-mono text-lg">{option.priceLabel}</span>
                </span>

                <input
                  type="radio"
                  name="tier"
                  value={option.id}
                  checked={isSelected}
                  onChange={() => setSelectedTier(option.id)}
                  className="sr-only"
                />

                <span className="text-sm text-gris-fonce">{option.summary}</span>

                <ul className="flex flex-col gap-1 text-sm">
                  {option.includes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden="true" className="text-gris-fonce">
                        —
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <span className="font-mono text-xs text-gris-fonce">
                  One-time payment
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-noir/20 bg-cream-light p-5">
        <legend className="sr-only">Monthly Presence</legend>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="monthlyPresence"
            checked={monthlyPresence}
            onChange={(e) => setMonthlyPresence(e.target.checked)}
            className="mt-1 accent-noir"
          />
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-xl">
                {MONTHLY_PRESENCE.name}
              </span>
              <span className="font-mono text-sm">
                {MONTHLY_PRESENCE.priceLabelWithInterval}
              </span>
            </span>
            <span className="text-sm text-gris-fonce">
              {MONTHLY_PRESENCE.summary}
            </span>
            <span className="font-mono text-xs text-gris-fonce">
              {MONTHLY_PRESENCE.addOnMicrocopy}
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-noir/10 pt-6">
        <p className="font-mono text-sm">
          Today: {tier?.priceLabel}
          {monthlyPresence && (
            <>
              {" "}
              + {MONTHLY_PRESENCE.priceLabel}, then{" "}
              {MONTHLY_PRESENCE.priceLabelWithInterval}
            </>
          )}
        </p>

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce disabled:opacity-50"
        >
          {isPending ? "Opening checkout…" : "Continue to payment"}
        </button>

        <p className="font-mono text-xs text-gris-fonce">
          Payment is handled by Stripe. We never see your card details.
        </p>

        {state?.error && (
          <p className="max-w-xl text-sm text-red-700" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
