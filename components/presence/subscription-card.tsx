"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { MONTHLY_PRESENCE, formatUsd } from "@/lib/billing/plans";

/*
 * The Monthly Presence subscription card (Lot 8) — the exact copy the brief
 * specifies, no countdown, no discount timer, no scarcity. Reused wherever
 * a non-subscriber needs the pitch: the content page and home's "Your first
 * week resolved" slot.
 *
 * Opens checkout via `POST /api/monthly-presence/checkout` — the same
 * underlying `createMonthlyPresenceCheckout` call the locked-tile unlock
 * flow uses, exposed without needing a content row to hang the request off
 * (this card can render with zero rows).
 */
export function MonthlyPresenceSubscriptionCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/monthly-presence/checkout", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string | null }
        | null;
      if (body?.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }
      setError("That didn't open. Check your connection and try again.");
    } catch {
      setError("That didn't open. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-line p-[18px_20px]">
      <MonoLabel tracking="16">Monthly Presence</MonoLabel>
      <p className="text-ui leading-prose text-ink">
        {`Twelve posts, four stories, and the calendar — ${formatUsd(MONTHLY_PRESENCE.amountCents)}/month. Cancel anytime.`}
      </p>
      <Button
        variant="accent"
        onClick={() => void subscribe()}
        disabled={loading}
        className="self-start"
      >
        {loading ? "Opening checkout…" : "Add Monthly Presence"}
      </Button>
      {error ? (
        <p role="alert" className="text-helper leading-prose text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
