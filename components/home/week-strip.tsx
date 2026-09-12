import { MonoLabel } from "@/components/ui/mono-label";
import type { WeekDay } from "@/lib/data/home";

/*
 * ── THE WEEK ─────────────────────────────────────────────────────────────
 *
 * Seven day letters over their dates, today in a filled clay circle, a dot
 * under any day carrying a post, and — at the right — the real dates that
 * carry them.
 *
 * Every one of those comes off `content_items.scheduled_for` through
 * `buildWeekStrip`; none of it is written by hand. The sentence at the right
 * is the SAME days as the dots, spelled out, so the two can never disagree:
 * it is derived from the dotted days rather than assembled from a second read.
 *
 * ⚠ A known, deliberate gap lives upstream in `buildWeekStrip`: the month is
 * the calendar month today falls in, so a week spanning a month boundary can
 * under-count the days belonging to the next one. It is logged in FINDINGS.md
 * and not closed here.
 *
 * The letters are decorative — "S M T W T F S" tells a screen reader nothing.
 * The real information is on the cell.
 */
export function WeekStrip({ days, primaryColor }: { days: WeekDay[]; primaryColor: string }) {
  const withContent = days.filter((day) => day.hasContent);

  return (
    <section aria-labelledby="this-week" className="flex items-center gap-8 max-md:flex-col max-md:items-stretch max-md:gap-5">
      <MonoLabel tracking="16" as="h2" id="this-week" className="flex-none">
        This week
      </MonoLabel>

      <ul role="list" className="flex min-w-0 flex-1 items-start justify-between gap-1">
        {days.map((day) => (
          <li
            key={day.key}
            aria-label={weekDayAriaLabel(day)}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span aria-hidden="true">
              <MonoLabel tracking="14" tone={day.isToday ? "accent" : "ink-3"}>
                {day.label}
              </MonoLabel>
            </span>
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-pill text-ui leading-body"
              style={
                day.isToday
                  ? { background: "var(--accent)", color: "var(--bg)" }
                  : { color: "var(--ink-2)" }
              }
            >
              {dayOfMonth(day.key)}
            </span>
            <span
              aria-hidden="true"
              className="size-1.5 rounded-pill"
              style={{ background: day.hasContent ? primaryColor : "transparent" }}
            />
          </li>
        ))}
      </ul>

      {withContent.length > 0 ? (
        <p className="flex flex-none items-center gap-2.5">
          <CalendarGlyph />
          <MonoLabel tracking="14" tone="ink-2">
            {postsLine(withContent)}
          </MonoLabel>
        </p>
      ) : null}
    </section>
  );
}

/*
 * A calendar, drawn in divs like every other mark in this app — a frame, a
 * head rail, two tick marks. It lives here rather than in
 * `components/ui/glyphs.tsx`, whose header calls itself "the three only
 * glyphs of the app": `status-chip.tsx` already set the precedent that a
 * second family belongs beside what it serves, not bolted onto that claim.
 */
function CalendarGlyph() {
  const stroke = "1.25px solid currentColor";

  return (
    <span
      aria-hidden="true"
      className="relative block size-[14px] flex-none text-ink-3"
      style={{ border: stroke, borderRadius: 2, boxSizing: "border-box" }}
    >
      <span
        className="absolute inset-x-0 top-0 block"
        style={{ height: 3.5, borderBottom: stroke, boxSizing: "border-box" }}
      />
      <span
        className="absolute left-[2.5px] top-[6.5px] block"
        style={{ width: 3, height: 3, background: "currentColor" }}
      />
    </span>
  );
}

/** `2026-09-08` → `8`. */
function dayOfMonth(key: string): number {
  return Number(key.slice(8, 10));
}

/** `Posts on the 8th and the 14th` — from the dotted days, never a second read. */
function postsLine(days: WeekDay[]): string {
  const dates = days.map((day) => `the ${ordinal(dayOfMonth(day.key))}`);
  if (dates.length === 1) return `Post on ${dates[0]}`;
  const last = dates[dates.length - 1];
  return `Posts on ${dates.slice(0, -1).join(", ")} and ${last}`;
}

/** `1` → `1st`, `2` → `2nd`, `11` → `11th`, `21` → `21st`. */
function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function weekDayAriaLabel(day: WeekDay): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day.key}T12:00:00Z`));
  const parts = [weekday];
  if (day.isToday) parts.push("today");
  if (day.hasContent) parts.push("has content scheduled");
  return parts.join(", ");
}
