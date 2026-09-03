"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/text-field";
import { formatUsd } from "@/lib/billing/plans";
import type { PracticeSeatsPlan } from "@/lib/data/practice-plan";

/**
 * Seat count in, monthly price out — from lib/data/practice-plan.ts's
 * read of the practice_seats plans row (lot H), never a hard-coded price.
 */
export function SeatCalculator({ plan }: { plan: PracticeSeatsPlan }) {
  const [seats, setSeats] = useState(plan.seatFloor);
  const billedSeats = Math.max(seats, plan.seatFloor);
  const monthlyCents = billedSeats * plan.pricePerSeatCents;

  return (
    <div className="flex flex-col gap-5 rounded-card border border-line p-6">
      <TextField
        id="seat-count"
        label="Clinicians on your team"
        type="number"
        min={1}
        value={seats}
        onChange={(event) => {
          const next = Number(event.target.value);
          setSeats(Number.isFinite(next) && next > 0 ? Math.floor(next) : 1);
        }}
      />
      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-ui text-ink-2">Monthly</span>
        <span className="font-mono text-mono tracking-mono-14 text-ink">
          {`${formatUsd(monthlyCents)}/mo`}
        </span>
      </div>
      {seats < plan.seatFloor ? (
        <p className="text-helper leading-prose text-ink-2">
          Billed for a minimum of {plan.seatFloor} seats, whether or not
          you're using all of them yet.
        </p>
      ) : (
        <p className="text-helper leading-prose text-ink-2">
          {formatUsd(plan.pricePerSeatCents)} per clinician, per month.
        </p>
      )}
    </div>
  );
}
