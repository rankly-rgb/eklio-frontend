import { notFound } from "next/navigation";
import { TierUpgradePrompt } from "@/components/billing/tier-upgrade-prompt";
import type { SurfaceAccess } from "@/lib/billing/surface-access";

/*
 * What a page renders instead of a surface she is not entitled to.
 *
 * One component so nineteen call sites are one line each and identical:
 *
 *     const gate = surfaceAccess("kit_colors", model.entitledTier);
 *     if (!gate.ok) return <TierGate access={gate} projectId={…} />;
 *
 * ⚠ IT HANDLES BOTH REFUSALS, and they are not the same refusal.
 * `not_found` means the surface name is not a surface — a caller's bug, or a
 * route param that reached the guard — and it answers 404, never "upgrade",
 * because telling a stranger that a thing exists is the leak the guard's own
 * ordering exists to prevent. `payment_required` is the one a customer is
 * meant to see, and it gets the card.
 */
export function TierGate({
  access,
  projectId,
}: {
  access: Extract<SurfaceAccess, { ok: false }>;
  projectId: string | null;
}) {
  if (access.reason === "not_found") notFound();
  return <TierUpgradePrompt access={access} projectId={projectId} />;
}
