"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/*
 * « Build my brand » — démarre la génération et part vers l'écran d'attente.
 *
 * La route rend un id de job TOUT DE SUITE et laisse la pipeline tourner
 * derrière (`after()`), donc ce bouton n'attend jamais une minute : il obtient
 * son id, navigue, et l'écran de génération prend le relais en sondant.
 */
export function BuildBrandButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/briefs/${projectId}/generate`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { jobId?: string; error?: string }
        | null;

      if (!response.ok || !body?.jobId) {
        setError(
          body?.error ??
            "Something didn't go through on our side. Your answers are saved."
        );
        setPending(false);
        return;
      }

      router.push(`/app/brand-kits/${body.jobId}/reveal`);
    } catch {
      setError(
        "Something didn't go through on our side. Your answers are saved."
      );
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={build} disabled={pending} className="self-start">
        {pending ? "Starting…" : "Build my brand"}
      </Button>
      {error ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper leading-prose text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
