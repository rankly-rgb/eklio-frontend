import { requireKitPage } from "@/lib/data/kit-page";
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
