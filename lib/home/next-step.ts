import type { LaunchStepKey } from "@/lib/data/checklist";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";
import { STEP_ASSET_KEYS, stepTextBlocks } from "@/lib/launch/material";

export { assetFormatLine } from "@/lib/launch/material";

/*
 * What the NEXT STEP card can show beside a step's title and body: the exact
 * text the step asks her to paste, and the one asset it asks her to use.
 *
 * ⚠ NEITHER IS INVENTED, AND NEITHER IS MANDATORY. A step that carries no
 * copy and no asset renders neither block — the card stays composed with a
 * title, a body and its two buttons, which is the honest shape for "open the
 * site editor". Nothing here fills a gap with an example.
 */

/**
 * The catalogue key each step's own copy already points at.
 *
 * ⚠ READ OFF THE PRODUCT, NOT CHOSEN. `LaunchStepDetail` already tells her
 * which file each of these steps needs — "Get your avatar and cover image",
 * "Get your signature template" — and sends her to the assets page for it.
 * This names the same file so the card can show it in place. A key absent
 * from the manifest yields no asset row rather than an empty one: the
 * catalogue is the authority on what exists.
 */
/**
 * The ONE catalogue key the NEXT STEP card shows — the first of whatever the
 * step needs. The card has room for one file; the step screen shows them all.
 * Both read `STEP_ASSET_KEYS`, so they cannot name different files.
 */
export const STEP_ASSET_KEY: Partial<Record<LaunchStepKey, string>> = Object.fromEntries(
  Object.entries(STEP_ASSET_KEYS)
    .map(([key, keys]) => [key, keys[0]])
    .filter(([, first]) => Boolean(first))
);

export type StepCopy = {
  /** The mono label — now only the copy button's accessible name. */
  label: string;
  /** The exact text, as she will paste it. */
  text: string;
};

/**
 * The FIRST copyable string a step carries, for the card. The step screen uses
 * `stepTextBlocks` directly and shows every one of them.
 *
 * ⚠ ONE MAPPING NOW, NOT TWO. This used to hold its own copy of the step→text
 * switch beside `stepTextBlocks`; they are the same function now, and the card
 * simply takes the head of the list.
 */
export function launchStepCopy(
  step: LaunchStepKey,
  context: LaunchStepContext
): StepCopy | null {
  return stepTextBlocks(step, context)[0] ?? null;
}
