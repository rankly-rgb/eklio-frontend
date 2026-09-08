import { MonoLabel } from "@/components/ui/mono-label";
import { DownloadGlyph } from "@/components/ui/glyphs";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import { KitMenu } from "@/components/kit/kit-menu";
import { StateTile } from "@/components/kit/state-tile";
import type { KitPage } from "@/lib/data/kit-page";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/*
 * The band above the sections — who this kit belongs to, what she can take
 * away with her, and the state of it. True on every section, so it lives in
 * the layout rather than on one of them.
 *
 * ⚠ THE KIT NAME IS SET IN EKLIO'S OWN DISPLAY FACE, never in the
 * therapist's brand font. Her typography appears inside `<BrandCanvas>` and
 * in the rendered wordmark asset; this is app chrome, and app chrome that
 * borrows her face stops being a frame around her brand and starts competing
 * with it.
 *
 * ⚠ `Download everything` IS IN EKLIO'S INK, not her primary colour. Her
 * colour is allowed on exactly one app-level element per screen, and that
 * one is the primary action of the section on show — the Overview's `Edit
 * your site`, for instance. This button is on every screen, so it cannot be
 * the one.
 *
 * NO APHORISM IN THE STRIP. A line like "consistent brands create freer
 * futures" placed among her own numbers reads as her practice making an
 * outcome claim. Eklio's voice belongs in Eklio's own card, in the rail.
 */
export function KitHeaderBand({ model }: { model: KitPage }) {
  const stats = model.assetStats;
  const hasZip = stats?.manifest.some((entry) => entry.key === "brand_kit_zip") ?? false;

  return (
    <div className="flex flex-col gap-6 border-b border-line pb-6">
      <div className="flex items-start justify-between gap-8 max-lg:flex-col max-lg:gap-5">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
            {model.kit.practiceName ?? "Your brand"}
          </h1>
          <MonoLabel tracking="16" className="mt-2" as="p">
            {model.kit.selectedDirection?.name ?? ""}
          </MonoLabel>
        </div>

        <div className="flex flex-none items-start gap-4 max-lg:w-full">
          <div className="flex min-w-0 flex-col items-end gap-2 max-lg:items-start">
            {hasZip ? (
              <AssetDownloadButton
                brandKitId={model.brandKitId}
                assetKey="brand_kit_zip"
                className="inline-flex h-11 items-center gap-2.5 rounded-pill bg-ink px-[30px] text-ui font-semibold text-bg hover:bg-ink-2"
              >
                <DownloadGlyph color="var(--bg)" />
                Download everything
              </AssetDownloadButton>
            ) : null}
            {/*
             * Verified against the renderer, not assumed:
             * `lib/kit/render/registry.ts` pushes `README.txt` into
             * `brand_kit_zip`'s entries alongside every other file. The
             * sentence and the archive agree.
             */}
            <p className="max-w-[340px] text-right text-helper leading-prose text-ink-2 max-lg:text-left">
              Everything, zipped — every file in your brand kit, in one
              download, with a README.
            </p>
          </div>

          <KitMenu
            brandKitId={model.brandKitId}
            projectId={model.kit.projectId}
            compAccess={model.compAccess}
          />
        </div>
      </div>

      {/*
       * Three counts, and every one of them is a `select` away from a stored
       * row: how many assets are rendered and current at her fingerprint,
       * how many distinct groups those same rows fall into, and the newest
       * of their timestamps. There is no fourth.
       *
       * ⚠ `Assets ready`, not `Total assets`. The library one section over
       * opens on `All assets (N)`, which counts every key in the catalogue —
       * including keys never rendered and keys gone stale, because the grid
       * shows those too, with a status chip. The two numbers differ on any
       * kit that has either, and `Total` beside `All` gave the reader no way
       * to tell which one excluded something. `ready` names the exclusion.
       *
       * ⚠ THERE IS NO `TOTAL DOWNLOADS` TILE, and the reason is not that the
       * number is hard to get. `brand_assets.download_count` is an integer
       * on the asset row, incremented when a signed URL is issued — and the
       * row is keyed by fingerprint, so the moment she changes a colour the
       * old rows stop being current and the total silently falls back to
       * zero. A lifetime count that resets when she edits her palette is a
       * number this product cannot honestly show.
       */}
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <StateTile label="Assets ready">{stats ? stats.currentCount : "—"}</StateTile>
        <StateTile label="Asset categories">{stats ? stats.categoryCount : "—"}</StateTile>
        <StateTile label="Last updated">{stats ? formatDate(stats.lastUpdated) : "—"}</StateTile>
      </div>
    </div>
  );
}
