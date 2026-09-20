import { annotatedCurve } from "@/lib/compose/archetypes/annotated-curve";
import { carousel } from "@/lib/compose/archetypes/carousel";
import { comparisonPair } from "@/lib/compose/archetypes/comparison-pair";
import { concentricControl } from "@/lib/compose/archetypes/concentric-control";
import { cycle } from "@/lib/compose/archetypes/cycle";
import { letteredTechnique } from "@/lib/compose/archetypes/lettered-technique";
import { numberedStrategies } from "@/lib/compose/archetypes/numbered-strategies";
import { practitionerCard } from "@/lib/compose/archetypes/practitioner-card";
import { quadrantModel } from "@/lib/compose/archetypes/quadrant-model";
import { singleStatement } from "@/lib/compose/archetypes/single-statement";
import { surfaceAndBeneath } from "@/lib/compose/archetypes/surface-and-beneath";
import type { ArchetypeModule } from "@/lib/compose/archetypes/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The eleven, by key.
 *
 * ⚠ THE KEYS MUST MATCH `content_archetypes` IN THE DATABASE EXACTLY. A module
 * the database does not know about can never be assigned a topic; a database
 * row with no module here renders nothing on the 1st of the month.
 * `lib/compose/__tests__/registry.test.ts` pins the list on this side; the
 * migration's own guard rail pins it on the other.
 */
export const ARCHETYPES: Record<string, ArchetypeModule<any>> = {
  single_statement: singleStatement,
  quadrant_model: quadrantModel,
  cycle,
  surface_and_beneath: surfaceAndBeneath,
  comparison_pair: comparisonPair,
  numbered_strategies: numberedStrategies,
  lettered_technique: letteredTechnique,
  concentric_control: concentricControl,
  annotated_curve: annotatedCurve,
  practitioner_card: practitionerCard,
  carousel,
};

export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);
