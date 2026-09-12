import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { SectionGlyph } from "@/components/ui/glyphs";
import type { SinceRow } from "@/lib/data/home";

/*
 * "Recent updates" — the notifications table, the same rows that used to
 * render as "Since you were here". Three at most, a hairline between them,
 * each a real link to the thing it names.
 *
 * The state dot is `read_at === null` and nothing else. The relative time is
 * `created_at`; the one folded-in row that is a CONDITION rather than an event
 * carries no timestamp and therefore shows none, instead of being stamped
 * `now` to fill the column.
 */
export function RecentUpdates({ rows, viewAllHref }: { rows: SinceRow[]; viewAllHref: string }) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="recent-updates" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-4">
        <MonoLabel tracking="16" as="h2" id="recent-updates">
          Recent updates
        </MonoLabel>
        <Link
          href={viewAllHref}
          className="-my-2 ml-auto inline-flex min-h-[44px] items-center text-meta text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
        >
          View all &rarr;
        </Link>
      </div>

      <ul className="flex flex-col rounded-card border border-line">
        {rows.map((row) => (
          <li key={row.id} className="border-t border-line first:border-t-0">
            <Link href={row.href} className="flex items-center gap-3.5 p-[14px_16px] hover:bg-card">
              <span
                aria-hidden="true"
                className="flex size-9 flex-none items-center justify-center rounded-preview bg-card text-ink-2"
              >
                <SectionGlyph section="identity" />
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-2 text-ui font-medium leading-body text-ink first-letter:uppercase">
                  {row.title}
                </span>
                {row.detail ? (
                  <span className="line-clamp-1 text-meta leading-body text-ink-2">{row.detail}</span>
                ) : null}
              </span>

              {row.at ? (
                <span className="flex-none text-meta leading-body text-ink-3">
                  {relativeTime(row.at)}
                </span>
              ) : null}

              {row.unread ? (
                <span
                  className="size-1.5 flex-none rounded-pill bg-accent"
                  role="img"
                  aria-label="Unread"
                />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * `2 hours ago`, `1 day ago`. Whole units only — a notification does not need
 * to be precise to the minute, and "just now" for anything under an hour is
 * the honest resolution for a row that syncs on page load.
 */
function relativeTime(isoDate: string): string {
  const minutes = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000);
  if (minutes < 60) return "Just now";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;

  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}
