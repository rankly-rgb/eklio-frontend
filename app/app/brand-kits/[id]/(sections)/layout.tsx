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
 *
 * ⚠ TWO COLUMNS, AND THE BAND IS IN THE RIGHT-HAND ONE. The band used to run
 * full width above everything, with a rule under it, and the rail started
 * below that — which made the rail look like a consequence of the header
 * rather than the page's spine. The rail now begins directly under the app
 * header, and the band is simply the main column's first row. The full-width
 * rule is gone with it: the rail's own edge is the only division at that
 * height, and a horizontal rule across the viewport would cut through it.
 */
export default async function KitSectionsLayout({
  children,
  params,
}: LayoutProps<"/app/brand-kits/[id]">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      {/*
       * `items-stretch`, so the rail's right border runs the full height of
       * the row rather than stopping where the rail's own content ends. The
       * sticky positioning lives inside <KitRail>, on a child of this
       * stretched cell.
       */}
      <div className="flex items-stretch max-[900px]:flex-col">
        <div className="w-[236px] flex-none border-r border-line pr-8 max-[900px]:w-full max-[900px]:border-r-0 max-[900px]:pr-0">
          <KitRail
            brandKitId={id}
            practiceName={model.kit.practiceName}
            directionName={model.kit.selectedDirection?.name ?? ""}
            tokens={model.tokens}
            photoUrl={model.railImageUrl}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-10 pl-8 max-[900px]:gap-8 max-[900px]:pl-0 max-[900px]:pt-6">
          <KitHeaderBand model={model} />
          {children}
        </div>
      </div>
    </main>
  );
}
