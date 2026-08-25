"use client";

import { useState, useTransition } from "react";
import { generateKit } from "@/app/app/projets/[id]/kit/actions";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";

/*
 * Lancement de la génération du kit, depuis la page directions (première fois)
 * comme depuis la page de kit (régénération).
 *
 * L'échec — déontologique, structurel ou réseau — est rendu à l'écran en
 * anglais par `ErrorNotice` : la génération est longue, et un retour au néant
 * après une minute d'attente se lit comme une panne.
 */
export function GenerateKitButton({
  projectId,
  label = "Build my brand kit",
  variant = "primary",
  disabled = false,
}: {
  projectId: string;
  label?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await generateKit(projectId);
      if (!result.ok) {
        setError(result.error);
      }
      // En cas de succès, generateKit redirige vers la page de kit.
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        onClick={handleClick}
        disabled={disabled || isPending}
      >
        {isPending ? "Building your kit…" : label}
      </Button>
      {isPending && (
        <p className="font-mono text-xs text-ink-muted">
          This takes a little longer than the directions — up to two minutes.
        </p>
      )}
      {error && <ErrorNotice message={error} />}
    </div>
  );
}
