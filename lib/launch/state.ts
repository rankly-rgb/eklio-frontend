import type { LaunchStep, LaunchStepKey, LaunchStepStatus } from "@/lib/data/checklist";

/*
 * The checklist's state transitions, as pure functions.
 *
 * ⚠ THEY LIVE HERE SO THEY CAN BE TESTED. This repo's vitest runs in `node`
 * with no DOM and no testing-library, and this chantier may not add a
 * dependency — so a test cannot render the rail and click it. Pulling the
 * transitions out of the provider means the things that actually have to be
 * right (an optimistic tick, the revert after a refusal, the counter that
 * follows, the card and the rail reading one array) are covered as pure
 * functions, and the component is left holding only the wiring.
 *
 * What that does NOT cover is the wiring itself: that the button calls this,
 * that the ring re-renders. Those are in the by-hand list, and named there
 * rather than implied by a green suite.
 */

/** One row moved. Every other row is returned unchanged and identical. */
export function applyStatus(
  items: LaunchStep[],
  key: LaunchStepKey,
  status: LaunchStepStatus
): LaunchStep[] {
  return items.map((item) => (item.key === key ? { ...item, status } : item));
}

/**
 * Resolved = done OR skipped — the same rule `get_launch_progress` applies, so
 * the client count and the server count cannot drift apart by definition.
 */
export function resolvedCount(items: LaunchStep[]): number {
  return items.filter((item) => item.status !== "todo").length;
}

/** The first `todo`: the emphasised row, and the step the Next card shows. */
export function currentKey(items: LaunchStep[]): LaunchStepKey | null {
  return items.find((item) => item.status === "todo")?.key ?? null;
}

/**
 * One step's status out of the shared array.
 *
 * This is what keeps the NEXT STEP card and the rail from disagreeing: the
 * card's step is chosen on the SERVER, but its state is read from the same
 * client array the rail renders, so a tick in either place moves both.
 */
export function statusOf(
  items: LaunchStep[],
  key: LaunchStepKey,
  fallback: LaunchStepStatus
): LaunchStepStatus {
  return items.find((item) => item.key === key)?.status ?? fallback;
}

/** `done:site_setup|todo:first_post` — for comparing a server answer to ours. */
export function signature(items: LaunchStep[]): string {
  return items.map((item) => `${item.key}:${item.status}`).join("|");
}
