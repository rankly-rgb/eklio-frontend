import { MonoLabel } from "@/components/ui/mono-label";

/*
 * ── WHAT IS LEFT, AFTER THE GAUGE SAYS 7 OF 7 ───────────────────────────
 *
 * The seven-segment gauge is honest about the BRIEF, and the review and
 * positioning screens are deliberately not an eighth and ninth step — they are
 * confirmations, and numbering them would make the brief look longer than it
 * is.
 *
 * ⚠ BUT SHE STILL HAS TWO SCREENS TO GO, AND NOTHING SAID SO. She finished a
 * gauge that filled to the end, and then landed on two unnumbered screens with
 * no sense of whether there were two more or ten. On a path sold as "seven
 * steps", that reads as the count having been a lie — and this is a nervous
 * audience being asked to trust a stranger with how her practice sounds.
 *
 * So: a three-part trail, named rather than numbered. It cannot be mistaken
 * for more brief steps, and it cannot leave her guessing how much is left.
 */

export type AfterStep = "review" | "positioning" | "directions";

const TRAIL: { id: AfterStep; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "positioning", label: "Your positioning" },
  { id: "directions", label: "Your directions" },
];

export function AfterTheBrief({ current }: { current: AfterStep }) {
  const index = TRAIL.findIndex((entry) => entry.id === current);
  const left = TRAIL.length - index - 1;

  return (
    <div className="flex flex-col gap-2">
      <MonoLabel tracking="16">Brief complete</MonoLabel>

      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {TRAIL.map((entry, position) => (
          <li key={entry.id} className="flex items-center gap-2">
            <span
              className={`text-helper ${
                position < index
                  ? "text-ink-3 line-through decoration-[var(--line)]"
                  : position === index
                    ? "text-ink"
                    : "text-ink-3"
              }`}
              aria-current={position === index ? "step" : undefined}
            >
              {entry.label}
            </span>
            {position < TRAIL.length - 1 ? (
              <span aria-hidden="true" className="text-ink-3">
                ·
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {/*
        The number said out loud, not only drawn. A trail of three words is a
        picture; "one more screen" is the thing she is actually asking.
      */}
      <p className="text-helper leading-prose text-ink-2">
        {left === 0
          ? "This is the last one."
          : left === 1
            ? "One more screen, then your directions."
            : `${left} more screens, then your directions.`}
      </p>
    </div>
  );
}
