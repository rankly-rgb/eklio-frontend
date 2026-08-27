import type { BrandKit } from "@/lib/data/brand-kit";
import type { Direction } from "@/lib/brand/shapes";
import { ETHICS_DISCLAIMER_TEXT } from "@/lib/ethics/disclaimer";

/*
 * Le prompt de site, par constructeur.
 *
 * Il est COMPOSÉ à la lecture depuis la direction retenue, pas généré ni
 * stocké : c'est une projection déterministe du kit. Le figer en base
 * donnerait un prompt périmé au praticien qui change de direction après coup —
 * or « Switch direction » est un bouton de premier plan sur l'Écran 5.
 *
 * Les quatre cibles sont celles que la base accepte dans
 * `brand_kits.site_prompt_target` (CHECK vérifié sur le projet US).
 */

export const SITE_PROMPT_TARGETS = [
  {
    id: "squarespace",
    label: "Squarespace",
    /* Squarespace ne prend pas de prompt : on écrit une consigne d'assemblage. */
    preamble:
      "Set up a four-page Squarespace site with the following brand. Use a blank template, then apply these values in Site Styles before adding any content.",
    steps: [
      "Open Site Styles and set the colors and fonts below.",
      "Create the four pages, then paste each page's copy.",
      "Set the header button to the primary action.",
    ],
  },
  {
    id: "lovable",
    label: "Lovable",
    preamble:
      "Build a four-page marketing site for a licensed therapist in private practice, using exactly the brand below. Do not invent copy that is not given here.",
    steps: [
      "Paste this prompt into a new Lovable project.",
      "Review the generated pages against the copy below.",
      "Connect your booking link to the primary action.",
    ],
  },
  {
    id: "framer",
    label: "Framer",
    preamble:
      "Create a four-page Framer site with this brand. Apply the color and text styles first, then lay out the pages.",
    steps: [
      "Start a blank Framer project and open the Assets panel.",
      "Add the colors and text styles below, then build the pages.",
      "Point the CTA at your booking link.",
    ],
  },
  {
    id: "webflow",
    label: "Webflow",
    preamble:
      "Build a four-page Webflow site with this brand. Define the swatches and typography classes before laying out the pages.",
    steps: [
      "Create a blank Webflow project and add the swatches below.",
      "Set the heading and body typefaces, then build the pages.",
      "Link the CTA to your booking page.",
    ],
  },
] as const;

export type SitePromptTarget = (typeof SITE_PROMPT_TARGETS)[number]["id"];

export function targetLabel(target: SitePromptTarget): string {
  return (
    SITE_PROMPT_TARGETS.find((entry) => entry.id === target)?.label ?? target
  );
}

function paletteBlock(direction: Direction): string {
  const { palette } = direction;
  return [
    `Primary   ${palette.primary}`,
    `Secondary ${palette.secondary}`,
    `Light     ${palette.light}`,
    `Dark      ${palette.dark}`,
    `Paper     ${palette.paper}`,
  ].join("\n");
}

/**
 * Compose le prompt.
 *
 * Il porte le SOCLE DÉONTOLOGIQUE en clair : ce prompt part chez un
 * constructeur qui va, lui, écrire de la copy. Sans ces contraintes, tout le
 * travail de l'Ethics Guard s'arrête à la frontière du kit.
 */
export function buildSitePrompt(
  kit: BrandKit,
  target: SitePromptTarget
): string {
  const direction = kit.selectedDirection;
  if (!direction) return "";

  const entry =
    SITE_PROMPT_TARGETS.find((candidate) => candidate.id === target) ??
    SITE_PROMPT_TARGETS[0];

  const practice = kit.practiceName ?? "the practice";

  return [
    entry.preamble,
    "",
    `PRACTICE: ${practice}`,
    kit.row.practitioner_line ? `PRACTITIONER: ${kit.row.practitioner_line}` : null,
    "",
    "PALETTE",
    paletteBlock(direction),
    "",
    "TYPOGRAPHY",
    `Headings  ${direction.typography.heading_font}`,
    `Body      ${direction.typography.body_font}`,
    `Web fonts ${direction.typography.google_fonts_url}`,
    "",
    "VOICE",
    direction.tone_keywords.join(", "),
    ...(kit.voiceGuide
      ? [
          "",
          "SOUNDS LIKE",
          ...kit.voiceGuide.sounds_like.map((line) => `- ${line}`),
          "",
          "NEVER WRITE",
          ...kit.voiceGuide.never_write.map((line) => `- ${line}`),
        ]
      : []),
    "",
    "HOME PAGE",
    direction.hero.overline ? `Overline: ${direction.hero.overline}` : null,
    `Headline: ${direction.hero.headline}`,
    `Subhead:  ${direction.hero.subhead}`,
    `Button:   ${direction.hero.cta_label}`,
    "",
    "ABOUT",
    direction.about_excerpt,
    "",
    "PAGES",
    "Home, About, Services, Contact.",
    "",
    "ADVERTISING RULES — THESE ARE NOT STYLE PREFERENCES",
    "This site advertises a licensed mental-health clinician. Any copy you add",
    "must follow these, or it puts a license at risk:",
    "- Describe the work, never promise what it will produce.",
    "- No timeframes attached to relief or results, and no guarantees.",
    "- No client testimonials, reviews, ratings, or paraphrased client praise.",
    "- State credentials exactly as given; invent nothing.",
    "- Never tell the reader what they have.",
    "- No urgency, no scarcity, no self-awarded superlatives.",
    "",
    "HOW TO USE THIS",
    ...entry.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    ETHICS_DISCLAIMER_TEXT,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
