import {
  checkEthics,
  type EthicsCheckResult,
} from "@/lib/ethics/rules";

/*
 * Lot C5 — flags a clinician's own free text (philosophy_quote,
 * outside_the_room) against the same board-safety rules generated copy is
 * checked against. This is the ONLY reuse this module makes: `checkEthics`
 * from lib/ethics/rules.ts, called exactly the way it already is for
 * generated copy (see lib/ethics/guard.ts's `enforceEthicsGuard`).
 *
 * What this module deliberately does NOT do:
 *   - No second rule set. The six rules and their patterns live in
 *     rules.ts, once.
 *   - No merge with the USP banned-phrase check (usp_banned_phrases_check /
 *     lib/generation/banned-phrases.ts) — a genuinely separate mechanism
 *     (a literal-string table checked server-role, not a compiled-regex
 *     pass), never combined with this one.
 *   - No rewrite. guard.ts's enforceEthicsGuard exists to retry a rewrite
 *     through an LLM for AI-generated copy and throws when unresolved —
 *     that is the wrong tool here. A clinician's own words are hers; a
 *     blocking match is surfaced for her to edit, never silently changed
 *     and never something that blocks saving the field (a profile must
 *     stay saveable while in progress — see clinician_profile_completeness
 *     for how an unresolved field is tracked instead).
 */

export type ClinicianEthicsField = "philosophy_quote" | "outside_the_room";

export type ClinicianEthicsFlag = {
  field: ClinicianEthicsField;
  check: EthicsCheckResult;
};

export function checkClinicianFreeText(
  field: ClinicianEthicsField,
  text: string
): ClinicianEthicsFlag {
  return { field, check: checkEthics(text) };
}
