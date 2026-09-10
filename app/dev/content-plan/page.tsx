import { MonthPlan } from "@/components/content/month-plan";
import {
  FIXTURE_ITEMS,
  FIXTURE_LABEL,
  FIXTURE_MONTH,
} from "@/lib/content/fixtures/proposed-month";

/*
 * The review screen, on a month that does not exist.
 *
 * A development page: linked from nowhere, reading no database, calling no
 * model. It exists so the screen can be designed against twelve posts instead
 * of against an empty state — and so that when the first real month lands,
 * what changes is the words and nothing else.
 *
 * ⚠ EVERYTHING HERE IS A FIXTURE, and it says so twice: the red badge
 * `MonthPlan` draws from its `fixture` prop, and the generator label
 * `stub:no-model-key` under the heading. Neither is optional.
 */
export default function DevContentPlanPage() {
  return (
    <main className="route-enter mx-auto flex max-w-[820px] flex-col gap-10 px-[var(--gutter)] py-[var(--gutter)]">
      <MonthPlan
        record={FIXTURE_MONTH}
        items={FIXTURE_ITEMS}
        monthLabel="October 2026"
        generatedBy={FIXTURE_LABEL}
        fixture
      />
    </main>
  );
}
