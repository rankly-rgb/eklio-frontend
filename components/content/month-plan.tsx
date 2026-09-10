"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/text-field";
import { MonoLabel } from "@/components/ui/mono-label";
import {
  ARCHETYPE_LABELS,
  type ContentItem,
  type ContentMonthRecord,
} from "@/lib/data/content";

/*
 * ── THE MONTH AS A PLAN, ON ONE SCREEN ──────────────────────────────────
 *
 * She has already spent her sixty seconds on the check-in. This is the other
 * end of the promise: everything Eklio wrote for the month, readable in one
 * sitting, approved in one gesture.
 *
 * ⚠ THIS SCREEN IS EKLIO CHROME, NOT HERS. It is deliberately NOT rendered in
 * her typefaces or her palette. Two reasons:
 *
 *   1. It is a review surface. Her brand's job is to make copy look finished;
 *      a review surface's job is the opposite — to make it look provisional
 *      enough to change. Setting twelve machine-written lines in her own
 *      display face makes them look decided.
 *   2. The composed posts appear NEXT to it once they exist. Chrome that
 *      imitated her brand would compete with the thing it is framing.
 *
 * ── GROUPED BY THEME, NOT BY DATE ───────────────────────────────────────
 *
 * A date-ordered list is a to-do list, and she cannot tell from it whether the
 * month says anything. Three themes, each with its posts underneath, is the
 * shape of the decision she is actually being asked to make: does this month
 * sound like my practice? The dates are on each row, for the two people who
 * will want them.
 */

export type MonthPlanProps = {
  record: ContentMonthRecord;
  items: ContentItem[];
  monthLabel: string;
  /*
   * ⚠ WHAT WROTE THIS MONTH, said on the screen. A stubbed month and a real
   * one are otherwise identical, and the whole point of carrying the label
   * from `ContentModel` through the pipeline is that it survives to here.
   * Null means a month generated before the label existed.
   */
  generatedBy: string | null;
  /** Fixture data is labelled where it appears, never only in a comment. */
  fixture?: boolean;
};

export function MonthPlan({
  record,
  items,
  monthLabel,
  generatedBy,
  fixture = false,
}: MonthPlanProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const proposed = items.filter((item) => item.status === "proposed");
  const approved = record.status === "approved" || proposed.length === 0;

  /*
   * Themes come from the month RECORD, in the order the generator chose, not
   * from the items. A theme that produced nothing must still be visible: it is
   * the difference between "we had no idea about rest" and "rest is missing".
   */
  const byTheme = record.themes.map((theme) => ({
    theme,
    posts: items.filter((item) => themeOf(item) === theme),
  }));
  const untethered = items.filter((item) => themeOf(item) === null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/content-months/${record.id}/approve`, {
        method: "POST",
      });
      if (!response.ok) {
        setError("We couldn't approve that. Try again in a moment.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MonoLabel tracking="16">Your month</MonoLabel>
          {fixture ? <FixtureBadge /> : null}
        </div>
        <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
          {monthLabel}
        </h1>
        <p className="max-w-[560px] text-helper leading-prose text-ink-2">
          {approved
            ? "This month is yours. Every post is a draft you can edit, move or delete."
            : `${proposed.length} ${proposed.length === 1 ? "post" : "posts"}, written around ` +
              `three themes. Read them, then take the month — nothing is scheduled to go ` +
              `anywhere until you say so.`}
        </p>

        {/*
          ⚠ NEVER DISPLAY A NUMBER EKLIO CANNOT MEASURE. `generatedBy` is
          recorded on the month; when it is absent this says so rather than
          guessing a model name.
        */}
        <p className="text-[11px] uppercase tracking-[0.08em] text-ink-3">
          Written by {generatedBy ?? "an earlier version of Eklio"}
        </p>

        {/*
          ── WHERE THE THEMES CAME FROM, SHOWN TO HER ──────────────────────
          She is being asked whether a month sounds like her practice. Half of
          that question is whether its three themes follow from what she
          actually said — and she cannot answer it without seeing the sentence
          they came from. Quoting it back is also the only honest way to show
          that the minute she spent on the check-in did something.
        */}
        {record.theme_source_text ? (
          <blockquote className="mt-2 border-l-2 border-line pl-4 text-helper leading-prose text-ink-2">
            <p>
              Written around what you told us was coming up in your sessions:
            </p>
            <p className="mt-1 italic text-ink">“{record.theme_source_text}”</p>
          </blockquote>
        ) : record.theme_source === "derived_brief" ? (
          <p className="mt-2 text-helper leading-prose text-ink-2">
            You didn&apos;t fill in this month&apos;s check-in, so this was written
            from your brief and the time of year. A minute next month makes it
            sound more like this month than any other.
          </p>
        ) : null}
      </header>

      {byTheme.map(({ theme, posts }) => (
        <section key={theme} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
            <h2 className="font-display text-h2 font-medium text-ink">{theme}</h2>
            <span className="text-helper text-ink-3">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </span>
          </div>

          {posts.length === 0 ? (
            <p className="text-helper leading-prose text-ink-2">
              Nothing was written for this theme.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {posts.map((post) => (
                <PlanRow key={post.id} item={post} />
              ))}
            </ul>
          )}
        </section>
      ))}

      {untethered.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="border-b border-line pb-2">
            <h2 className="font-display text-h2 font-medium text-ink">Yours, in the same month</h2>
          </div>
          <ul className="flex flex-col gap-3">
            {untethered.map((post) => (
              <PlanRow key={post.id} item={post} />
            ))}
          </ul>
        </section>
      ) : null}

      {approved ? null : (
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={approve} disabled={isPending}>
              {isPending ? "Taking the month…" : `Take the month`}
            </Button>
            {/*
              What the button does, before it is pressed. Twelve rows change
              state at once; "Approve" alone does not say that, and a gesture
              she cannot predict is not a gesture she consented to.
            */}
            <span className="text-helper leading-prose text-ink-2">
              Moves all {proposed.length} into your drafts. Nothing is published, and
              nothing is sent.
            </span>
          </div>
          {error ? <InlineError>{error}</InlineError> : null}
        </div>
      )}
    </div>
  );
}

/*
 * The two texts, both shown, and shown as two.
 *
 * ⚠ NEVER THE CAPTION ALONE. What she sees in the Instagram grid is the
 * on-image line; the caption is what a reader gets after tapping. A review
 * screen that showed only one of them would be asking her to approve half the
 * post — and the half she did not see is the one everybody sees first.
 */
function PlanRow({ item }: { item: ContentItem }) {
  return (
    <li className="rounded-card border border-line bg-paper p-4">
      <Link href={`/app/content/${item.id}`} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.08em] text-ink-3">
          <span>{item.scheduled_for ?? "No date"}</span>
          <span>·</span>
          <span>{ARCHETYPE_LABELS[item.archetype]}</span>
          {item.register ? (
            <>
              <span>·</span>
              <span>{item.register.replace(/_/g, " ")}</span>
            </>
          ) : null}
          {item.status === "proposed" ? (
            <>
              <span>·</span>
              <span>Proposed</span>
            </>
          ) : null}
        </div>

        {item.on_image_text ? (
          <p className="text-body leading-snug text-ink">“{item.on_image_text}”</p>
        ) : (
          <p className="text-body leading-snug text-ink-3">No line on the image.</p>
        )}

        {item.caption ? (
          <p className="max-w-[62ch] whitespace-pre-line text-helper leading-prose text-ink-2">
            {item.caption}
          </p>
        ) : null}

        {/*
          Alt text is shown, not hidden behind an accordion. It is copy she
          publishes under her own name, and the RPC refuses `ready` without it —
          so it belongs in the review, not in a drawer.
        */}
        {item.alt_text ? (
          <p className="text-[11px] leading-prose text-ink-3">Alt: {item.alt_text}</p>
        ) : (
          <p className="text-[11px] leading-prose text-danger">
            No alt text — this post cannot be marked ready.
          </p>
        )}
      </Link>
    </li>
  );
}

/** Loud on purpose. A fixture that reads as real is how a fixture gets published. */
function FixtureBadge() {
  return (
    <span className="rounded-pill border border-danger px-2.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-danger">
      Fixture — not real content
    </span>
  );
}

/*
 * ⚠ `theme`, NEVER `category`. An earlier draft of this file grouped by
 * `category` because it was there and it was free text. `category` is HERS:
 * she can rename it from the item editor, and the day she did, that post would
 * vanish from its theme group with no error and no empty state. `theme` is the
 * month's, written once by the generator and checked in the database against
 * `content_months.themes`.
 */
function themeOf(item: ContentItem): string | null {
  return item.theme;
}
