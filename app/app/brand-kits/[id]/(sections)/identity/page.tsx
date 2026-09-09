import { requireKitPage } from "@/lib/data/kit-page";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { TierGate } from "@/components/billing/tier-gate";
import { SectionHeader } from "@/components/ui/section-header";
import { IdentitySection } from "@/components/kit/identity-section";

/*
 * Identity — moved whole from the scrolling page. The section's own content
 * is untouched; what changed is that it now fills the column instead of
 * being the first of six things to scroll past.
 *
 * The guard is `requireKitPage`, which answers 404 before it answers
 * payment_required and redirects to the checkout when she has not paid.
 */
export default async function KitIdentityPage({
  params,
}: PageProps<"/app/brand-kits/[id]/identity">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  /*
   * ⚠ EVERY SURFACE CONSULTS THE GUARD, INCLUDING THE ONES THAT ALWAYS
   * PASS. This one is `starter`, so today it cannot refuse — and that is
   * exactly why the line is here. A surface that consults nothing is the
   * one nobody remembers when a row in `SURFACE_MIN_TIER` moves.
   */
  const gate = surfaceAccess("kit_identity", model.entitledTier);
  if (!gate.ok) return <TierGate access={gate} projectId={model.kit.projectId} />;

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="Identity" id="kit-identity-heading" />
      <IdentitySection
        brandKitId={id}
        practiceName={model.kit.practiceName}
        tokens={model.tokens}
      />
    </section>
  );
}
