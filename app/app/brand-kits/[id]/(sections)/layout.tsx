import { requireKitPage } from "@/lib/data/kit-page";
import { KitHeaderBand } from "@/components/kit/kit-header-band";
import { KitRail } from "@/components/kit/kit-rail";

/*
 * The brand kit's shell — the header band and the section rail, around one
 * section at a time.
 *
 * ⚠ WHY A ROUTE GROUP. `(sections)` adds nothing to the URL: `page.tsx` here
 * is still `/app/brand-kits/[id]`, `colors/` is still
 * `/app/brand-kits/[id]/colors`. It exists so this layout wraps the SECTIONS
 * and nothing else — `reveal/`, `delivered/`, `handoff/`, `uploads/` and the
 * site editor are siblings outside the group, and each has its own reason not
 * to carry a paid-kit rail (the reveal is pre-purchase; the editor's own
 * layout law is 360 + 900 + gutters and does not survive one).
 *
 * `requireKitPage` is `React.cache`d, so the band's read and the section's
 * read are the same read. This layout does NOT re-render when she moves
 * between sections — that is the whole point of putting it here rather than
 * repeating it in seven pages.
 */
export default async function KitSectionsLayout({
  children,
  params,
}: LayoutProps<"/app/brand-kits/[id]">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <KitHeaderBand model={model} />

      <div className="mt-8 flex items-start gap-10 max-[900px]:mt-6 max-[900px]:flex-col max-[900px]:gap-5">
        <div className="sticky top-6 flex w-[212px] flex-none flex-col gap-6 self-start max-[900px]:static max-[900px]:w-full">
          <KitRail brandKitId={id} />
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
