"use client";

import { useState, useTransition } from "react";
import { generatePresence } from "@/app/app/projets/[id]/presence/actions";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";

/*
 * Lancement de la génération du mois.
 *
 * L'attente est ANNONCÉE (leçon n°5) : ce livrable est plus long que le kit —
 * douze posts, quatre stories et un calendrier en une réponse — et un bouton
 * qui semble ne rien faire pendant une minute et demie se lit comme une panne.
 * C'est exactement le diagnostic qu'on a dû poser deux fois sur ce produit.
 */
export function GeneratePresenceButton({
  projectId,
  label,
  variant = "primary",
}: {
  projectId: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await generatePresence(projectId);
      if (!result.ok) setError(result.error);
      // En cas de succès, la page se re-rend : `revalidatePath` a couru.
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant={variant} onClick={handleClick} disabled={isPending}>
        {isPending ? "Writing your month…" : label}
      </Button>
      {isPending && (
        <p className="font-mono text-xs text-ink-muted">
          A full month takes one to two minutes. You can leave this page open.
        </p>
      )}
      {error && <ErrorNotice message={error} />}
    </div>
  );
}
