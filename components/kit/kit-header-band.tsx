import { MonoLabel } from "@/components/ui/mono-label";
import { DownloadGlyph, StatGlyph } from "@/components/ui/glyphs";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import { KitMenu } from "@/components/kit/kit-menu";
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
 * The kit's header band — the first row of the MAIN COLUMN, beside the rail
 * rather than above it. There is no full-width rule under it: the rail's own
 * edge is the only vertical division at this height, and a horizontal one
 * across the whole viewport would cut the rail in half.
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

  /*
   * ⚠ ONE STRIP, THREE CELLS, AND THEY ARE DATA.
   *
   * They were three separate bordered cards, which read as three unrelated
   * facts rather than one line of state. Writing them as an array and
   * mapping once is not a style preference: it is what makes "three
   * siblings" impossible to reintroduce by accident, and
   * `kit-band-counts.test.ts` asserts against this array rather than against
   * the markup.
   *
   * Every value is a `select` away from a stored row — never a constant,
   * never a length of a hard-coded list. `Asset categories` had exactly that
   * bug in the library this replaces (`GROUP_ORDER.length`, a flat six,
   * whatever the kit contained).
   *
   * ⚠ THERE IS NO FOURTH CELL. `brand_assets.download_count` is an integer on
   * the asset row, and the row is keyed by fingerprint — the moment she
   * changes a colour the old rows stop being current and any lifetime total
   * silently falls back to zero. A count that resets when she edits her
   * palette is not one this product can honestly show.
   *
   * ⚠ `Assets ready`, not `Total assets`. The library one section over opens
   * on `All assets (N)`, which counts every key in the catalogue including
   * the never-rendered and the stale. The two differ on any kit with either,
   * and `Total` beside `All` gave the reader no way to tell which one
   * excluded something.
   */
  const cells = [
    { id: "ready", glyph: "files", label: "Assets ready", value: stats ? stats.currentCount : "—" },
    { id: "categories", glyph: "categories", label: "Asset categories", value: stats ? stats.categoryCount : "—" },
    { id: "updated", glyph: "clock", label: "Last updated", value: stats ? formatDate(stats.lastUpdated) : "—" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* ── The title row ────────────────────────────────────────────────
       *
       * Title, then the explainer, then the action. The sentence used to sit
       * under the button in two right-aligned lines, where it read as a
       * caption FOR the button rather than a description of what the button
       * hands over. It belongs on this row, in Eklio's display face, italic —
       * a voice, not a label. Below 1100px it may wrap onto a second line;
       * it never goes back under the button.
       */}
      <div className="flex items-center gap-8 max-[1100px]:gap-5 max-md:flex-col max-md:items-start max-md:gap-4">
        <div className="min-w-0 flex-none">
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
            {model.kit.practiceName ?? "Your brand"}
          </h1>
          <MonoLabel tracking="16" className="mt-2" as="p">
            {model.kit.selectedDirection?.name ?? ""}
          </MonoLabel>
        </div>

        {/*
         * Verified against the renderer, not assumed:
         * `lib/kit/render/registry.ts` pushes `README.txt` into
         * `brand_kit_zip`'s entries alongside every other file. The sentence
         * and the archive agree.
         */}
        <p className="min-w-0 flex-1 font-display text-helper italic leading-prose text-ink-2 max-md:w-full">
          Everything, zipped — every file in your brand kit, in one download,
          with a README.
        </p>

        <div className="flex flex-none items-center gap-3 max-md:w-full">
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

          <KitMenu
            brandKitId={model.brandKitId}
            projectId={model.kit.projectId}
            compAccess={model.compAccess}
          />
        </div>
      </div>

      {/* ── The counts, as one strip ─────────────────────────────────────── */}
      <div className="flex overflow-hidden rounded-card border border-line max-md:flex-col">
        {cells.map((cell, index) => (
          <div
            key={cell.id}
            className={`flex min-w-0 flex-1 items-start gap-3 p-4 ${
              index > 0 ? "border-l border-line max-md:border-l-0 max-md:border-t" : ""
            }`}
          >
            <span className="mt-0.5 text-ink-3">
              <StatGlyph stat={cell.glyph} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <MonoLabel tracking="10">{cell.label}</MonoLabel>
              <span className="truncate text-body text-ink">{cell.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
