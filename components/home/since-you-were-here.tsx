import { MonoLabel } from "@/components/ui/mono-label";
import type { HomeActivity } from "@/lib/data/brand-kit";

/*
 * "Since you were here" (Lot 9) — real activity only: a new rendered asset
 * (a `brand_assets` row is a fingerprinted render; a new one appearing IS
 * the fingerprint changing), or a piece of monthly content that became
 * ready or published. Nothing shown here is invented — see DECISIONS.md
 * for what this reuses and what it deliberately doesn't.
 */
export function SinceYouWereHere({ activity }: { activity: HomeActivity }) {
  if (activity.since === null) return null;
  if (activity.newAssets.length === 0 && activity.contentReady.length === 0) return null;

  return (
    <section
      aria-labelledby="since-you-were-here"
      className="mt-7 flex flex-col gap-3 rounded-card border border-line p-[18px_20px]"
    >
      <MonoLabel tracking="16" as="h2" id="since-you-were-here">
        Since you were here
      </MonoLabel>
      <ul className="flex flex-col gap-2">
        {activity.newAssets.map((asset) => (
          <li key={`asset-${asset.key}`} className="text-ui leading-body text-ink">
            {`${asset.label} updated.`}
          </li>
        ))}
        {activity.contentReady.map((item) => (
          <li key={`content-${item.type}-${item.dayOfMonth}`} className="text-ui leading-body text-ink">
            {`Your ${item.type} for the ${ordinal(item.dayOfMonth)} is ready — "${item.title}."`}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ordinal(day: number): string {
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}
