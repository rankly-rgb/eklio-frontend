import type { Catalog } from "@/lib/catalog/types";
import type { BriefBundle } from "@/lib/data/brief";
import type { DirectionBasis } from "@/lib/generation/select";

/*
 * Le brief, tel qu'il part au modèle.
 *
 * Les IDS SONT RÉSOLUS EN LIBELLÉS depuis le catalogue lu en base : envoyer
 * `clay_sand` ou `high_functioning` à un modèle, c'est lui demander de deviner
 * ce que le praticien a coché.
 *
 * Ce qui n'a pas été répondu est OMIS, pas rendu par une ligne vide : une
 * consigne « Specialties: (none) » invite le modèle à combler le trou.
 */

function labels(ids: string[], source: { id: string; label: string }[]): string[] {
  return ids
    .map((id) => source.find((entry) => entry.id === id)?.label)
    .filter((label): label is string => Boolean(label));
}

function section(heading: string, lines: (string | null)[]): string | null {
  const kept = lines.filter((line): line is string => Boolean(line?.trim()));
  return kept.length > 0 ? `${heading}\n${kept.join("\n")}` : null;
}

export function buildBriefContext(
  bundle: BriefBundle,
  catalog: Catalog,
  bases: DirectionBasis[]
): string {
  const { brief, data } = bundle;

  const license = brief.license_type_id
    ? catalog.licenseTypes.find((entry) => entry.id === brief.license_type_id)
    : null;

  const action = brief.primary_action_id
    ? catalog.primaryActions.find((entry) => entry.id === brief.primary_action_id)
    : null;

  const tone = brief.tone_card_id
    ? catalog.toneCards.find((entry) => entry.id === brief.tone_card_id)
    : null;

  const blocks = [
    section("PRACTICE", [
      brief.practice_name ? `Name: ${brief.practice_name}` : null,
      license ? `License: ${license.label} (${license.description})` : null,
      brief.city && brief.state ? `Located in ${brief.city}, ${brief.state}` : null,
      labels(brief.specialty_ids, catalog.specialties).length > 0
        ? `Specialties: ${labels(brief.specialty_ids, catalog.specialties).join(", ")}`
        : null,
      data.stage ? `Stage of practice: ${data.stage}` : null,
    ]),

    section("WHAT CLIENTS ARE CARRYING", [
      ...labels(brief.problem_card_ids, catalog.problemCards).map((l) => `- ${l}`),
      data.problem_text ? `In their words: ${data.problem_text}` : null,
    ]),

    section("WHAT CHANGES FOR THEM", [
      ...labels(brief.gain_card_ids, catalog.gainCards).map((l) => `- ${l}`),
      data.gain_text ? `In their words: ${data.gain_text}` : null,
      brief.positioning ? `Positioning: ${brief.positioning}` : null,
    ]),

    section("WHO THEY WANT TO HEAR FROM", [
      ...brief.client_persona_ids
        .map((id) => catalog.personaCards.find((entry) => entry.id === id))
        .filter(Boolean)
        .map((persona) => `- ${persona!.label}: ${persona!.description}`),
    ]),

    section("VOICE THEY CHOSE", [
      tone ? `They picked this headline as sounding like them: "${tone.sample_hero}"` : null,
      tone ? `Its keywords: ${tone.keywords.join(", ")}` : null,
    ]),

    section("THE SITE", [
      labels(brief.site_goal_ids, catalog.siteGoals).length > 0
        ? `Goals: ${labels(brief.site_goal_ids, catalog.siteGoals).join("; ")}`
        : null,
      action ? `Primary action (already set, do not rewrite): "${action.label}"` : null,
      data.builder_target ? `They will build it in ${data.builder_target}.` : null,
    ]),

    section(
      "THE THREE DIRECTIONS ARE ALREADY DRESSED — WRITE THEIR WORDS",
      bases.map(
        (basis, index) =>
          `Direction ${index + 1}: palette ${basis.palette.primary} / ${basis.palette.secondary} on ${basis.palette.light}; ` +
          `headings in ${basis.typography.heading_font}, body in ${basis.typography.body_font}.`
      )
    ),
  ].filter((block): block is string => block !== null);

  return blocks.join("\n\n");
}
