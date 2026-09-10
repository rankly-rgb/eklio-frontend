import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import {
  checkinAnswered,
  contentMonthKey,
  getContentCheckin,
  getContentMonth,
} from "@/lib/data/content";
import { ContentCalendar } from "@/components/content/content-calendar";
import { CheckInCard } from "@/components/content/check-in-card";
import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";

/*
 * /app/content — the month, as a calendar she writes in.
 *
 * LOT 6 replaces the sixteen-tile grid this page used to render. That grid
 * came from `monthly_presence_content`, one row per generated slot, which the
 * client could not write to at all. These are her own rows in `content_items`.
 *
 * The gate is the KIT's entitlement, not a Monthly Presence subscription:
 * planning her own posts is part of the brand she bought. Monthly Presence is
 * about content generated FOR her, which this lot does not build.
 */
export default async function ContentPage({ searchParams }: PageProps<"/app/content">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/content");

  const home = await loadHome(supabase, user.id);
  const kit = home.brandKit;

  if (!kit) {
    return (
      <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)]">
        <div className="mt-8 flex max-w-[520px] flex-col gap-5 rounded-card border border-line p-8">
          <MonoLabel tracking="16">Content</MonoLabel>
          <p className="text-helper leading-prose text-ink-2">
            Content follows your brand. Finish your brief and choose a direction first.
          </p>
          <ButtonLink href="/app" variant="secondary" className="self-start">
            Back home
          </ButtonLink>
        </div>
      </main>
    );
  }

  const brandKitId = kit.row.id;
  if (!(await isBrandKitEntitled(supabase, brandKitId))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const requested = (await searchParams).month;
  const raw = Array.isArray(requested) ? requested[0] : requested;
  const month = raw && /^\d{4}-\d{2}-01$/.test(raw) ? raw : contentMonthKey(new Date());

  const [result, checkin] = await Promise.all([
    getContentMonth(supabase, brandKitId, month),
    getContentCheckin(supabase, brandKitId, month),
  ]);

  /*
   * ⚠ AT THE TOP UNTIL ANSWERED, AND NOT ONE VISIT LONGER. `checkinAnswered`
   * treats `taking_clients` as the one answer that counts, because it is the
   * only field that changes what may be generated. Once she has answered it
   * the card comes down, even with the two optional fields blank — a card that
   * stayed up for an optional question would be asking for more than sixty
   * seconds.
   */
  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-8 max-md:px-[var(--gutter-sm)]">
      {checkinAnswered(checkin) ? null : (
        <div className="mb-8 max-w-[720px]">
          <CheckInCard
            brandKitId={brandKitId}
            month={month}
            monthLabel={monthLabel}
            initial={checkin}
          />
        </div>
      )}

      {result.ok ? (
        <ContentCalendar brandKitId={brandKitId} month={month} model={result.data} />
      ) : (
        <p className="text-body text-ink-2">{result.message}</p>
      )}
    </main>
  );
}
