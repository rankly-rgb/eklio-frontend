"use client";

import { useState } from "react";
import { ActTwoStatic } from "@/components/reveal/ceremony/act-two";
import {
  SAMPLE_DIRECTIONS,
  SAMPLE_PRACTICE_NAME,
  SAMPLE_PREVIEW,
} from "@/lib/brand/sample";
import type { RevealPayloadDirection } from "@/lib/brand/shapes";

/*
 * Galerie de développement pour la cérémonie de révélation — même raison
 * d'être que `/dev/preview` : voir l'écran contre des données d'exemple,
 * sans authentification ni base de données. La révélation vit derrière la
 * garde de session de `/app` ; ce n'est pas un raccourci autour d'elle, c'est
 * la seule façon de la contrôler visuellement hors ligne.
 *
 * Le résumé de contraste est un doublure : `brand_kit_direction_contrast`
 * (eklio-backend) le calcule réellement, cette page ne fait que lui donner
 * une forme valide pour que <ActTwoStatic> puisse s'en servir plus tard.
 */

const SAMPLE_CONTRAST = {
  pairs: [
    {
      pair_id: "dark_neutral_on_paper",
      label: "Body text on the page",
      fg: "#2B2A27",
      bg: "#FAF6EE",
      ratio: 13.31,
      level: "AAA" as const,
    },
  ],
  worst_ratio: 4.51,
  passes_aa: true,
};

export default function DevCeremonyPage() {
  const [index, setIndex] = useState(1);
  const direction: RevealPayloadDirection = {
    ...SAMPLE_DIRECTIONS[index],
    contrast: SAMPLE_CONTRAST,
    ambiance_url: null,
  };

  return (
    <>
      <div className="fixed top-3 left-3 z-[60] flex gap-2">
        {SAMPLE_DIRECTIONS.map((entry, i) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setIndex(i)}
            className="rounded-pill border border-line bg-bg px-3 py-1 text-mono-sm font-mono uppercase text-ink-2"
          >
            {entry.name}
          </button>
        ))}
      </div>
      <ActTwoStatic
        direction={direction}
        practiceName={SAMPLE_PRACTICE_NAME}
        specialties={SAMPLE_PREVIEW.specialties}
        index={index}
        total={SAMPLE_DIRECTIONS.length}
      />
    </>
  );
}
