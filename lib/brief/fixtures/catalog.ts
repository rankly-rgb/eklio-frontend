import type { Catalog } from "@/lib/catalog/types";
import type { StepDraft } from "@/lib/brief/flow";

/*
 * ── A FIXTURE CATALOGUE, BUILT TO THE REAL ONE'S MEASUREMENTS ───────────
 *
 * ⚠ EVERY STRING BELOW IS A FIXTURE. None of it is copy, none of it is in the
 * database, and nothing here should ever reach a customer. It exists so the
 * seven brief screens can be rendered and measured at 390px WITHOUT a session
 * — the one thing the acquisition walk could not do, because Supabase is not
 * reachable from that environment.
 *
 * ── WHY IT IS NOT INVENTED FREELY ───────────────────────────────────────
 *
 * A phone layout breaks on two things: HOW MANY cards there are, and HOW LONG
 * their labels run. Three-word placeholders would render beautifully and prove
 * nothing. So the counts and the longest strings here are taken from the live
 * catalogue, measured on 2026-09-10:
 *
 *   licenseTypes        10   label ≤ 5    description ≤ 41
 *   specialties         12   label ≤ 16
 *   problemCards         8   label ≤ 39   description ≤ 75
 *   gainCards            8   label ≤ 37   description ≤ 75
 *   personaCards        10   label ≤ 44   description ≤ 78
 *   toneCards            6   sample_hero ≤ 54
 *   paletteFamilies      6   (verbatim — real hexes, or nothing renders)
 *   typePairings         6   heading / body ≤ 34
 *   primaryActions       6   label ≤ 20
 *   siteGoals            6   label + description ≤ 95
 *   sessionStyleCards    8   label + description ≤ 113   ← the longest in the product
 *   notAFitCards         8   label ≤ 56
 *   modalityCards       14   label + full name ≤ 50      ← the most numerous
 *   modalityProminence   3   label ≤ 25
 *
 * Where a string is at the maximum it is marked. If the real catalogue grows a
 * longer label than one of these, this file is understating the problem and
 * should be re-measured.
 *
 * The palettes ARE verbatim from the live table: a swatch grid cannot be
 * tested against invented hexes, and colours are not personal data.
 */

export const FIXTURE_LABEL = "fixture:catalog";

/** `n` items from `make`, so a count is a number and not a copy-paste. */
function rows<T>(n: number, make: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => make(i));
}

const LICENSES = ["LCSW", "LMFT", "LPC", "LPCC", "LMHC", "LCPC", "LICSW", "LMSW", "PsyD", "PhD"];

/* 44 characters — the longest persona label in the live catalogue. */
const LONGEST_PERSONA = "New parents who did not expect to feel this";
/* 113 characters of label + description — the longest card in the product. */
const LONGEST_SESSION_STYLE =
  "Structured, with something to practise between sessions and a plan we revisit together every few weeks or so";

export const FIXTURE_CATALOG: Catalog = {
  licenseTypes: rows(10, (i) => ({
    id: `license_${i}`,
    label: LICENSES[i],
    description: "Licensed Professional Clinical Counselor", // 40 — the longest
    sort_order: i + 1,
    active: true,
  })) as Catalog["licenseTypes"],

  specialties: rows(12, (i) => ({
    id: `specialty_${i}`,
    label: i === 0 ? "Life transitions" : `Specialty ${i + 1}`,
    sort_order: i + 1,
    active: true,
  })) as Catalog["specialties"],

  problemCards: rows(8, (i) => ({
    id: `problem_${i}`,
    label: "Cannot switch off, even on a good day",
    description: "Work ends and the mind keeps going, all evening and into the night.",
    sort_order: i + 1,
    active: true,
  })) as Catalog["problemCards"],

  gainCards: rows(8, (i) => ({
    id: `gain_${i}`,
    label: "Rest that does not need to be earned",
    description: "An evening off that is not paid for with a worse morning after.",
    sort_order: i + 1,
    active: true,
  })) as Catalog["gainCards"],

  personaCards: rows(10, (i) => ({
    id: `persona_${i}`,
    label: LONGEST_PERSONA,
    description: "They have talked themselves out of this appointment at least three times.",
    sort_order: i + 1,
    active: true,
  })) as Catalog["personaCards"],

  toneCards: rows(6, (i) => ({
    id: `tone_${i}`,
    sample_hero: "You are allowed to find this harder than it looks", // 48
    keywords: ["warm", "direct", "unhurried"],
    sort_order: i + 1,
    active: true,
  })) as Catalog["toneCards"],

  /* Verbatim from `palette_families`: a swatch grid needs real hexes. */
  paletteFamilies: [
    ["plum_bone", "PLUM & BONE", "#3B2C3A", "#4A5361", "#F3EDE4", "#241B23", "#FAF7F2", "#6E2F44", "#3B2C3A", "#4A5361", "#6E2F44", "#FFFFFF"],
    ["clay_sand", "CLAY & SAND", "#B4674A", "#C08A3E", "#F4EEE3", "#2B2A27", "#FAF6EE", "#6E3320", "#A35D43", "#92692F", "#6E3320", "#10100F"],
    ["ink_blue_chalk", "INK BLUE & CHALK", "#22364F", "#7A8168", "#EDEAE5", "#16202E", "#F7F6F3", "#8F5324", "#22364F", "#6D745D", "#8F5324", "#FFFFFF"],
    ["olive_chalk", "OLIVE & CHALK", "#7A8168", "#3F4536", "#EDEAE5", "#262A20", "#F7F7F3", "#8C5624", "#6D745D", "#3F4536", "#8C5624", "#12140F"],
    ["ochre_paper", "OCHRE & PAPER", "#C08A3E", "#6B4B1C", "#F6F2EA", "#2A2118", "#FBF8F1", "#A34A2A", "#92692F", "#6B4B1C", "#A34A2A", "#2A2118"],
    ["slate_bone", "SLATE & BONE", "#4A5361", "#2F3742", "#F3EDE4", "#1E242C", "#F9F7F3", "#8E4A3C", "#4A5361", "#2F3742", "#8E4A3C", "#FFFFFF"],
  ].map(([id, label, primary, secondary, light, dark, paper, accent, pText, sText, aText, ctaInk], i) => ({
    id,
    label,
    primary_hex: primary,
    secondary_hex: secondary,
    light_hex: light,
    dark_hex: dark,
    paper_hex: paper,
    accent_hex: accent,
    primary_text_hex: pText,
    secondary_text_hex: sText,
    accent_text_hex: aText,
    cta_ink_hex: ctaInk,
    swatches: [primary, secondary, light],
    preview_tokens: { primary, secondary, light, dark, paper },
    sort_order: i + 1,
    active: true,
  })) as unknown as Catalog["paletteFamilies"],

  typePairings: [
    ["fraunces_nunito", "Fraunces", "Nunito Sans"],
    ["cormorant_source", "Cormorant Garamond", "Source Sans 3"],
    ["newsreader_work", "Newsreader", "Work Sans"],
    ["lora_source3", "Lora", "Source Sans 3"],
    ["caslon_inter", "Libre Caslon Text", "Inter"],
    ["sourceserif_inter", "Source Serif 4", "Inter"],
  ].map(([id, heading, body], i) => ({
    id,
    heading_font: heading,
    body_font: body,
    google_fonts_url: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(heading)}&family=${encodeURIComponent(body)}&display=swap`,
    sort_order: i + 1,
    active: true,
  })) as unknown as Catalog["typePairings"],

  primaryActions: rows(6, (i) => ({
    id: `action_${i}`,
    label: "Request a consultation", // 22 — at the maximum
    sort_order: i + 1,
    active: true,
  })) as Catalog["primaryActions"],

  siteGoals: rows(6, (i) => ({
    id: `goal_${i}`,
    label: "Explain how I work",
    description: "So someone can tell before they call whether this sounds like the right room.",
    sort_order: i + 1,
    active: true,
  })) as Catalog["siteGoals"],

  ethicsRules: rows(6, (i) => ({
    id: `rule_${i}`,
    short_label: "No promised outcomes",
    description: "Describe the work, never its result.",
    example_forbidden: "Heal your anxiety for good.",
    sort_order: i + 1,
    active: true,
  })) as unknown as Catalog["ethicsRules"],

  sessionStyleCards: rows(8, (i) => ({
    id: `style_${i}`,
    label: "Structured, with something to practise",
    description: LONGEST_SESSION_STYLE,
    voice_hints: ["plain", "practical"],
    sort_order: i + 1,
    active: true,
  })) as unknown as Catalog["sessionStyleCards"],

  notAFitCards: rows(8, (i) => ({
    id: `not_a_fit_${i}`,
    label: "Someone looking for a diagnosis on the first call", // 48
    referral_note: "Refer to a psychiatrist or an assessment service.",
    sort_order: i + 1,
    active: true,
  })) as unknown as Catalog["notAFitCards"],

  /* Fourteen — the most numerous grid in the brief, and the likeliest to wrap. */
  modalityCards: rows(14, (i) => ({
    id: `modality_${i}`,
    label: "IFS",
    full_name: "Internal Family Systems therapy", // label + name = 35
    sort_order: i + 1,
    active: true,
  })) as unknown as Catalog["modalityCards"],

  modalityProminenceOptions: rows(3, (i) => ({
    id: `prominence_${i}`,
    label: "Name them on the site", // 21
    sort_order: i + 1,
    active: true,
  })) as unknown as Catalog["modalityProminenceOptions"],
};

/** An empty draft, exactly as `loadBrief` produces one for a new brief. */
export const FIXTURE_DRAFT: StepDraft = {
  practice_name: null,
  license_type_id: null,
  specialty_ids: [],
  city: null,
  state: null,
  positioning: null,
  problem_card_ids: [],
  gain_card_ids: [],
  client_persona_ids: [],
  session_style_ids: [],
  not_a_fit_ids: [],
  not_a_fit_text: null,
  modality_ids: [],
  modality_prominence: null,
  referral_quote: null,
  prior_career: null,
  prior_career_public: false,
  tone_card_id: null,
  palette_family_ids: [],
  type_pairing_id: null,
  primary_action_id: null,
  site_goal_ids: [],
  usp_statement: null,
  selected_usp_id: null,
  data: {},
};
