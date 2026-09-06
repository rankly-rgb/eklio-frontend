import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { MonthlyPresenceSubscriptionCard } from "@/components/presence/subscription-card";
import type { ContentMonth } from "@/lib/data/content";

/*
 * Monthly Presence's card on home — takes the launch checklist's slot once
 * "Your first week" fully resolves.
 *
 * It now counts `content_items`, the same rows `/app/content` renders, so the
 * two surfaces cannot disagree. Every number here is counted by the database
 * over her own rows: nothing is estimated, and "your first month is being
 * prepared" is said only when there is genuinely nothing, rather than
 * standing in for a count we could not compute.
 */
export function MonthlyPresenceCard({
  month,
  entitled,
  monthLabel,
}: {
  month: ContentMonth;
  entitled: boolean;
  monthLabel: string;
}) {
  const items = [...month.items, ...month.unscheduled];

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="monthly-presence"
        className="box-border flex flex-col rounded-card border border-line p-[22px_24px]"
      >
        <MonoLabel tracking="16" as="h2" id="monthly-presence">
          Monthly Presence
        </MonoLabel>

        {items.length > 0 ? (
          <>
            <p className="mt-4 text-ui leading-prose text-ink">
              {`${month.counts.ready} of ${items.length} ready for ${titleCase(monthLabel)}.`}
            </p>
            {nextItem(items) ? (
              <p className="mt-2 text-helper leading-prose text-ink-2">
                {nextItemLine(nextItem(items)!)}
              </p>
            ) : null}
            <ButtonLink href="/app/content" variant="secondary" className="mt-5 self-start">
              See this month
            </ButtonLink>
          </>
        ) : (
          <>
            <p className="mt-4 text-ui leading-prose text-ink">
              Nothing planned for {titleCase(monthLabel)} yet.
            </p>
            <ButtonLink href="/app/content" variant="secondary" className="mt-5 self-start">
              Open the calendar
            </ButtonLink>
          </>
        )}
      </section>

      {!entitled ? <MonthlyPresenceSubscriptionCard /> : null}
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** The next thing still ahead of her: not posted, earliest first. */
function nextItem(items: ContentItem[]): ContentItem | null {
  return items.find((item) => !item.posted) ?? null;
}

function nextItemLine(item: ContentItem): string {
  const label = item.title ?? "Untitled";
  if (!item.scheduled_for) return `${label} — no date yet.`;
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${item.scheduled_for}T12:00:00Z`));
  return `${label} — ${date}.`;
}

type ContentItem = ContentMonth["items"][number];
