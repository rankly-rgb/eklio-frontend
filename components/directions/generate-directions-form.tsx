"use client";

import { useActionState } from "react";

import type { DirectionsActionState } from "@/lib/actions/directions";

/**
 * Generation is slow enough that the pending state matters. The action returns
 * a message on failure and null on success — nothing is ever saved partially,
 * so a failure leaves the previous directions untouched.
 */
export function GenerateDirectionsForm({
  action,
  label,
  pendingLabel,
}: {
  action: (
    state: DirectionsActionState,
    formData: FormData
  ) => Promise<DirectionsActionState>;
  label: string;
  pendingLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<
    DirectionsActionState,
    FormData
  >(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce disabled:opacity-50"
      >
        {isPending ? pendingLabel : label}
      </button>

      {isPending && (
        <p className="font-mono text-xs text-gris-fonce" aria-live="polite">
          This takes up to a minute. Every line is checked against the
          advertising-ethics rules before it reaches you.
        </p>
      )}

      {state?.error && (
        <p className="max-w-xl text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
