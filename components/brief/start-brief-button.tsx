"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ButtonVariant } from "@/components/ui/button";

/*
 * Point d'entrée du brief. Un bouton, pas un lien : créer un projet est un
 * POST, et une URL qu'on peut recharger ne doit pas créer une ressource à
 * chaque visite.
 */
export function StartBriefButton({
  label = "Start my brief",
  variant = "primary",
}: {
  label?: string;
  variant?: ButtonVariant;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/briefs", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!response.ok || !body?.id) {
        setError(body?.error ?? "We couldn't start that. Try again.");
        setPending(false);
        return;
      }
      router.push(`/app/briefs/${body.id}`);
    } catch {
      setError("We couldn't start that. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} onClick={start} disabled={pending} className="self-start">
        {pending ? "One moment…" : label}
      </Button>
      {error ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
