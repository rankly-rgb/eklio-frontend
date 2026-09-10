"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { InlineError } from "@/components/ui/text-field";

export function AuthForm({
  action,
  submitLabel,
  passwordAutoComplete = "current-password",
  next,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  passwordAutoComplete?: "current-password" | "new-password";
  /**
   * Destination demandée avant la connexion, telle que le proxy l'a posée.
   *
   * Elle voyage en champ caché plutôt qu'en `bind()` sur l'action : le
   * formulaire est déjà un composant client partagé entre connexion et
   * inscription, et un champ caché ne change rien à sa signature. La valeur
   * n'est PAS fiable pour autant — elle vient de l'URL, et repasse donc par le
   * contrôle anti-open-redirect côté serveur.
   */
  next?: string;
}) {
  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(
    action,
    null
  );
  const waited = useSubmitClock(isPending);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <TextField
        id="email"
        name="email"
        type="email"
        label="Email"
        required
        autoComplete="email"
      />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Password"
        required
        minLength={8}
        autoComplete={passwordAutoComplete}
      />

      {state?.error ? <InlineError>{state.error}</InlineError> : null}

      <Button type="submit" disabled={isPending} className="mt-1 self-start">
        {isPending ? "One moment…" : submitLabel}
      </Button>

      {/*
        ⚠ SIXTY SECONDS OF "One moment…" IS A FROZEN PAGE.
        Measured on the acquisition walk: a signup sat on that label for 60.3s
        before saying anything, because the only deadline in the path was the
        network's own. On a phone that is indistinguishable from a crash, and
        the tab gets closed long before the answer arrives.

        This cannot cancel the server action — `useActionState` has no abort —
        and it deliberately does not pretend to. It tells her what is true at
        each point, which is the difference between waiting and being stuck.
      */}
      {isPending && waited >= SLOW_AFTER_MS ? (
        <p
          role="status"
          className="border-l border-line pl-3 text-helper leading-prose text-ink-2"
        >
          {waited >= STUCK_AFTER_MS
            ? "This is taking longer than it should. Your details haven't been lost — leave it a moment, or close this and try again."
            : "Still working. This usually takes a second or two."}
        </p>
      ) : null}
    </form>
  );
}

/*
 * How long before the page admits something is off.
 *
 * Ten seconds is past every healthy round trip and well short of the point
 * where a phone user has already decided the page is broken. Twenty-five is
 * where reassurance stops being honest and the sentence has to change.
 */
const SLOW_AFTER_MS = 10_000;
const STUCK_AFTER_MS = 25_000;

/**
 * Milliseconds since the current submission started; 0 when idle.
 *
 * ⚠ NOTHING IS SET FROM THE EFFECT BODY. The obvious version resets the
 * counter with `setWaited(0)` when `isPending` goes false, which is a state
 * write during render-commit (`react-hooks/set-state-in-effect`) and a real
 * double render on every submission. Here the effect only ARMS a timer; the
 * start instant lives in a ref, and the only state write happens inside the
 * interval callback, which is an event.
 *
 * The reset falls out for free: `startedAt` is stamped when the timer arms, so
 * a second submission measures from its own start and never inherits the first
 * one's elapsed time.
 */
function useSubmitClock(isPending: boolean): number {
  const [waited, setWaited] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!isPending) return;

    startedAt.current = Date.now();
    const timer = setInterval(
      () => setWaited(Date.now() - startedAt.current),
      1000
    );
    return () => clearInterval(timer);
  }, [isPending]);

  // Idle reads 0 without writing anything: the stored value belongs to the
  // submission that produced it, and only a submission in flight may show one.
  return isPending ? waited : 0;
}
