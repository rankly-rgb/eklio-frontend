import type { SpecPage, SectionFields } from "@/lib/site/types";

/*
 * ── THE SECTIONS THE SPEC LEAVES EMPTY ───────────────────────────────────
 *
 * Her spec carries four sections with a heading and nothing under it: About →
 * How I work, About → Training and licensure, Services → Services, Services →
 * Fees. The prompt emitted them as bare headings, and told the builder to add
 * no copy — so the only thing it could produce was a heading over nothing.
 *
 * ⚠ THREE OF THOSE FOUR ARE NOT MISSING DATA. She answered them in step 4 of
 * the brief. `session_style_ids`, `modality_ids` and `license_type_id` are on
 * `project_briefs`, and NOTHING maps them into the site spec — the spec is
 * seeded in SQL and never reads them. That is the missing join, and it is what
 * this module is.
 *
 * ⚠ IT IS A JOIN, NOT A REWRITE. Every line below is a CATALOGUE LABEL —
 * product-authored text she was shown and chose in the brief, e.g. "I ask a lot
 * of questions", "EMDR — Eye Movement Desensitization and Reprocessing". No
 * sentence is composed around them, and nothing is generated.
 *
 * ⚠ AND IT MAPS INTO THE PROMPT, NOT INTO THE SPEC. Writing these into
 * `site_specs` would mean changing the SQL that seeds it — a backend migration,
 * which this chantier forbids. The prompt is assembled in TypeScript, so the
 * join lives here and the spec is untouched.
 */

export type SectionRef = { page: string; section: string };

export type SectionSupplement = SectionRef & {
  heading: string;
  /** Catalogue labels, verbatim, one per line. Never a composed sentence. */
  lines: string[];
};

export type SectionPlan = {
  /** Sections this module can fill from the brief's own answers. */
  supplements: SectionSupplement[];
  /** Sections with nothing approved to say. Omitted outright. */
  omit: SectionRef[];
};

function hasBody(fields: SectionFields): boolean {
  const body = fields.body;
  if (typeof body === "string" && body.trim()) return true;
  const items = fields.items;
  return Array.isArray(items) && items.some((i) => typeof i === "string" && i.trim());
}

/**
 * Section types whose content does NOT live in their own fields, and which are
 * therefore never empty and never omitted:
 *
 *   `hero`   reads `spec.hero`
 *   `intro`  reads `spec.about_excerpt`
 *   `footer` is composed by the prompt from practice name, licence and location
 *   `contact` carries the call to action, which is the section's whole point
 */
const SOURCED_ELSEWHERE = new Set(["hero", "intro", "footer", "contact"]);

/**
 * ⚠ FEES IS OMITTED WHATEVER IT CONTAINS. It is the one section whose emptiness
 * is not the reason it goes: fee, sliding-scale and insurance wording is legal
 * text this product does not have approved, and a builder inventing it is worse
 * than its absence. See FINDINGS.md.
 */
const ALWAYS_OMIT = new Set(["fees"]);

export function planSections(input: {
  pages: SpecPage[];
  /** Catalogue labels for her chosen session styles — "I ask a lot of questions". */
  sessionStyles: readonly string[];
  /** Catalogue labels for her modalities — "EMDR — Eye Movement …". */
  modalities: readonly string[];
  /** Her licence type's label, e.g. "LMFT". */
  licenseLabel: string | null;
  licenseNumber: string | null;
}): SectionPlan {
  const supplements: SectionSupplement[] = [];
  const omit: SectionRef[] = [];

  for (const page of input.pages) {
    if (page.enabled === false) continue;
    for (const section of page.sections ?? []) {
      // A section she switched off is not empty — it is gone. Neither filled
      // nor named as omitted: the prompt never mentioned it.
      if (section.enabled === false) continue;
      const type = section.type;
      const fields = section.fields ?? {};
      const heading =
        typeof fields.heading === "string" && fields.heading.trim() ? fields.heading : type;
      const ref = { page: page.label, section: heading };

      if (SOURCED_ELSEWHERE.has(type)) continue;
      if (ALWAYS_OMIT.has(type)) {
        omit.push(ref);
        continue;
      }
      if (hasBody(fields)) continue;

      // Empty — can the brief's own answers fill it?
      const lines = fillFor(type, input);
      if (lines.length > 0) supplements.push({ ...ref, heading, lines });
      else omit.push(ref);
    }
  }

  return { supplements, omit };
}

/** The join itself: section type → the catalogue labels that belong in it. */
function fillFor(
  type: string,
  input: {
    sessionStyles: readonly string[];
    modalities: readonly string[];
    licenseLabel: string | null;
    licenseNumber: string | null;
  }
): string[] {
  switch (type) {
    // "How I work" — what a session is like. Her session-style cards say it in
    // the first person already; that is what she picked them for.
    case "approach":
      return [...input.sessionStyles];

    // "Services" — the approaches she works in. Labels only: the catalogue has
    // a name and a full name, and no description to build a paragraph from.
    case "services":
      return [...input.modalities];

    // "Training and licensure" — facts only, in the spec's own words.
    case "credentials": {
      if (!input.licenseLabel) return [];
      return [
        input.licenseNumber
          ? `${input.licenseLabel} ${input.licenseNumber}`
          : input.licenseLabel,
      ];
    }

    default:
      return [];
  }
}
