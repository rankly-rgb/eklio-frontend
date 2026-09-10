"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/text-field";
import { MonoLabel } from "@/components/ui/mono-label";
import {
  CONTENT_CADENCES,
  type ContentCadence,
  type ContentPreferences,
  type ContentRegister,
  type ContentRegisterRow,
} from "@/lib/data/content";

/*
 * ── ASKED ONCE, THEN LEFT ALONE ─────────────────────────────────────────
 *
 * Two questions and an optional box. This is the setup for everything Eklio
 * will ever write for her, and it is the only time she is asked — after this
 * it lives in Settings and the monthly check-in takes over, at sixty seconds
 * a month.
 *
 * ⚠ THE SAFETY RULES ARE READ FROM THE DATABASE, NOT WRITTEN HERE. Each
 * register's rule is the same string the generator is held to
 * (`content_registers.safety_rule`). Restating them in this file would let the
 * screen promise one thing while the prompt asked for another, and nobody
 * would notice until a caption said something it should not.
 *
 * ⚠ AND SHE IS SHOWN THEM. A register is a promise about what her posts will
 * never say. Hiding that behind a friendly label would make this a preference
 * screen; showing it makes it a consent screen, which is what it is for a
 * licensed clinician publishing under her own name.
 */

const CADENCE_LABEL: Record<ContentCadence, string> = {
  1: "Once a week",
  2: "Twice a week",
  3: "Three times a week",
};

/*
 * Said in posts as well as in weeks, because "three times a week" and "twelve
 * posts to read" are the same commitment described from two ends, and only one
 * of them is the one she will feel.
 */
const CADENCE_CONSEQUENCE: Record<ContentCadence, string> = {
  1: "Four posts a month to read and approve.",
  2: "Eight posts a month to read and approve.",
  3: "Twelve posts a month to read and approve.",
};

export function PreferencesForm({
  brandKitId,
  registers,
  initial,
  onSaved,
}: {
  brandKitId: string;
  registers: ContentRegisterRow[];
  initial: ContentPreferences | null;
  onSaved?: () => void;
}) {
  const [cadence, setCadence] = useState<ContentCadence>(
    (initial?.cadence_per_week as ContentCadence | undefined) ?? 2
  );
  const [accepted, setAccepted] = useState<ContentRegister[]>(
    /*
     * ⚠ ALL SIX BY DEFAULT, and this is the one default worth arguing about.
     * An empty month is the failure this whole chantier exists to end, and a
     * generator with no accepted register cannot write one at all
     * (`NoAcceptedRegistersError`). Starting from all six means the month
     * arrives; turning one off is a deliberate act she can take at any time.
     */
    initial?.accepted_registers ?? registers.map((register) => register.id)
  );
  const [offLimits, setOffLimits] = useState(initial?.off_limits ?? "");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: ContentRegister) {
    setAccepted((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function save() {
    setError(null);
    if (accepted.length === 0) {
      /*
       * Refused here as well as in the generator. Saying it at the moment she
       * presses Save is the only place the sentence is useful; discovering it
       * three weeks later as an empty month is not.
       */
      setError("Leave at least one kind of post on, or there is nothing to write.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/brand-kits/${brandKitId}/content-preferences`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cadence_per_week: cadence,
          accepted_registers: accepted,
          off_limits: offLimits.trim() || null,
        }),
      });

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
      aria-labelledby="preferences-heading"
      className="flex flex-col gap-7 rounded-card border border-line bg-card p-6"
    >
      <div className="flex flex-col gap-2">
        <MonoLabel tracking="16">Asked once</MonoLabel>
        <h2
          id="preferences-heading"
          className="font-display text-card-title font-medium tracking-card-title text-ink"
        >
          What should Eklio write for you?
        </h2>
        <p className="text-helper leading-prose text-ink-2">
          This is the only time we ask. After it, a minute a month is the whole
          of it — and you can change any of this from Settings whenever you like.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-ui text-ink">How often do you want to post?</legend>
        <div className="flex flex-wrap gap-2">
          {CONTENT_CADENCES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={cadence === value}
              onClick={() => setCadence(value)}
              className={`inline-flex h-10 items-center rounded-pill border px-[22px] text-ui transition-colors ${
                cadence === value
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-ink hover:bg-bg"
              }`}
            >
              {CADENCE_LABEL[value]}
            </button>
          ))}
        </div>
        <span className="text-helper leading-prose text-ink-2">
          {CADENCE_CONSEQUENCE[cadence]}
        </span>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-ui text-ink">What kinds of post are all right?</legend>

        {registers.length === 0 ? (
          /*
           * The catalogue could not be read. Six invented rules would be worse
           * than saying so: she would be consenting to something nobody wrote.
           */
          <p role="alert" className="text-helper leading-prose text-danger">
            We couldn&apos;t load the list of post types. Reload the page, and if it
            keeps happening, nothing has been changed.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {registers.map((register) => {
              const on = accepted.includes(register.id);
              return (
                <li key={register.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(register.id)}
                    className={`flex w-full flex-col gap-1 rounded-card border p-4 text-left transition-colors ${
                      on ? "border-ink bg-bg" : "border-line hover:border-ink-3"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-ui text-ink">{register.label}</span>
                      <span className="text-[11px] uppercase tracking-[0.08em] text-ink-3">
                        {on ? "On" : "Off"}
                      </span>
                    </span>
                    {/* The rule, in her words, from the same row the generator reads. */}
                    <span className="text-helper leading-prose text-ink-2">
                      {register.safety_rule}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-ui text-ink">
          Anything Eklio should never write about?{" "}
          <span className="text-ink-3">Optional.</span>
        </span>
        <textarea
          rows={3}
          maxLength={500}
          value={offLimits}
          onChange={(event) => setOffLimits(event.target.value)}
          placeholder="No politics. Nothing about medication."
          className="rounded-card border border-line bg-bg p-3 text-ui leading-prose text-ink"
        />
        <span className="text-helper leading-prose text-ink-3">
          Subjects, not phrasing. This goes to every month from now on.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <span className="text-helper leading-prose text-ink-2">
          Changing this later never rewrites a month you have already taken.
        </span>
      </div>

      {error ? <InlineError>{error}</InlineError> : null}
    </section>
  );
}
