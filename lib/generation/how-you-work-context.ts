import type { Catalog } from "@/lib/catalog/types";
import type { BriefBundle } from "@/lib/data/brief";

/*
 * Contexte LÉGER pour les deux nouveaux générateurs (cartes de ton, options
 * USP) — délibérément SÉPARÉ de `lib/generation/brief-context.ts`, qui exige
 * des `DirectionBasis[]` (palette + typographie) qui n'existent pas encore à
 * l'étape 5 : le « Look » (étape 6) vient APRÈS. Même doctrine que le reste du
 * lot 2 : ces deux générateurs ont leurs propres points d'intégration, plus
 * légers, et ne passent pas par `pipeline.ts`.
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

/** Steps 1-4, sans la voix (choisie ensuite, à l'étape 5) ni le Look. */
export function buildHowYouWorkContext(
  bundle: BriefBundle,
  catalog: Catalog
): string {
  const { brief, data } = bundle;

  const license = brief.license_type_id
    ? catalog.licenseTypes.find((entry) => entry.id === brief.license_type_id)
    : null;

  const modalityLabels = labels(brief.modality_ids ?? [], catalog.modalityCards);
  const prominence = brief.modality_prominence
    ? catalog.modalityProminenceOptions.find(
        (entry) => entry.id === brief.modality_prominence
      )?.label
    : null;

  const sessionStyleHints = (brief.session_style_ids ?? [])
    .flatMap(
      (id) =>
        catalog.sessionStyleCards.find((entry) => entry.id === id)?.voice_hints ?? []
    )
    .filter((hint, index, all) => all.indexOf(hint) === index);

  const blocks = [
    section("PRACTICE", [
      brief.practice_name ? `Name: ${brief.practice_name}` : null,
      license ? `License: ${license.label}` : null,
      brief.city && brief.state ? `Located in ${brief.city}, ${brief.state}` : null,
      labels(brief.specialty_ids, catalog.specialties).length > 0
        ? `Specialties: ${labels(brief.specialty_ids, catalog.specialties).join(", ")}`
        : null,
    ]),

    section("WHAT CLIENTS ARE CARRYING", [
      ...labels(brief.problem_card_ids, catalog.problemCards).map((l) => `- ${l}`),
      data.problem_text ? `In their words: ${data.problem_text}` : null,
    ]),

    section("WHAT CHANGES FOR THEM", [
      ...labels(brief.gain_card_ids, catalog.gainCards).map((l) => `- ${l}`),
      data.gain_text ? `In their words: ${data.gain_text}` : null,
    ]),

    section("WHO THEY WANT TO HEAR FROM", [
      ...brief.client_persona_ids
        .map((id) => catalog.personaCards.find((entry) => entry.id === id))
        .filter(Boolean)
        .map((persona) => `- ${persona!.label}: ${persona!.description}`),
    ]),

    section("HOW SHE WORKS", [
      ...labels(brief.session_style_ids ?? [], catalog.sessionStyleCards).map(
        (l) => `- ${l}`
      ),
      sessionStyleHints.length > 0
        ? `Voice hints from her session style: ${sessionStyleHints.join(", ")}`
        : null,
      modalityLabels.length > 0
        ? `Trained in: ${modalityLabels.join(", ")}${prominence ? ` (${prominence})` : ""}`
        : null,
      brief.referral_quote
        ? `What a colleague would say about her: "${brief.referral_quote}"`
        : null,
      brief.not_a_fit_text ? `Who she isn't the right fit for: ${brief.not_a_fit_text}` : null,
      labels(brief.not_a_fit_ids ?? [], catalog.notAFitCards).length > 0
        ? `Not the right fit for: ${labels(brief.not_a_fit_ids ?? [], catalog.notAFitCards).join(", ")}`
        : null,
      // `prior_career` n'est envoyé au modèle QUE si publique (§9.10) : la
      // génération ne doit jamais s'appuyer sur un fait qu'elle a l'interdiction
      // absolue de publier.
      brief.prior_career_public && brief.prior_career
        ? `Before this work: ${brief.prior_career}`
        : null,
    ]),
  ].filter((block): block is string => block !== null);

  return blocks.join("\n\n");
}
