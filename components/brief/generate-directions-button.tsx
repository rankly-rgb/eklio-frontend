"use client";

import { useState, useTransition } from "react";
import { generateDirections } from "@/app/app/projets/[id]/directions/actions";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";

export function GenerateDirectionsButton({
  projectId,
  label = "Générer mes 3 directions",
}: {
  projectId: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await generateDirections(projectId);
      if (!result.ok) {
        setError(result.error);
      }
      // En cas de succès, generateDirections redirige — rien d'autre à faire ici.
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 pb-6">
      <Button variant="primary" onClick={handleClick} disabled={isPending}>
        {isPending ? "Génération en cours…" : label}
      </Button>
      {isPending && (
        <p className="font-mono text-xs text-ink-muted">
          Cela peut prendre jusqu&rsquo;à une minute.
        </p>
      )}
      {error && <ErrorNotice message={error} />}
    </div>
  );
}
