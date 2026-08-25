import type { BriefDraft } from "@/lib/brief/schemas";
import {
  COLOR_FAMILY_OPTIONS,
  DECISION_CONTEXT_OPTIONS,
  EMOTION_OPTIONS,
  LICENSE_TYPE_OPTIONS,
  OBJECTION_OPTIONS,
  PAGE_OPTIONS,
  PROOF_OPTIONS,
  SITE_GOAL_OPTIONS,
  SPECIALTY_OPTIONS,
  STAGE_OPTIONS,
  TYPE_STYLE_OPTIONS,
  TONE_SLIDERS,
  optionLabel,
} from "@/lib/brief/steps";

/*
 * Mapping brief → contexte de prompt, partagé par toutes les générations.
 *
 * Extrait de `directions.ts` au Lot 3 : le kit part du même brief, et deux
 * copies du mapping auraient dérivé à la première question ajoutée. Les
 * appelants gardent leur propre cadrage (rôle, consignes, format de sortie) et
 * n'empruntent ici que la description de la pratique.
 *
 * Module pur : pas d'appel réseau, pas d'import de `lib/ethics` ni du SDK.
 */

export const UNSPECIFIED = "not specified";

/** Libellés lisibles d'un champ multi-choix, ou « not specified ». */
export function labelsFor(
  options: { value: string; label: string }[],
  values: string[] | undefined
): string {
  if (!values || values.length === 0) return UNSPECIFIED;
  return values.map((v) => optionLabel(options, v) ?? v).join(", ");
}

/*
 * Les quatre curseurs de ton, rendus en une ligne. Un curseur à 3 est
 * « balanced » plutôt qu'omis : au modèle, l'équilibre voulu est une
 * information, pas une absence de réponse.
 */
export function toneSummary(draft: BriefDraft): string {
  return TONE_SLIDERS.map(({ name, left, right }) => {
    const value = draft[name];
    const v = typeof value === "number" ? value : 3;
    if (v === 3) return `${left}/${right}: balanced`;
    return v < 3 ? `leaning ${left} (${v}/5)` : `leaning ${right} (${v}/5)`;
  }).join(" · ");
}

/** Type de licence, branche libre « other » comprise. */
export function licenseLabel(draft: BriefDraft): string {
  if (draft.license_type === "other") {
    return draft.license_type_other ?? UNSPECIFIED;
  }
  return optionLabel(LICENSE_TYPE_OPTIONS, draft.license_type) ?? UNSPECIFIED;
}

/**
 * Nom de la pratique tel qu'il doit apparaître dans le livrable : celui saisi
 * au brief, à défaut le nom du projet.
 */
export function practiceName(projectName: string, draft: BriefDraft): string {
  const name = draft.practice_name?.trim();
  return name && name !== "" ? name : projectName;
}

/**
 * Le brief rendu en liste lisible, injecté tel quel dans les prompts.
 *
 * `include` permet à chaque génération de ne demander que ce qui l'intéresse —
 * les directions n'ont que faire des preuves disponibles, le kit en a besoin
 * pour écrire une page About sans inventer de credential.
 */
export function buildBriefContext(
  projectName: string,
  draft: BriefDraft,
  { includeProof = false }: { includeProof?: boolean } = {}
): string {
  const lines = [
    `- License type: ${licenseLabel(draft)}`,
    `- Specialty focus: ${labelsFor(SPECIALTY_OPTIONS, draft.specialties)}`,
    `- Practice name: ${draft.practice_name ?? UNSPECIFIED}`,
    `- What they offer: ${draft.offer ?? UNSPECIFIED}`,
    `- Stage of the practice: ${optionLabel(STAGE_OPTIONS, draft.stage) ?? UNSPECIFIED}`,
    `- Problem they help with: ${draft.problem_addressed ?? UNSPECIFIED}`,
    `- What the client gains: ${draft.client_gains ?? UNSPECIFIED}`,
    `- What sets them apart: ${draft.differentiation ?? UNSPECIFIED}`,
    `- Ideal client: ${draft.ideal_client ?? UNSPECIFIED}`,
    `- How that client arrives: ${optionLabel(DECISION_CONTEXT_OPTIONS, draft.decision_context) ?? UNSPECIFIED}`,
    `- Hesitations they hear most: ${labelsFor(OBJECTION_OPTIONS, draft.objections)}`,
    `- Voice: ${toneSummary(draft)}`,
    `- Feelings to convey: ${labelsFor(EMOTION_OPTIONS, draft.emotions)}`,
    `- To avoid in the voice: ${draft.tone_to_avoid ?? "no constraint given"}`,
    `- Color families: ${labelsFor(COLOR_FAMILY_OPTIONS, draft.color_families)}`,
    `- Contrast level: ${draft.contrast_level ?? UNSPECIFIED}`,
    `- Colors to avoid: ${draft.colors_to_avoid ?? "none"}`,
    `- Admired worlds: ${draft.admired_worlds ?? UNSPECIFIED}`,
    `- Type style: ${optionLabel(TYPE_STYLE_OPTIONS, draft.type_style) ?? UNSPECIFIED}`,
    `- Character level: ${draft.character_level ?? UNSPECIFIED}`,
    `- Site goal: ${optionLabel(SITE_GOAL_OPTIONS, draft.site_goal) ?? UNSPECIFIED}`,
    `- Primary action on the site: ${draft.primary_action ?? UNSPECIFIED}`,
  ];

  if (includeProof) {
    // Règle 4 du socle déontologique : les credentials se citent tels que
    // fournis. Ce que le praticien n'a pas coché ici n'existe pas dans le kit.
    lines.push(
      `- Pages they asked for: ${labelsFor(PAGE_OPTIONS, draft.pages_wanted)}`,
      `- Proof they actually have: ${labelsFor(PROOF_OPTIONS, draft.available_proof)}`
    );
  }

  lines.push(`- Constraints: ${draft.constraints ?? "none"}`);

  return `Here is the brand brief this clinician filled in for the project "${projectName}":

${lines.join("\n")}`;
}
