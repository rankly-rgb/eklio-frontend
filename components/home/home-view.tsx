import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { BrandPreview } from "@/components/preview/brand-preview";
import { PracticeHeader } from "@/components/home/practice-header";
import { BrandCanvas } from "@/components/home/brand-canvas";
import { NextCard } from "@/components/home/next-card";
import { WeekStrip } from "@/components/home/week-strip";
import { LaunchRing } from "@/components/home/launch-ring";
import { QuickTools, RailChecklist, RailMeta, RailQuote } from "@/components/home/rail";
import { MonthlyPresenceCard } from "@/components/home/monthly-presence-card";
import { SinceYouWereHere } from "@/components/home/since-you-were-here";
import { RecentlyDeletedSection } from "@/components/home/recently-deleted-section";
import { StartBriefButton } from "@/components/brief/start-brief-button";
import { SAMPLE_PREVIEW } from "@/lib/brand/sample";
import type { HomeCanvas, HomeModel } from "@/lib/data/home";
import { greeting, homeHeaderDate } from "@/lib/data/home";

/*
 * ── THE HOME SHELL ───────────────────────────────────────────────────────
 *
 * Three zones under the header row, and a rail down the right:
 *
 *   main   ≈48%  the hero canvas
 *   middle ≈26%  the one NEXT STEP card
 *   rail   ≈22%  sticky, with a full-height rule down its left edge
 *
 * The week strip and the sub-grid below them span main AND middle — the
 * chantier's prose puts them inside the main column, the mockup runs them the
 * full width of the content area, and the mockup wins.
 *
 * ── HOW THE TWO LAYOUTS ARE ONE TREE ────────────────────────────────────
 *
 * Desktop is a grid with every item placed explicitly. Mobile is a flex
 * column, and the rail becomes `display: contents` so its blocks stop being
 * one unit and join the single column as siblings. That is what lets the
 * checklist sit between the week strip and "recent updates" at 375px while
 * quick tools and the meta footer fall to the end — the stacking order the
 * chantier specifies — without rendering the rail twice or duplicating an id.
 *
 * `order-*` drives the mobile column. On the desktop grid it changes nothing:
 * every item there carries an explicit `col-start`/`row-start`, and explicit
 * placement ignores order.
 */
export function HomeView({ home, canvas }: { home: HomeModel; canvas: HomeCanvas | null }) {
  const kit = home.brandKit;

  if (!home.projectId) return <EmptyHome />;

  const now = new Date();
  const practiceName = kit?.practiceName ?? "Your practice";

  if (!kit || !canvas) {
    return (
      <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)] max-md:pt-10">
        <PracticeHeader
          dateLabel={homeHeaderDate(now)}
          practiceName={practiceName}
          quote={home.quote}
        />
        <StartingOut home={home} />
        <RecentlyDeletedSection kits={home.deletedKits} />
      </main>
    );
  }

  const everyStepDone =
    home.checklist.total > 0 && home.checklist.resolvedCount === home.checklist.total;

  return (
    <main className="route-enter flex-1 pb-16 pt-8 max-lg:pt-10">
      <div className="grid grid-cols-[48fr_26fr_22fr] items-start gap-x-8 max-lg:flex max-lg:flex-col max-lg:gap-8 max-lg:px-[var(--gutter-sm)]">
        {/*
         * The rule, and only the rule. It is its own grid item, stretched over
         * every row, because the rail beside it is `sticky` — and a sticky item
         * sits at `align-self: start`, so a border on the rail itself would
         * stop wherever the rail's content stops instead of running the page.
         */}
        <div
          aria-hidden="true"
          className="col-start-3 col-end-4 row-start-1 row-end-5 h-full border-l border-line max-lg:hidden"
        />

        <div className="order-1 col-start-1 col-end-3 row-start-1 pl-[var(--gutter)] max-lg:pl-0">
          <PracticeHeader
            dateLabel={homeHeaderDate(now)}
            practiceName={practiceName}
            quote={home.quote}
          />
        </div>

        <div className="order-2 col-start-1 col-end-2 row-start-2 min-w-0 pt-7 pl-[var(--gutter)] max-lg:pt-0 max-lg:pl-0">
          {/* The `PRACTICE · DIRECTION · AS OF …` caption that used to sit
              under this canvas is gone from here on purpose: the mockup moves
              it to the rail's meta footer, and LOT 4 puts it there. */}
          <BrandCanvas
            practiceName={kit.practiceName}
            tokens={canvas.tokens}
            hero={canvas.hero}
            photoUrl={canvas.heroPhotoUrl}
            pages={canvas.pages}
            toneKeywords={kit.selectedDirection?.tone_keywords ?? []}
            stats={canvas.stats}
          />
        </div>

        <div className="order-3 col-start-2 col-end-3 row-start-2 min-w-0 pt-7 max-lg:pt-0">
          <NextCard
            brandKitId={kit.row.id}
            next={canvas.next}
            nextIndex={canvas.nextIndex}
            nextAsset={canvas.nextAsset}
            totalSteps={home.checklist.total}
            primaryColor={canvas.tokens.primary}
            ctaInk={canvas.tokens.cta_ink}
          />
        </div>

        <div className="order-4 col-start-1 col-end-3 row-start-3 mt-7 border-t border-line pt-5 pl-[var(--gutter)] max-lg:mt-0 max-lg:pl-0">
          <WeekStrip days={canvas.week} primaryColor={canvas.tokens.primary} />
        </div>

        <div className="order-6 col-start-1 col-end-3 row-start-4 mt-6 border-t border-line pt-6 pl-[var(--gutter)] max-lg:mt-0 max-lg:pl-0">
          <SinceYouWereHere rows={canvas.since} />
          <RecentlyDeletedSection kits={home.deletedKits} />
        </div>

        <aside
          aria-label="Your first week"
          className="col-start-3 col-end-4 row-start-1 row-end-5 sticky top-0 flex flex-col gap-6 self-start pl-6 pr-[var(--gutter)] max-lg:contents"
        >
          {/*
           * The ring and the seven rows. When every step is resolved the ring
           * gives way to the completion line and the Monthly Presence card,
           * exactly as it already did — the rail changed shape, not that rule.
           */}
          <div className="order-5 flex flex-col gap-5">
            {everyStepDone ? (
              <>
                <p className="text-ui leading-body text-ink">
                  Your brand is live in seven places.
                </p>
                <MonthlyPresenceCard
                  month={home.month}
                  entitled={home.entitled}
                  monthLabel={home.monthLabel}
                />
              </>
            ) : home.checklist.total > 0 ? (
              <>
                <LaunchRing progress={home.checklist} />
                <RailChecklist progress={home.checklist} />
              </>
            ) : null}
          </div>

          {/* Order 7 puts these AFTER the sub-grid at 375px, which is the
              stacking the chantier specifies. On the desktop rail they simply
              follow the checklist. */}
          <div className="order-7 flex flex-col gap-6">
            <QuickTools brandKitId={kit.row.id} />
            {home.railQuote ? <RailQuote quote={home.railQuote} /> : null}
            <RailMeta lines={canvas.meta} />
          </div>
        </aside>
      </div>
    </main>
  );
}

/*
 * The state before a canvas has anything to render: no kit yet, or a kit
 * with no direction chosen. `home.nudge` only ever produces `resume-brief` or
 * `choose-direction` here -- `site-ready` and `month-ready` both require a
 * chosen direction, which is exactly the condition that routes past this
 * branch.
 */
function StartingOut({ home }: { home: HomeModel }) {
  const kit = home.brandKit;

  if (kit?.directions && !kit.selectedDirection) {
    return (
      <div className="mt-6 flex items-center gap-8 rounded-card border border-line bg-card p-[20px_24px] max-md:flex-col max-md:items-stretch max-md:gap-4">
        <p className="min-w-0 flex-1 text-body text-ink">
          Three directions are ready. One of them sounds like you.
        </p>
        <ButtonLink
          href={`/app/brand-kits/${kit.row.id}/reveal`}
          variant="primary"
          className="flex-none max-md:h-11 max-md:w-full"
        >
          See them
        </ButtonLink>
      </div>
    );
  }

  return (
    <section className="mt-6 box-border flex flex-col justify-between gap-6 rounded-card border border-line p-[22px_24px]">
      <MonoLabel tracking="16" as="h2">
        Your brand
      </MonoLabel>
      <p className="max-w-[420px] text-helper leading-prose text-ink-2">
        Your brief is where it starts. About seven minutes, and you can stop and
        come back at any step.
      </p>
      <ButtonLink
        href={home.projectId ? `/app/briefs/${home.projectId}` : "/app"}
        variant="secondary"
        className="self-start"
      >
        Open my brief
      </ButtonLink>
    </section>
  );
}

/*
 * L'état vide : une seule carte large, la maquette d'exemple, et le point
 * d'entrée. Elle MONTRE ce qu'on obtient plutôt que de le décrire — c'est le
 * même argument que le rail du brief, appliqué avant qu'il n'existe.
 *
 * Unchanged by this rewrite on purpose: items 1-7 describe "your practice
 * this week", which presumes a practice. There is nothing here yet to make a
 * week of, so the earlier greeting-led screen stays exactly as it was.
 */
function EmptyHome() {
  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)] max-md:pt-10">
      <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
        {greeting(null)}
      </h1>

      <div className="mt-6 flex items-start gap-12 rounded-card border border-line p-8 max-lg:flex-col">
        <div className="flex max-w-[420px] flex-col gap-5">
          <MonoLabel tracking="16">Your first brand</MonoLabel>
          <p className="text-pretty font-display text-card-title font-medium leading-card tracking-question text-ink">
            Your first brand takes about 7 minutes. Here&rsquo;s what
            you&rsquo;ll get.
          </p>
          <p className="text-helper leading-prose text-ink-2">
            A palette, a typeface pairing, a voice guide and the copy for four
            pages — plus a prompt you paste into your website builder.
          </p>
          <StartBriefButton />
        </div>

        <div className="min-w-0 flex-1">
          {/* Maquette d'exemple, figée : c'est une illustration, pas la marque
              de quelqu'un. Ses couleurs sont les seules données de marque en
              dur de l'application (`lib/brand/sample.ts`). */}
          <BrandPreview model={SAMPLE_PREVIEW} variant="thumbnail" shape="site" />
        </div>
      </div>
    </main>
  );
}
