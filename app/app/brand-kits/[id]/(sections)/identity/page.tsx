import { requireKitPage } from "@/lib/data/kit-page";
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
