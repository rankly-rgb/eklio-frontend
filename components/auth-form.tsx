"use client";

import { useActionState } from "react";
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
    </form>
  );
}
