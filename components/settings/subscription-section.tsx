"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/text-field";

/*
 * La section « Monthly Presence » des réglages — et le SEUL chemin de
 * résiliation du produit.
 *
 * L'ancre `#subscription` n'est pas décorative : c'est la cible du CTA du
 * préavis d'avant-prélèvement, où « comment annuler » est une mention exigée
 * (cf. `lib/stripe/portal.ts`). Elle est donc aussi stable que le lien d'un
 * e-mail déjà parti, et se renomme avec la même prudence.
 *
 * ⚠ LA RÉSILIATION EST UN LIEN, PAS UN PIÈGE. Le bouton ouvre directement
 * l'écran de résiliation de Stripe (`intent=cancel`) plutôt qu'un tableau de
 * bord où il faudrait la chercher. Ce produit interdit à ses utilisatrices la
 * friction et l'urgence dans leur propre publicité ; les employer sur l'écran
 * où l'on garde leur argent serait exactement l'incohérence qu'on refuse
 * partout ailleurs.
 */
export function SubscriptionSection({
  status,
  renewsOn,
  trialing,
  amountLabel,
}: {
  status: string | null;
  /** Déjà formatée, ou `null` quand Stripe ne l'a pas encore posée. */
  renewsOn: string | null;
  trialing: boolean;
  amountLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open(intent: "manage" | "cancel") {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/billing/portal?intent=${intent}`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.url) {
        setError(
          "We couldn't open your billing page. Please try again in a moment."
        );
        return;
      }
      window.location.href = body.url as string;
    });
  }

  return (
    <section id="subscription" className="flex scroll-mt-8 flex-col gap-4 border-t border-line pt-8">
      <h2 className="font-display text-card-title font-medium tracking-card-title text-ink">
        Monthly Presence
      </h2>

      {status === null ? (
        <p className="text-body leading-prose text-ink-2">
          You are not subscribed to Monthly Presence.
        </p>
      ) : (
        <>
          <p className="text-body leading-prose text-ink-2">
            {trialing
              ? /*
                 * Pendant l'essai inclus, la phrase dit la DATE et le MONTANT.
                 * C'est la même exigence que dans le préavis : elle ne doit
                 * jamais avoir à deviner ce qui va être prélevé ni quand.
                 */
                renewsOn
                ? `Included with Practice Suite until ${renewsOn}. It renews at ${amountLabel} then, and every month after, unless you cancel first.`
                : `Included with Practice Suite. It renews at ${amountLabel} per month when the included months end, unless you cancel first.`
              : renewsOn
                ? `${amountLabel} per month. Next renewal ${renewsOn}.`
                : `${amountLabel} per month.`}
          </p>
          <p className="text-helper leading-prose text-ink-2">
            Cancelling stops Monthly Presence and nothing else. Your brand kit
            was a one-time purchase and stays yours, with every month of content
            already written for you.
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => open("manage")} disabled={isPending}>
          {isPending ? "Opening…" : "Manage billing"}
        </Button>
        {status !== null ? (
          <button
            type="button"
            onClick={() => open("cancel")}
            disabled={isPending}
            className="inline-flex h-10 items-center rounded-pill border border-line px-[26px] text-ui text-ink transition-colors hover:bg-card disabled:opacity-60"
          >
            Cancel Monthly Presence
          </button>
        ) : null}
      </div>

      {error ? <InlineError>{error}</InlineError> : null}
    </section>
  );
}
