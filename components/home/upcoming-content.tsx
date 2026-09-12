import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { StatusChip } from "@/components/ui/status-chip";
import { PhotoSlot } from "@/components/kit/photo-slot";
import type { UpcomingItem } from "@/lib/data/home";

/*
 * "Upcoming content" — her scheduled posts from today forward, three at most.
 *
 * The thumbnail is the REAL rendered photograph for the item's own image slot,
 * signed on the same read as the hero's, with `<PhotoSlot>`'s deterministic
 * gradient behind it until one exists. No stock, no placeholder tile.
 *
 * The status pill is the product's one status vocabulary (`STATUSES`), not a
 * colour invented for this row. The mockup draws READY in green; there is no
 * green in `styles/tokens.css`, whose own header forbids adding a value that
 * did not come from the eight reference screens, so READY reads in ink with
 * its check the way it reads everywhere else in the app.
 */
export function UpcomingContent({
  items,
  viewContentHref,
  primaryColor,
  darkNeutral,
}: {
  items: UpcomingItem[];
  viewContentHref: string;
  primaryColor: string;
  darkNeutral: string;
}) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-content" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-4">
        <MonoLabel tracking="16" as="h2" id="upcoming-content">
          Upcoming content
        </MonoLabel>
        <Link
          href={viewContentHref}
          className="-my-2 ml-auto inline-flex min-h-[44px] items-center text-meta text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
        >
          View content &rarr;
        </Link>
      </div>

      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.id} className="rounded-card border border-line">
            {/*
              ⚠ THE WHOLE ROW IS THE LINK, NOT THE `Edit →`. That affordance is
              hidden under `md`, and when it was the only anchor an upcoming
              post could not be opened at all on a phone. It stays as a visual
              cue at desktop — a span inside the row's anchor, never a second
              anchor nested in the first.
            */}
            <Link href={item.href} className="flex items-center gap-3.5 p-[12px_16px] hover:bg-card">
              <PhotoSlot
                tokens={{ primary: primaryColor, dark_neutral: darkNeutral }}
                src={item.photoUrl}
                className="aspect-[16/10] w-[68px] flex-none rounded-preview"
              />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-2 text-ui font-medium leading-body text-ink">
                  {`Post ${item.position} — ${postDate(item.scheduledFor)}`}
                </span>
                {item.caption ? (
                  <span className="line-clamp-1 text-meta leading-body text-ink-2">
                    &ldquo;{item.caption}&rdquo;
                  </span>
                ) : null}
              </span>

              <span className="flex-none rounded-pill bg-card px-2.5 py-1">
                <StatusChip status={item.status} />
              </span>

              <span
                aria-hidden="true"
                className="flex-none whitespace-nowrap text-meta text-ink-2 max-md:hidden"
              >
                Edit &rarr;
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `2026-09-14` → `September 14`, in UTC so the key is not shifted by a zone. */
function postDate(scheduledFor: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${scheduledFor}T12:00:00Z`));
}
