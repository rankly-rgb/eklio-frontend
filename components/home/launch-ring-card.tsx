import { MonoLabel } from "@/components/ui/mono-label";
import { CheckGlyph } from "@/components/ui/glyphs";
import type { LaunchProgress } from "@/lib/data/checklist";

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/*
 * The launch ring -- a compact, read-only summary of "Your first week",
 * distinct from the interactive accordion `LaunchChecklist` renders: the
 * ONE actionable step already lives in the Next card above, so this card's
 * job is a glance at the rest, not a second place to click Mark done.
 */
export function LaunchRingCard({ progress }: { progress: LaunchProgress }) {
  const fraction = progress.total > 0 ? progress.resolvedCount / progress.total : 0;
  const dashoffset = CIRCUMFERENCE * (1 - fraction);

  return (
    <section
      aria-labelledby="your-first-week"
      className="box-border flex flex-col rounded-card border border-line p-[22px_24px]"
    >
      <MonoLabel tracking="16" as="h2" id="your-first-week">
        Your first week
      </MonoLabel>

      <div className="mt-4 flex items-center gap-5">
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          role="img"
          aria-label={`${progress.resolvedCount} of ${progress.total} steps done`}
          className="flex-none -rotate-90"
        >
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="4" />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <span aria-hidden="true">
          <MonoLabel tracking="16" tone="ink">
            {`${progress.resolvedCount} of ${progress.total}`}
          </MonoLabel>
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {progress.items.map((item) => (
          <li key={item.key} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`flex size-4 flex-none items-center justify-center rounded-pill ${
                item.status === "done"
                  ? "bg-accent"
                  : item.status === "skipped"
                    ? "bg-ink-3"
                    : "border border-line"
              }`}
            >
              {item.status === "done" ? <CheckGlyph size="sm" /> : null}
            </span>
            <span
              className={`truncate text-ui leading-body ${
                item.status === "todo" ? "text-ink" : "text-ink-3"
              } ${item.status === "done" ? "line-through decoration-[var(--ink-3)]" : ""}`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
