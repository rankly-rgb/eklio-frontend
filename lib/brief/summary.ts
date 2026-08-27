import type { Catalog } from "@/lib/catalog/types";
import type { BriefData } from "@/lib/data/brief";
import type { StepDraft } from "@/lib/brief/flow";
import { STEPS, type StepId } from "@/lib/brief/flow";

/*
 * Le brief en un coup d'œil (§5, récapitulatif).
 *
 * Les ids de catalogue sont RÉSOLUS EN LIBELLÉS ici, à partir du catalogue lu
 * en base — jamais depuis une table de correspondance codée en dur, qui
 * divergerait le jour où quelqu'un renomme une carte.
 *
 * Une section sans réponse affiche « Not answered yet » plutôt que de
 * disparaître : ce qui manque doit se voir avant de lancer la génération.
 */

export type SummarySection = {
  step: StepId;
  stepNumber: number;
  title: string;
  lines: string[];
};

const NOT_ANSWERED = "Not answered yet.";

function labelsOf(
  ids: string[],
  source: { id: string; label: string }[]
): string[] {
  return ids
    .map((id) => source.find((entry) => entry.id === id)?.label)
    .filter((label): label is string => Boolean(label));
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function summarize(
  draft: StepDraft,
  data: BriefData,
  catalog: Catalog
): SummarySection[] {
  const title = (id: StepId) => STEPS.find((step) => step.id === id)!;

  const license = draft.license_type_id
    ? catalog.licenseTypes.find((entry) => entry.id === draft.license_type_id)
        ?.label
    : null;

  const place =
    draft.city && draft.state ? `${draft.city}, ${draft.state.toUpperCase()}` : null;

  const stage = draft.data.stage;

  const practice = [
    firstNonEmpty(draft.practice_name),
    license,
    labelsOf(draft.specialty_ids, catalog.specialties).join(", ") || null,
    place,
    stage
      ? // L'étape de vie du cabinet n'a pas de table de catalogue : son
        // libellé est reconstruit depuis l'id stocké. Voir la demande de
        // schéma dans `components/brief/step-bodies.tsx`.
        stage.charAt(0).toUpperCase() + stage.slice(1)
      : null,
  ].filter((line): line is string => Boolean(line));

  const positioning = [
    ...labelsOf(draft.problem_card_ids, catalog.problemCards),
    ...labelsOf(draft.gain_card_ids, catalog.gainCards),
    firstNonEmpty(data.problem_text),
    firstNonEmpty(data.gain_text, draft.positioning),
  ].filter((line): line is string => Boolean(line));

  const tone = draft.tone_card_id
    ? catalog.toneCards.find((entry) => entry.id === draft.tone_card_id)
    : null;

  const pairing = draft.type_pairing_id
    ? catalog.typePairings.find((entry) => entry.id === draft.type_pairing_id)
    : null;

  const action = draft.primary_action_id
    ? catalog.primaryActions.find((entry) => entry.id === draft.primary_action_id)
        ?.label
    : null;

  const sections: SummarySection[] = [
    { id: "practice" as const, lines: practice },
    { id: "positioning" as const, lines: positioning },
    {
      id: "client" as const,
      lines: labelsOf(draft.client_persona_ids, catalog.personaCards),
    },
    {
      id: "voice" as const,
      lines: tone ? [tone.sample_hero, tone.keywords.join(" · ")] : [],
    },
    {
      id: "palette" as const,
      lines: labelsOf(draft.palette_family_ids, catalog.paletteFamilies),
    },
    {
      id: "typography" as const,
      lines: pairing ? [`${pairing.heading_font} · ${pairing.body_font}`] : [],
    },
    {
      id: "website" as const,
      lines: [
        ...labelsOf(draft.site_goal_ids, catalog.siteGoals),
        action,
        data.builder_target
          ? data.builder_target.charAt(0).toUpperCase() +
            data.builder_target.slice(1)
          : null,
        firstNonEmpty(data.existing_url),
      ].filter((line): line is string => Boolean(line)),
    },
  ].map(({ id, lines }) => ({
    step: id,
    stepNumber: title(id).number,
    title: title(id).eyebrow,
    lines: lines.length > 0 ? lines : [NOT_ANSWERED],
  }));

  return sections;
}

export function isAnswered(section: SummarySection): boolean {
  return section.lines[0] !== NOT_ANSWERED;
}
