import { requireKitPage } from "@/lib/data/kit-page";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { TierGate } from "@/components/billing/tier-gate";
import { SectionHeader } from "@/components/ui/section-header";
import { ColorsSection } from "@/components/kit/colors-section";

/*
 * Colors — moved whole. The six roles, the named labels and the contrast
 * report are settled; this route relocates them, it does not restate them.
 */
export default async function KitColorsPage({
  params,
}: PageProps<"/app/brand-kits/[id]/colors">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  /*
   * ⚠ EVERY SURFACE CONSULTS THE GUARD, INCLUDING THE ONES THAT ALWAYS
   * PASS. This one is `starter`, so today it cannot refuse — and that is
   * exactly why the line is here. A surface that consults nothing is the
   * one nobody remembers when a row in `SURFACE_MIN_TIER` moves.
   */
  const gate = surfaceAccess("kit_colors", model.entitledTier);
  if (!gate.ok) return <TierGate access={gate} projectId={model.kit.projectId} />;

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="Colors" id="kit-colors-heading" />
      <ColorsSection
        brandKitId={id}
        initialTokens={model.tokens}
        initialContrast={model.contrast}
        colorLabels={model.colorLabels}
      />
    </section>
  );
}
