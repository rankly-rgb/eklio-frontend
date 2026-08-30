"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActTwoScene } from "@/components/reveal/ceremony/act-two";
import type { RevealPayload } from "@/lib/brand/shapes";

/*
 * La cérémonie — possède l'index de direction courant et toute façon de le
 * changer (flèches, points, clavier, glissement tactile), et délègue le
 * dessin d'une direction à `<ActTwoScene>`.
 *
 * L'index vit en state local, pas dans l'URL : c'est un carrousel dans un
 * écran éphémère et animé (la lueur doit retinter en 400ms, pas faire un
 * aller-retour serveur) — la même famille de compromis qu'un carrousel de
 * galerie, pas celle d'un écran qu'on partage par lien.
 *
 * PAS D'EN-TÊTE, PAS DE NAVIGATION — même recouvrement `fixed inset-0` que
 * l'écran de génération.
 */
export function RevealCeremony({
  brandKitId,
  projectId,
  payload,
  paid,
}: {
  brandKitId: string;
  projectId: string;
  payload: RevealPayload;
  paid: boolean;
}) {
  const total = payload.directions.length;
  const [index, setIndex] = useState(0);
  const direction = payload.directions[index];

  const goTo = useCallback(
    (next: number) => setIndex(((next % total) + total) % total),
    [total]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") goTo(index + 1);
      if (event.key === "ArrowLeft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, index]);

  const touchStartX = useRef<number | null>(null);
  const SWIPE_THRESHOLD_PX = 40;

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(event: React.TouchEvent) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    goTo(delta < 0 ? index + 1 : index - 1);
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <ActTwoScene
        brandKitId={brandKitId}
        projectId={projectId}
        direction={direction}
        practiceName={payload.practice.name}
        specialties={payload.practice.specialties}
        practitionerLine={payload.practitioner_line}
        socialTemplates={payload.social_templates}
        voiceGuide={payload.voice_guide}
        paid={paid}
        index={index}
        total={total}
      />

      {/* Flèches et points — clavier et glissement font la même chose. */}
      <div className="pointer-events-none fixed inset-y-0 left-0 z-20 flex items-center max-md:hidden">
        <button
          type="button"
          aria-label="Previous direction"
          onClick={() => goTo(index - 1)}
          className="pointer-events-auto ml-4 flex size-10 items-center justify-center rounded-pill border border-line bg-bg text-ink-2 hover:text-ink"
        >
          ‹
        </button>
      </div>
      <div className="pointer-events-none fixed inset-y-0 right-0 z-20 flex items-center max-md:hidden">
        <button
          type="button"
          aria-label="Next direction"
          onClick={() => goTo(index + 1)}
          className="pointer-events-auto mr-4 flex size-10 items-center justify-center rounded-pill border border-line bg-bg text-ink-2 hover:text-ink"
        >
          ›
        </button>
      </div>

      <div className="pointer-events-none fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        {payload.directions.map((entry, dotIndex) => (
          <button
            key={entry.id}
            type="button"
            aria-label={`Show direction ${dotIndex + 1} of ${total}`}
            aria-current={dotIndex === index}
            onClick={() => goTo(dotIndex)}
            className={`pointer-events-auto size-2 rounded-pill transition-colors duration-[200ms] ${
              dotIndex === index ? "bg-ink" : "bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
