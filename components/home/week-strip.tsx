import { MonoLabel } from "@/components/ui/mono-label";
import type { WeekDay } from "@/lib/data/home";

/*
 * Seven day letters, a dot under any day carrying a content item, today
 * underlined in her primary colour.
 *
 * ⚠ The underline is a second, deliberate exception to "her brand colour only
 * inside canvases" -- the Next card's button is the first. Both are named
 * here and in `home-view.tsx` rather than left for a later session to find
 * and "fix" back to a neutral tone.
 *
 * The letters are decorative (a screen reader gets no signal from "S M T W T
 * F S" alone); the real information -- which day, whether it carries
 * content, whether it is today -- is on the cell itself.
 */
export function WeekStrip({ days, primaryColor }: { days: WeekDay[]; primaryColor: string }) {
  return (
    <div
      role="list"
      aria-label="This week"
      className="mt-6 flex items-start justify-between gap-1 rounded-card border border-line p-[14px_18px]"
    >
      {days.map((day) => (
        <div
          key={day.key}
          role="listitem"
          aria-label={weekDayAriaLabel(day)}
          className="flex flex-1 flex-col items-center gap-2"
        >
          <span aria-hidden="true">
            <MonoLabel tracking="14" tone={day.isToday ? "ink" : "ink-3"}>
              {day.label}
            </MonoLabel>
          </span>
          <span
            aria-hidden="true"
            className="size-1.5 rounded-pill"
            style={{ background: day.hasContent ? "var(--accent)" : "transparent" }}
          />
          <span
            aria-hidden="true"
            className="h-0.5 w-5 rounded-pill"
            style={{ background: day.isToday ? primaryColor : "transparent" }}
          />
        </div>
      ))}
    </div>
  );
}

function weekDayAriaLabel(day: WeekDay): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${day.key}T12:00:00Z`)
  );
  const parts = [weekday];
  if (day.isToday) parts.push("today");
  if (day.hasContent) parts.push("has content scheduled");
  return parts.join(", ");
}
