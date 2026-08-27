"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * Frontière d'erreur de l'espace connecté.
 *
 * UNE PHRASE, ET CE QU'ELLE DIT COMPTE : le travail est enregistré. Un
 * praticien qui vient de passer sept minutes sur son brief a besoin de savoir
 * ça avant tout le reste. Le détail technique reste dans les journaux — il
 * peut citer un extrait de contenu ou un identifiant.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] frontière d'erreur", error);
  }, [error]);

  return (
    <main className="route-enter flex flex-1 flex-col justify-center px-[var(--gutter)] py-24 max-md:px-[var(--gutter-sm)]">
      <div className="flex max-w-[520px] flex-col gap-5">
        <MonoLabel tracking="18">Something went wrong</MonoLabel>
        <h1 className="font-display text-question font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
          That didn&rsquo;t load.
        </h1>
        <p className="text-helper leading-prose text-ink-2">
          Something didn&rsquo;t go through on our side. Your answers are saved.
        </p>
        <Button onClick={reset} className="mt-1 self-start">
          Try again
        </Button>
      </div>
    </main>
  );
}
