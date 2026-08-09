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
          className="rounded border border-rule bg-paper px-3 py-2 font-sans text-base text-ink hover:bg-paper-raised focus:border-ink-soft"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-sm">
        Mot de passe
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="rounded border border-rule bg-paper px-3 py-2 font-sans text-base text-ink hover:bg-paper-raised focus:border-ink-soft"
        />
      </label>

      {state?.error && (
        <p role="alert" className="font-mono text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded bg-ink px-6 py-3 font-mono text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
      >
        {isPending ? "Patientez…" : submitLabel}
      </button>
    </form>
  );
}
