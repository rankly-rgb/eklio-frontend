import Link from "next/link";
import { soldTierName } from "@/lib/billing/tier-names";
import type { SurfaceAccess } from "@/lib/billing/surface-access";

/*
 * The refusal that is one line, not a card.
 *
 * ⚠ WHERE A CARD WOULD BE WRONG. `<TierUpgradePrompt>` stands IN PLACE of a
 * surface she cannot reach — a whole editor, a whole handoff sheet — and it
 * has the room for a tagline and a price because there is nothing else on
 * that part of the screen. This one appears BESIDE something she can reach and
 * is using: inside a Check finding she is reading, or in the asset panel under
 * a file she is about to download. A card there would shout over the thing she
 * came for, and repeated once per finding it would be a wall.
 *
 * So: one sentence, helper size, the tier name carrying the link. Nothing is
 * greyed, nothing is removed, and what she was doing keeps working.
 */
export function TierLine({
  access,
  projectId,
}: {
  access: Extract<SurfaceAccess, { reason: "payment_required" }>;
  projectId: string | null;
}) {
  const name = soldTierName(access.requiredTier);
  const href = projectId
    ? `/app/checkout?plan=${access.requiredTier}&project=${projectId}`
    : "/pricing";

  return (
    <p className="text-helper leading-prose text-ink-3">
      {`${access.label} ${access.verb} with `}
      <Link
        href={href}
        className="text-ink-2 underline decoration-line underline-offset-4 hover:text-ink hover:decoration-[var(--accent)]"
      >
        {name}
      </Link>
      .
    </p>
  );
}
