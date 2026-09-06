import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { BrandPreview } from "@/components/preview/brand-preview";
import { PracticeHeader } from "@/components/home/practice-header";
import { BrandCanvas } from "@/components/home/brand-canvas";
import { NextCard } from "@/components/home/next-card";
import { WeekStrip } from "@/components/home/week-strip";
import { LaunchRingCard } from "@/components/home/launch-ring-card";
import { MonthlyPresenceCard } from "@/components/home/monthly-presence-card";
import { SinceYouWereHere } from "@/components/home/since-you-were-here";
import { RecentlyDeletedSection } from "@/components/home/recently-deleted-section";
import { StartBriefButton } from "@/components/brief/start-brief-button";
import { SAMPLE_PREVIEW } from "@/lib/brand/sample";
import type { HomeCanvas, HomeModel } from "@/lib/data/home";
import { greeting, homeAsOfDate, homeHeaderDate } from "@/lib/data/home";

/*
 * The home screen — "your practice this week."
 *
 * Replaces the greeting-as-hero, the static "Your brand" thumbnail, and the
 * always-on nudge banner with six pieces built from data that already
 * exists: the header (date + practice name), her real site hero rendered at
 * full fidelity with her generated photograph, one rule-chosen next action,
 * a week glance, "since you were here" from her notifications, and the
 * launch ring / Monthly Presence swap.
 *
 * A kit whose direction isn't chosen yet has none of that to render (no site,
 * no checklist, no month), so it keeps the earlier, simpler prompt below --
 * unchanged in spirit from before this rewrite, just under the same header.
 */
export function HomeView({ home, canvas }: { home: HomeModel; canvas: HomeCanvas | null }) {
  const kit = home.brandKit;

  if (!home.projectId) return <EmptyHome />;

  const now = new Date();
  const dateLabel = homeHeaderDate(now);
  const practiceName = kit?.practiceName ?? "Your practice";

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)] max-md:pt-10">
      <PracticeHeader dateLabel={dateLabel} practiceName={practiceName} />

      {kit && canvas ? (
        <>
          <div className="mt-6">
            <BrandCanvas
              practiceName={kit.practiceName}
              tokens={canvas.tokens}
              hero={canvas.hero}
              photoUrl={canvas.heroPhotoUrl}
              pages={canvas.pages}
            />
          </div>
          <MonoLabel tracking="14" tone="ink-3" className="mt-2.5 block">
            {`${practiceName} · ${kit.selectedDirection?.name ?? ""} · AS OF ${homeAsOfDate(now)}`}
          </MonoLabel>

          <div className="mt-6 grid grid-cols-[2fr_1fr] gap-6 max-lg:grid-cols-1">
            <div className="flex flex-col">
              <NextCard
                brandKitId={kit.row.id}
                next={canvas.next}
                primaryColor={canvas.tokens.primary}
                ctaInk={canvas.tokens.cta_ink}
              />
              <WeekStrip days={canvas.week} primaryColor={canvas.tokens.primary} />
            </div>

            {home.checklist.total > 0 ? (
              home.checklist.resolvedCount === home.checklist.total ? (
                <div className="flex flex-col gap-5">
                  <p className="text-ui leading-body text-ink">
                    Your brand is live in seven places.
                  </p>
                  <MonthlyPresenceCard
                    month={home.month}
                    entitled={home.entitled}
                    monthLabel={home.monthLabel}
                  />
                </div>
              ) : (
                <LaunchRingCard progress={home.checklist} />
              )
            ) : null}
          </div>

          <SinceYouWereHere rows={canvas.since} />
        </>
      ) : (
        <StartingOut home={home} />
      )}

      <RecentlyDeletedSection kits={home.deletedKits} />
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
