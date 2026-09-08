import { MonoLabel } from "@/components/ui/mono-label";
import type { KitPage } from "@/lib/data/kit-page";

/*
 * The band above the sections — who this kit belongs to, on every section.
 *
 * ⚠ THE KIT NAME IS SET IN EKLIO'S OWN DISPLAY FACE, never in the
 * therapist's brand font. Her typography appears inside `<BrandCanvas>` and
 * in the rendered wordmark asset; this is app chrome, and app chrome that
 * borrows her face stops being a frame around her brand and starts competing
 * with it.
 */
export function KitHeaderBand({ model }: { model: KitPage }) {
  const practiceName = model.kit.practiceName ?? "Your brand";

  return (
    <div className="flex flex-col gap-6 border-b border-line pb-6">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
            {practiceName}
          </h1>
          <MonoLabel tracking="16" className="mt-2" as="p">
            {model.kit.selectedDirection?.name ?? ""}
          </MonoLabel>
        </div>
      </div>
    </div>
  );
}
