"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { chooseDirection } from "@/lib/actions/direction";
import { generate } from "@/lib/actions/generate";
import { DirectionCard, type Direction } from "@/components/directions/direction-card";
import { PrimaryButton } from "@/components/ui/controls";

export function DirectionsView({
  brandKitId,
  directions,
  selectedId,
  runsLeft,
  planLabel,
}: {
  brandKitId: string | null;
  directions: Direction[];
  selectedId: string | null;
  runsLeft: number;
  planLabel: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result = await generate();
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(
        result.reason === "no_credit"
          ? `That is every run your ${planLabel} plan includes. Upgrading gives you more.`
          : result.reason === "generation_failed"
            ? "The generation came back outside what the page can render, three times running. Nothing was saved and your run has not been counted twice — try once more."
            : "Something went wrong on our side. Nothing was saved."
      );
    });
  };

  const choose = (directionId: string) => {
    if (!brandKitId) return;
    setError(null);
    setChoosing(directionId);
    startTransition(async () => {
      const result = await chooseDirection(brandKitId, directionId);
      setChoosing(null);

      if (result.ok) {
        router.push("/app/kit");
        return;
      }

      // ⚠ payment_required et not_found sont deux phrases distinctes. Sur la
      // première, on ouvre le checkout — elle a un kit, elle ne l'a pas acheté.
      if (result.code === "payment_required") {
        router.push("/app/checkout");
        return;
      }
      setError(
        result.code === "not_found"
          ? "We can't find that brand kit. Sorry — that one is on us."
          : result.message || "Something went wrong."
      );
    });
  };

  if (directions.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
        <div className="overline text-muted">Your three directions</div>
        <h1 className="mt-4 font-display text-[40px] leading-[1.12] tracking-[-0.015em] text-balance">
          Three ways your practice could look.
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-muted">
          Looking costs nothing. You only pay when one of them is yours.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <PrimaryButton onClick={run} disabled={busy || runsLeft <= 0}>
            {busy ? "Writing them…" : "Show me"}
          </PrimaryButton>
          <span className="text-sm text-muted">
            {runsLeft} {runsLeft === 1 ? "run" : "runs"} left on {planLabel}
          </span>
        </div>
        {error ? <p className="mt-6 text-sm text-accent">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-11">
      <div className="flex items-end justify-between gap-8">
        <div className="max-w-[640px]">
          <div className="overline text-muted">Your three directions</div>
          <h1 className="mt-4 font-display text-[40px] leading-[1.12] tracking-[-0.015em] text-balance">
            {selectedId ? "This one is yours." : "Three ways your practice could look."}
          </h1>
          <p className="mt-3 text-[15px] leading-[1.6] text-muted">
            {selectedId
              ? "Your brand kit and the prompt for your site builder are ready."
              : "Look as long as you like. Choosing one is what unlocks the kit."}
          </p>
        </div>
        {!selectedId ? (
          <button
            type="button"
            onClick={run}
            disabled={busy || runsLeft <= 0}
            className="mb-1 whitespace-nowrap text-sm text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
          >
            {runsLeft > 0 ? `Try three more (${runsLeft} left)` : "No runs left"}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-6 text-sm text-accent">{error}</p> : null}

      <div className="mt-9 grid gap-6 lg:grid-cols-3">
        {directions.map((d) => (
          <DirectionCard
            key={d.id}
            direction={d}
            selected={selectedId === d.id}
            busy={busy && choosing === d.id}
            onChoose={() => choose(d.id)}
          />
        ))}
      </div>
    </div>
  );
}
