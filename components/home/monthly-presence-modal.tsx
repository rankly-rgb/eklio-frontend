"use client";

import { useEffect, useRef } from "react";
import { ButtonLink, Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { MONTHLY_PRESENCE, formatUsd } from "@/lib/billing/plans";

/*
 * La fenêtre qui s'ouvre sur une tuile verrouillée.
 *
 * Elle ne fait PAS le paiement : elle porte l'URL de checkout que la route
 * `unlock` vient de rendre. Cette route vérifie d'abord le droit — un
 * praticien déjà couvert, y compris en `past_due` dans sa grâce, ne se voit
 * jamais proposer de repayer.
 *
 * <dialog> natif : la capture du focus, Échap et le fond inerte viennent du
 * navigateur, pas d'une réimplémentation approximative.
 */
export function MonthlyPresenceModal({
  open,
  onClose,
  checkoutUrl,
  title,
}: {
  open: boolean;
  onClose: () => void;
  checkoutUrl: string | null;
  /** Titre de la tuile cliquée, pour que la fenêtre parle de CE post. */
  title: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="monthly-presence-title"
      className="m-auto w-[min(440px,calc(100vw-48px))] rounded-card border border-line bg-bg p-7 text-ink backdrop:bg-[rgba(38,33,28,0.28)]"
    >
      <MonoLabel tracking="16">Monthly Presence</MonoLabel>
      <h2
        id="monthly-presence-title"
        className="mt-3 text-pretty font-display text-card-title font-medium leading-card tracking-question"
      >
        {title ? `“${title}” is waiting.` : "The rest of the month is waiting."}
      </h2>
      <p className="mt-3.5 text-ui leading-prose text-ink-2">
        {MONTHLY_PRESENCE.tagline}
      </p>
      <MonoLabel tracking="14" className="mt-5 block">
        {`${formatUsd(MONTHLY_PRESENCE.amountCents)}/month · Cancel anytime`}
      </MonoLabel>

      <div className="mt-6 flex items-center gap-4">
        {checkoutUrl ? (
          <ButtonLink href={checkoutUrl} variant="accent">
            Add Monthly Presence
          </ButtonLink>
        ) : (
          <span className="text-helper text-ink-2">
            One moment — opening secure checkout.
          </span>
        )}
        <Button variant="tertiary" onClick={onClose}>
          Not now
        </Button>
      </div>
    </dialog>
  );
}
