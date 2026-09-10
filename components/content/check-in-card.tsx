"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/text-field";
import { MonoLabel } from "@/components/ui/mono-label";
import { TAKING_CLIENTS, type ContentCheckin, type TakingClients } from "@/lib/data/content";

/*
 * ── THE SIXTY SECONDS ───────────────────────────────────────────────────
 *
 * Three questions at the top of her calendar, until she answers. This is the
 * whole of what Eklio asks her each month, and the promise is that it fits in
 * a minute — so it is three fields on one screen, not a flow, not a modal, and
 * never a blocker.
 *
 * ⚠ AN UNANSWERED CHECK-IN NEVER STOPS A MONTH. The generator reads it the
 * same way: no answers means write from the brief alone. The card stays up
 * because her answers make the month better, not because the month needs them.
 * A product that withholds what she pays for until she fills in a form is a
 * form, not a product.
 *
 * ⚠ ONLY ONE ANSWER IS REQUIRED, AND IT IS THE MIDDLE ONE. `taking_clients`
 * is the only field that changes what may be GENERATED — whether a post may
 * carry a call to action, and which one. The other two enrich the writing.
 * Requiring all three would keep this card on her calendar for the sake of an
 * optional question, which is the opposite of sixty seconds.
 */

const TAKING_LABEL: Record<TakingClients, string> = {
  yes: "Yes, taking new clients",
  waitlist: "Waitlist only",
  no: "Not right now",
};

/*
 * What each answer means for the month, said out loud.
 *
 * She is agreeing to what her posts will ask of a reader, and "waitlist only"
 * quietly changing every call to action is the kind of thing a clinician
 * should be told rather than left to notice.
 */
const TAKING_CONSEQUENCE: Record<TakingClients, string> = {
  yes: "Posts may invite someone to get in touch.",
  waitlist: "Posts mention the waitlist instead of inviting a booking.",
  no: "No post will ask anyone to reach out this month.",
};

export function CheckInCard({
  brandKitId,
  month,
  monthLabel,
  initial,
  onSaved,
}: {
  brandKitId: string;
  month: string;
  monthLabel: string;
  initial: ContentCheckin | null;
  onSaved?: () => void;
}) {
  const [sessionsTheme, setSessionsTheme] = useState(initial?.sessions_theme ?? "");
  const [takingClients, setTakingClients] = useState<TakingClients | null>(
    initial?.taking_clients ?? null
  );
  const [happening, setHappening] = useState(initial?.happening ?? "");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/brand-kits/${brandKitId}/check-in?month=${month}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessions_theme: sessionsTheme.trim() || null,
            taking_clients: takingClients,
            happening: happening.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        setError("We couldn't save that. Try again in a moment.");
        return;
      }
      /*
       * Refreshed by default. Without it the card stays on screen after a
       * successful save, which reads as "that did not work" and invites a
       * second submission of the same answers.
       */
      if (onSaved) onSaved();
      else router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="check-in-heading"
      className="flex flex-col gap-5 rounded-card border border-line bg-card p-6"
    >
      <div className="flex flex-col gap-2">
        <MonoLabel tracking="16">About a minute</MonoLabel>
        <h2
          id="check-in-heading"
          className="font-display text-card-title font-medium tracking-card-title text-ink"
        >
          {monthLabel} — what should this month sound like?
        </h2>
        <p className="text-helper leading-prose text-ink-2">
          Answer what you like. We write your month either way; your answers
          just make it sound more like this month than any other.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-ui text-ink">
          What has been coming up in your sessions this month?
        </span>
        <textarea
          rows={3}
          maxLength={600}
          value={sessionsTheme}
          onChange={(event) => setSessionsTheme(event.target.value)}
          placeholder="Burnout, mostly. A lot of people going back to work."
          className="rounded-card border border-line bg-bg p-3 text-ui leading-prose text-ink"
        />
        {/*
          No client is named, and the field cannot be used to name one: the
          generated post describes an experience, never a person. Said here so
          she is not left wondering what happens to what she types.
        */}
        <span className="text-helper leading-prose text-ink-3">
          Themes, not people. Nothing you write here is ever attributed to a
          client.
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-ui text-ink">Are you taking new clients?</legend>
        <div className="flex flex-wrap gap-2">
          {TAKING_CLIENTS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={takingClients === value}
              onClick={() => setTakingClients(value)}
              className={`inline-flex h-10 items-center rounded-pill border px-[22px] text-ui transition-colors ${
                takingClients === value
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-ink hover:bg-bg"
              }`}
            >
              {TAKING_LABEL[value]}
            </button>
          ))}
        </div>
        {takingClients ? (
          <span className="text-helper leading-prose text-ink-2">
            {TAKING_CONSEQUENCE[takingClients]}
          </span>
        ) : (
          <span className="text-helper leading-prose text-ink-3">
            This is the one that changes what your posts may ask for.
          </span>
        )}
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-ui text-ink">
          Anything happening this month?{" "}
          <span className="text-ink-3">Optional.</span>
        </span>
        <textarea
          rows={2}
          maxLength={600}
          value={happening}
          onChange={(event) => setHappening(event.target.value)}
          placeholder="Closed the week of the 20th. New evening slots from the 6th."
          className="rounded-card border border-line bg-bg p-3 text-ui leading-prose text-ink"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        {/*
          ⚠ NOT "SKIP". Skipping implies something was owed. Nothing here is
          owed: the month arrives regardless, and this says so in the only
          place she can act on it.
        */}
        <span className="text-helper leading-prose text-ink-2">
          Leave it blank and we write from your brief.
        </span>
      </div>

      {error ? <InlineError>{error}</InlineError> : null}
    </section>
  );
}
