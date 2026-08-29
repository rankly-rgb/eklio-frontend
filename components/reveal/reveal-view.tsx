"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import { DirectionCard } from "@/components/reveal/direction-card";
import type { RevealDirection } from "@/lib/brand/shapes";

/*
 * La révélation (Écran 4).
 *
 * CHOISIR UNE DIRECTION quand le kit n'est PAS payé n'écrit rien : ça ouvre le
 * checkout, avec Monthly Presence coché et la microcopy qui le dit. Écrire le
 * choix puis demander de payer laisserait un kit « choisi » mais fermé, et
 * c'est exactement l'état que la page de kit ne sait pas rendre.
 *
 * Les trois cartes montent en séquence, 120 ms d'écart (§3) — instantané en
 * mouvement réduit, comme tout le reste.
 */
export function RevealView({
  brandKitId,
  projectId,
  directions,
  practiceName,
  paid,
  regenerationsLeft,
}: {
  brandKitId: string;
  projectId: string;
  directions: RevealDirection[];
  practiceName: string | null;
  paid: boolean;
  regenerationsLeft: number | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);

  /*
   * La révélation PRÉCHARGE la page de kit (§9). C'est la seule destination
   * possible depuis cet écran, et elle est lourde : la maquette à 900px, la
   * palette, le guide de voix. Sans préchargement, le clic sur « Choose this
   * direction » se paie en attente juste après une minute de génération.
   */
  useEffect(() => {
    router.prefetch(`/app/brand-kits/${brandKitId}`);
  }, [router, brandKitId]);

  async function choose(direction: RevealDirection) {
    setError(null);

    if (!paid) {
      // Le paiement précède l'écriture : le webhook est la seule autorité sur
      // ce qui est payé, et un kit « choisi mais fermé » n'a pas d'écran.
      router.push(`/app/checkout?project=${projectId}`);
      return;
    }

    setPendingId(direction.id);
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/direction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directionId: direction.id }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? "That didn't go through. Try again.");
        setPendingId(null);
        return;
      }

      router.push(`/app/brand-kits/${brandKitId}`);
    } catch {
      setError("That didn't go through. Check your connection and try again.");
      setPendingId(null);
    }
  }

  return (
    <main className="route-enter flex flex-1 flex-col items-center px-[var(--gutter)] pb-16 pt-11 max-md:px-[var(--gutter-sm)]">
      <h1 className="text-center font-display text-reveal font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
        Three directions. One feels like you.
      </h1>
      <p className="mt-3 text-center text-helper text-ink-2">
        Each one is a complete identity. You can change your mind later.
      </p>

      {/*
        Mobile (Écran 8) : une carte par écran, le HAUT de la suivante rogné et
        visible. C'est ce qui dit qu'il y en a d'autres — une carte seule se
        lirait comme la seule proposition.
      */}
      <div
        className={`mt-9 grid w-reveal-grid max-w-full gap-6 ${
          compare ? "grid-cols-3" : "grid-cols-3 max-lg:grid-cols-1"
        }`}
      >
        {directions.map((direction, index) => (
          <DirectionCard
            key={direction.id}
            direction={direction}
            practiceName={practiceName}
            index={index}
            pending={pendingId === direction.id}
            onChoose={() => void choose(direction)}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-6 border-l border-accent pl-3 text-helper leading-prose text-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col items-center gap-2.5">
        <Button variant="tertiary" onClick={() => setCompare((value) => !value)}>
          {compare ? "Back to one per row" : "Compare side by side"}
        </Button>
        {regenerationsLeft !== null ? (
          <MonoLabel tracking="16" tone="ink-3">
            {regenerationsLeft === 1
              ? "1 regeneration left"
              : `${regenerationsLeft} regenerations left`}
          </MonoLabel>
        ) : null}
      </div>
    </main>
  );
}
