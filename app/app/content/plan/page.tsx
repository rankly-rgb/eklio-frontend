import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import {
  contentMonthKey,
  getContentMonth,
  getContentMonthRecord,
} from "@/lib/data/content";
import { MonthPlan } from "@/components/content/month-plan";
import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";

/*
 * /app/content/plan — the month Eklio wrote, reviewed and taken in one gesture.
 *
 * Separate from `/app/content`, which is the calendar she writes in. Two
 * different jobs: the calendar is a working surface she returns to all month;
 * this is a reading surface she visits once, when a month arrives.
 *
 * ⚠ IT DOES NOT GENERATE. Visiting this page costs nothing and calls no model.
 * Generation is a scheduled job (Session 5) and a purchase-time job; a review
 * screen that generated on visit would bill her for reloading a page.
 */
export default async function ContentPlanPage({
  searchParams,
}: PageProps<"/app/content/plan">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/content/plan");

  const home = await loadHome(supabase, user.id);
  const kit = home.brandKit;
  if (!kit) redirect("/app/content");

  const brandKitId = kit.row.id;
  if (!(await isBrandKitEntitled(supabase, brandKitId))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const requested = (await searchParams).month;
  const raw = Array.isArray(requested) ? requested[0] : requested;
  const month = raw && /^\d{4}-\d{2}-01$/.test(raw) ? raw : contentMonthKey(new Date());

  const [record, result] = await Promise.all([
    getContentMonthRecord(supabase, brandKitId, month),
    getContentMonth(supabase, brandKitId, month),
  ]);

  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  /*
   * ⚠ "NO MONTH" IS NOT "AN EMPTY MONTH". Every kit in production is in this
   * state today, and rendering three empty theme headings would say Eklio
   * tried and had nothing to say. It says what is true instead.
   */
  if (!record) {
    return (
      <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-8 max-md:px-[var(--gutter-sm)]">
        <div className="flex max-w-[520px] flex-col gap-5 rounded-card border border-line p-8">
          <MonoLabel tracking="16">{monthLabel}</MonoLabel>
          <p className="text-helper leading-prose text-ink-2">
            Eklio has not written this month yet. When it does, everything it
            wrote will be here in one place, and taking it is one press.
          </p>
          <ButtonLink href="/app/content" variant="secondary" className="self-start">
            Your calendar
          </ButtonLink>
        </div>
      </main>
    );
  }

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-8 max-md:px-[var(--gutter-sm)]">
      <div className="max-w-[820px]">
        {result.ok ? (
          <MonthPlan
            record={record}
            /*
             * Both lists: a proposal she has dragged out of the month is still
             * part of the plan she is approving, and `approve_content_month`
             * moves it by `month_id` rather than by date for exactly that
             * reason. Filtering to dated items here would show her less than
             * the button changes.
             */
            items={[...result.data.items, ...result.data.unscheduled].filter(
              (item) => item.month_id === record.id
            )}
            monthLabel={monthLabel}
            generatedBy={null}
          />
        ) : (
          <p className="text-body text-ink-2">{result.message}</p>
        )}
      </div>
    </main>
  );
}
