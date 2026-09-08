import { notFound } from "next/navigation";
import { requireKitPage } from "@/lib/data/kit-page";
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
  if (!model.kit.selectedDirection) notFound();

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="Type" id="kit-type-heading" />
      <TypeSection direction={model.kit.selectedDirection} tokens={model.tokens} />
    </section>
  );
}
