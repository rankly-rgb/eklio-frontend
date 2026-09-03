/*
 * The six Ethics Guard rule families — id, label, and the one-line "why" a
 * practitioner would actually read. Content only, no regex/scanning logic:
 * this file exists so the brand guide PDF (Lot 5) and the real scanning
 * engine (Lot 7, `lib/ethics/rules.ts`, not built yet) share ONE source for
 * what the six rules ARE, rather than the PDF hardcoding a copy of prose
 * Lot 7 would otherwise restate. When Lot 7 lands, its rule objects should
 * import `label`/`why` from here rather than redeclaring them.
 */

export type EthicsRuleDefinition = {
  id: string;
  label: string;
  why: string;
  example: string;
};

export const ETHICS_RULE_DEFINITIONS: EthicsRuleDefinition[] = [
  {
    id: "outcome_guarantee",
    label: "Outcome guarantee",
    why: "No therapist can promise how someone else's therapy turns out.",
    example: "“This will resolve your anxiety for good.”",
  },
  {
    id: "testimonial",
    label: "Testimonial",
    why: "Client testimonials about therapy raise confidentiality and coercion concerns most boards restrict.",
    example: "“My client told me this changed her life.”",
  },
  {
    id: "scarcity",
    label: "Scarcity",
    why: "Manufactured urgency pressures someone into a clinical decision, not a marketing one.",
    example: "“Only 2 spots left — book before Friday.”",
  },
  {
    id: "superlative_credential",
    label: "Superlative credential",
    why: "“Best” or “#1” claims aren't verifiable and read as puffery a board can flag.",
    example: "“The area's leading trauma expert.”",
  },
  {
    id: "clinical_claim",
    label: "Clinical claim",
    why: "A named method plus a promised result implies a guarantee the evidence doesn't support.",
    example: "“This proven method eliminates panic attacks.”",
  },
  {
    id: "unsourced_statistic",
    label: "Unsourced statistic",
    why: "A number without a citation reads as authoritative when it may not be.",
    example: "“90% of my clients see results in a month.”",
  },
];
