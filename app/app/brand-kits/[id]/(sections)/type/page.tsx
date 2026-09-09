import { notFound } from "next/navigation";
import { requireKitPage } from "@/lib/data/kit-page";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { TierGate } from "@/components/billing/tier-gate";
import { SectionHeader } from "@/components/ui/section-header";
import { TypeSection } from "@/components/kit/type-section";

/*
 * Type — moved whole. `requireKitPage` has already redirected a kit with no
 * chosen direction to the reveal, so the guard below is a type narrowing
 * rather than a second decision.
 */
export default async function KitTypePage({
  params,
}: PageProps<"/app/brand-kits/[id]/type">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  /*
   * ⚠ EVERY SURFACE CONSULTS THE GUARD, INCLUDING THE ONES THAT ALWAYS
   * PASS. This one is `starter`, so today it cannot refuse — and that is
   * exactly why the line is here. A surface that consults nothing is the
   * one nobody remembers when a row in `SURFACE_MIN_TIER` moves.
   */
  const gate = surfaceAccess("kit_type", model.entitledTier);
  if (!gate.ok) return <TierGate access={gate} projectId={model.kit.projectId} />;
  if (!model.kit.selectedDirection) notFound();

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="Type" id="kit-type-heading" />
      <TypeSection direction={model.kit.selectedDirection} tokens={model.tokens} />
    </section>
  );
}
