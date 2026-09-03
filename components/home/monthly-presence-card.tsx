import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { MonthlyPresenceSubscriptionCard } from "@/components/presence/subscription-card";
import type { CalendarSummary } from "@/lib/data/calendar";

/*
 * Monthly Presence's card on home (Lot 8) — takes the launch checklist's
 * slot once "Your first week" fully resolves (Lot 6's decision: that
 * transition is when the subscription gets sold, not the day she paid).
 *
 * Same honesty rule as the content page: zero rows is today's reality for
 * every kit (the monthly cron hasn't run yet for a kit bought mid-month),
 * and it says so plainly rather than showing anything invented.
 */
export function MonthlyPresenceCard({
  calendar,
  entitled,
  monthLabel,
}: {
  calendar: CalendarSummary;
  entitled: boolean;
  monthLabel: string;
}) {
  const hasContent = calendar.items.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="monthly-presence"
        className="box-border flex flex-col rounded-card border border-line p-[22px_24px]"
      >
        <MonoLabel tracking="16" as="h2" id="monthly-presence">
          Monthly Presence
        </MonoLabel>

        {hasContent ? (
          <>
            <p className="mt-4 text-ui leading-prose text-ink">
              {`${calendar.ready_count} of ${calendar.items.length} ready for ${titleCase(monthLabel)}.`}
            </p>
            <ButtonLink href="/app/content" variant="secondary" className="mt-5 self-start">
              See this month
            </ButtonLink>
          </>
        ) : (
          <p className="mt-4 text-ui leading-prose text-ink">
            Your first month is being prepared.
          </p>
        )}
      </section>

      {!entitled ? <MonthlyPresenceSubscriptionCard /> : null}
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
