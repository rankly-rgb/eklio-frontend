"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readOffer } from "@/lib/api/offer";

/*
 * Le choix d'une direction — UN SEUL chemin de code, que le choix se fasse
 * depuis l'Acte 2 de la cérémonie ou depuis la vue Compare (Acte 3, à venir).
 * `POST /api/brand-kits/[id]/direction` reste l'unique porte d'entrée ; la
 * barrière de paiement est en base (`brand_kit_entitled`), pas ici — `paid`
 * ne décide que ce que le bouton DIT.
 *
 * Extrait de `components/reveal/reveal-view.tsx` plutôt que dupliqué : cette
 * version normalise l'analyse du 402 sur `readOffer()` (déjà utilisé par
 * `generation-screen.tsx`), ce que l'original ne faisait pas.
 *
 * La décision (redirect / succès / erreur) est une fonction PURE,
 * `resolveDirectionSelection`, testable sans rendu React — ce dépôt ne teste
 * que de la logique pure (§ `supabase/tests/README.md` en miroir côté front).
 * Le hook n'est qu'un fil d'état autour d'elle.
 */

export type SelectDirectionResult =
  | { kind: "redirect"; url: string }
  | { kind: "success" }
  | { kind: "error"; message: string };

export async function resolveDirectionSelection(
  response: Response
): Promise<SelectDirectionResult> {
  const offer = await readOffer(response);
  if (offer) return { kind: "redirect", url: offer.checkoutUrl };

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    return {
      kind: "error",
      message: body?.error ?? "That didn't go through. Try again.",
    };
  }

  return { kind: "success" };
}

export function useSelectDirection(brandKitId: string, projectId: string, paid: boolean) {
  const router = useRouter();
  const checkoutHref = `/app/checkout?project=${projectId}`;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La révélation précharge la page de kit : c'est la seule destination
  // possible depuis cet écran, et elle est lourde (maquette 900px, palette,
  // guide de voix).
  useEffect(() => {
    router.prefetch(`/app/brand-kits/${brandKitId}`);
  }, [router, brandKitId]);

  async function choose(directionId: string) {
    setError(null);

    if (!paid) {
      // Raccourci d'affordance, pas une garde : la base refuse de toute façon
      // si `paid` mentait, et le 402 ci-dessous mène au même endroit.
      router.push(checkoutHref);
      return;
    }

    setPendingId(directionId);
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/direction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directionId }),
      });

      const result = await resolveDirectionSelection(response);
      if (result.kind === "redirect") {
        router.push(result.url);
        return;
      }
      if (result.kind === "error") {
        setError(result.message);
        setPendingId(null);
        return;
      }

      router.push(`/app/brand-kits/${brandKitId}`);
    } catch {
      setError("That didn't go through. Check your connection and try again.");
      setPendingId(null);
    }
  }

  return { choose, pendingId, error, checkoutHref };
}
