import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";

/*
 * ── SVG → PNG, AND THE ONE DIFFERENCE FROM `lib/kit/render/rasterize.ts` ─
 *
 * That module rasterizes satori's output, and satori emits glyphs as `<path>`
 * outlines — so resvg needs no fonts at all there, and its header says so.
 *
 * This engine emits `<text>`. It has to: the collision suite measures glyph
 * BOXES, and a box is only knowable while the text is still text. Once it is a
 * path it is ink, and ink bounds move with the string — which would make every
 * clearance a statement about one particular caption.
 *
 * So resvg gets the fonts here.
 *
 * ⚠ AS FILES, BECAUSE `@resvg/resvg-js@2.6.2` TAKES PATHS AND NOT BUFFERS.
 * Checked against the installed `index.d.ts` rather than assumed: the options
 * are `fontFiles`, `fontDirs`, `loadSystemFonts` — there is no `fontBuffers` on
 * this version. The bytes come from the same `fonts` bucket the identity assets
 * already fill; they are written once per process into a temp directory and the
 * paths are reused.
 *
 * ── ⚠ WHY THIS FILE IS HERE AND NOT UNDER `lib/compose/` ────────────────
 *
 * `app/__tests__/renderer-not-in-client-bundle.test.ts` asserts that satori,
 * `@resvg/resvg-js` and sharp are imported from `lib/kit/render/` and from
 * nowhere else. A native binary reached from a client bundle is a build
 * failure, not bloat, and a directory rule is the only version of that
 * guarantee a static scan can actually check.
 *
 * The first draft of this module lived in `lib/compose/` and that test caught
 * it. Widening the rule to admit a second directory would have worked and
 * would have been the wrong trade: the rule is worth more than the tidiness of
 * keeping the engine's files together.
 *
 * It also leaves `lib/compose/` entirely free of native packages — which is
 * not a side effect. It is why the four suites run offline, with no stub, and
 * therefore why they measure the engine rather than a mock of it.
 */

/** The three families the composition engine sets, and nothing else. */
export const COMPOSE_FAMILIES = ["Fraunces", "Karla", "IBM Plex Mono"] as const;

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600" +
  "&family=Karla:wght@400..600&family=IBM+Plex+Mono:wght@400;500&display=swap";

let cachedPaths: string[] | null = null;

/**
 * The three font files on disk, fetched once per process.
 *
 * ⚠ A MISSING FONT IS AN ERROR, NOT A FALLBACK. With `loadSystemFonts: false`
 * and no files, resvg renders the text as nothing at all; with system fonts on,
 * it renders it in whatever the container happens to have. Both produce a card
 * whose clearances were proved about a different document, and only one of them
 * is visibly broken. Failing here is the only honest outcome.
 */
export async function composeFontFiles(): Promise<string[]> {
  if (cachedPaths) return cachedPaths;

  const dir = join(tmpdir(), "eklio-compose-fonts");
  mkdirSync(dir, { recursive: true });

  const paths = await Promise.all(
    COMPOSE_FAMILIES.map(async (family) => {
      const bytes = await getCachedFontBuffer(family, GOOGLE_FONTS_URL);
      if (!bytes || bytes.byteLength === 0) {
        throw new Error(
          `compose: no font bytes for "${family}". The composition engine measured against this ` +
            `family's metrics; rasterizing without it would produce a card whose clearances were ` +
            `proved about a different document.`
        );
      }
      const path = join(dir, `${family.replace(/\s+/g, "-").toLowerCase()}.ttf`);
      writeFileSync(path, Buffer.from(bytes));
      return path;
    })
  );

  cachedPaths = paths;
  return paths;
}

/** The composed SVG, at its declared size, as PNG bytes. */
export function composeToPng(svg: string, fontFiles: string[]): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      // ⚠ NO SYSTEM FONTS. The container's font set is not part of this
      // contract, and letting it in makes the output depend on the machine —
      // which would also break the byte-for-byte determinism the render cache
      // is keyed on.
      loadSystemFonts: false,
      fontFiles,
      defaultFontFamily: "Karla",
    },
  });
  return resvg.render().asPng();
}
