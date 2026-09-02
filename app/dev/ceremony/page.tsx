"use client";

import { RevealCeremony } from "@/components/reveal/ceremony/reveal-ceremony";
import {
  SAMPLE_DIRECTIONS,
  SAMPLE_PRACTICE_NAME,
  SAMPLE_PRACTITIONER_LINE,
  SAMPLE_PREVIEW,
  SAMPLE_SOCIAL_TEMPLATES,
  SAMPLE_VOICE_GUIDE,
} from "@/lib/brand/sample";
import type { RevealPayload } from "@/lib/brand/shapes";

/*
 * Galerie de développement pour la cérémonie de révélation — même raison
 * d'être que `/dev/preview` : voir l'écran contre des données d'exemple,
 * sans authentification ni base de données. La révélation vit derrière la
 * garde de session de `/app` ; ce n'est pas un raccourci autour d'elle, c'est
 * la seule façon de la contrôler visuellement hors ligne.
 *
 * Le résumé de contraste est une doublure : `brand_kit_direction_contrast`
 * (eklio-backend) le calcule réellement, cette page ne fait que lui donner
 * une forme valide.
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
    {
      pair_id: "cta_label_on_primary",
      label: "Button label on your primary color",
      fg: "#10100F",
      bg: "#B4674A",
      ratio: 4.51,
      level: "AA" as const,
    },
  ],
  worst_ratio: 4.51,
  passes_aa: true,
};

const SAMPLE_PAYLOAD: RevealPayload = {
  brand_kit_id: "sample-kit",
  practice: {
    name: SAMPLE_PRACTICE_NAME,
    city: "Portland",
    state: "OR",
    specialties: SAMPLE_PREVIEW.specialties,
  },
  practitioner_line: SAMPLE_PRACTITIONER_LINE,
  voice_guide: SAMPLE_VOICE_GUIDE,
  social_templates: SAMPLE_SOCIAL_TEMPLATES,
  directions: SAMPLE_DIRECTIONS.map((direction) => ({
    ...direction,
    contrast: SAMPLE_CONTRAST,
    ambiance_url: null,
  })),
};

export default function DevCeremonyPage() {
  return (
    <RevealCeremony
      brandKitId="sample-kit"
      projectId="sample-project"
      payload={SAMPLE_PAYLOAD}
      paid={false}
    />
  );
}
