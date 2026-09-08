import { notFound } from "next/navigation";
import { requireKitPage } from "@/lib/data/kit-page";
import { SectionHeader } from "@/components/ui/section-header";
import { BrandPreview } from "@/components/preview/brand-preview";
import { SiteCard } from "@/components/kit/site-card";
import { previewModelFromDirection } from "@/lib/brand/shapes";

/*
 * Your site — moved whole: her brand on a page, the one-line statement of
 * what the editor is for, and the card that opens it.
 *
 * ⚠ THE EDITOR IS NOT THIS ROUTE. `/app/brand-kits/[id]/site-editor` is a
 * sibling OUTSIDE the sections group, and deliberately so: the editor's own
 * layout law is a 360px control rail beside a 900px mockup, breaking at
 * 1100px, which a 212px section rail does not survive. It kept this URL
 * before the split; the split needed `site/` for the section, so the editor
 * moved rather than being squeezed into a shell built for reading.
 */
export default async function KitSitePage({
  params,
}: PageProps<"/app/brand-kits/[id]/site">) {
  const { id } = await params;
  const model = await requireKitPage(id);
  if (!model.kit.selectedDirection) notFound();

  const preview = previewModelFromDirection(
    model.kit.selectedDirection,
    model.kit.practiceName
  );

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader title="Your site" id="kit-site-heading" />

      <div className="w-site-mock max-w-full">
        <div className="overflow-hidden rounded-card border border-line shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          <BrandPreview
            model={preview}
            size="full"
            rendering={model.kit.selectedDirection.rendering}
          />
        </div>
        <p className="mt-3 text-helper leading-prose text-ink-2">
          This is your brand on a page. Your pages, copy and builder
          instructions live in the site editor.
        </p>
      </div>

      <SiteCard
        brandKitId={id}
        model={preview}
        builderLabel={model.siteBuilderLabel}
      />
    </section>
  );
}
