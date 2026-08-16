"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/lib/actions/auth";

export function AuthForm({
  action,
  submitLabel,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(
    action,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 font-mono text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-noir/20 bg-cream-light px-3 py-2 text-base text-noir outline-none focus:border-noir"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm">
        Password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="rounded-md border border-noir/20 bg-cream-light px-3 py-2 text-base text-noir outline-none focus:border-noir"
        />
      </label>

      {state?.error && (
        <p className="font-mono text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light hover:bg-gris-fonce transition-colors disabled:opacity-50"
      >
        {isPending ? "..." : submitLabel}
      </button>
    </form>
  );
}
