"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { CheckInCard } from "@/components/content/check-in-card";
import type { ContentCheckin } from "@/lib/data/content";

/*
 * ── LE CHECK-IN, UNE FOIS RÉPONDU, DEVIENT UNE LIGNE ────────────────────
 *
 * Les trois questions sont inchangées sur le fond — elles sont dans
 * `CheckInCard`, et ce fichier ne les réécrit pas. Ce qu'il change est ce qui
 * arrive APRÈS la réponse : la carte se replie en
 *
 *   « This month: burnout, taking new clients, closed the week of the 20th · Edit »
 *
 * Une carte qui reste dépliée après avoir été remplie est une carte qui
 * redemande. Une ligne dit la même chose et rend l'écran au contenu.
 *
 * ⚠ LA RÉASSURANCE RESTE VISIBLE DANS LA CARTE DÉPLIÉE. Elle n'est pas dans la
 * ligne repliée parce qu'il n'y a plus rien à écrire à ce moment-là, et
 * qu'elle réapparaît dès qu'elle rouvre pour écrire.
 */

const TAKING: Record<string, string> = {
  yes: "taking new clients",
  waitlist: "waitlist only",
  no: "not taking new clients",
};

/** Ce que la ligne dit, dans l'ordre où elle l'a écrit. Les vides sautent. */
export function checkInSummary(checkin: ContentCheckin | null): string | null {
  if (!checkin) return null;
  const parts = [
    checkin.sessions_theme?.trim() || null,
    checkin.taking_clients ? TAKING[checkin.taking_clients] : null,
    checkin.happening?.trim() || null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

export function CheckInLine({
  brandKitId,
  month,
  monthLabel,
  checkin,
  answered,
}: {
  brandKitId: string;
  month: string;
  monthLabel: string;
  checkin: ContentCheckin | null;
  answered: boolean;
}) {
  const [open, setOpen] = useState(!answered);

  if (open) {
    return (
      <div className="max-w-[720px]">
        <CheckInCard
          brandKitId={brandKitId}
          month={month}
          monthLabel={monthLabel}
          initial={checkin}
        />
        {answered ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-helper text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Done
          </button>
        ) : null}
      </div>
    );
  }

  const summary = checkInSummary(checkin);

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <MonoLabel tracking="16">This month</MonoLabel>
      <p className="text-helper leading-prose text-ink-2">
        {summary ?? "nothing noted"}
        {" · "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="underline underline-offset-2 hover:text-ink"
        >
          Edit
        </button>
      </p>
    </div>
  );
}
