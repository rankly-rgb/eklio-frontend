import { Resvg } from "@resvg/resvg-js";

/*
 * SVG → PNG, the one place `@resvg/resvg-js` (a native binary) is touched.
 * satori's own SVG output is already fully vectorized — glyphs come out as
 * `<path>` outlines, not `<text>` elements referencing a font — so resvg
 * needs no font files here; it only rasterizes shapes already on the page.
 *
 * ── THE TRIM RULE FOR EVERY IDENTITY ASSET IN THE CATALOGUE ──────────────
 * Every identity asset is trimmed to its ink bounds with zero padding —
 * that's what makes a wordmark file droppable into a Squarespace header
 * without cropping first. Clear space is a rule for the brand guide (Lot 5,
 * expressed in monogram-widths), never baked pixels here. The one exception
 * is a mark deliberately inset in a fixed square — `avatar_400`, the
 * favicons — which call `svgToPng` (untrimmed, exact declared dimensions)
 * instead of `trimToInk`.
 */

/**
 * Renders at exactly the SVG's own declared width/height, no trim, no
 * scaling. For the fixed-square exceptions to the trim rule above.
 */
export function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  return resvg.render().asPng();
}

/**
 * Rasterizes an SVG at a specific target width, aspect ratio preserved —
 * for a mark that ships in more than one pixel size from the same trimmed
 * vector (e.g. `wordmark_png_light` at 1200px and 2400px). satori's SVG
 * output is fully vectorized (glyphs as `<path>`, no font dependency at
 * this stage — see the header above), so re-rasterizing the same trimmed
 * SVG at a different width costs nothing but this one resvg pass and stays
 * pixel-faithful to the vector, unlike scaling a PNG after the fact.
 */
export function svgToPngAtWidth(svg: string, width: number): Buffer {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return resvg.render().asPng();
}

export type TrimmedRender = {
  svg: string;
  png: Buffer;
  width: number;
  height: number;
};

/**
 * Crops to the visible ink's bounding box — verified directly (not assumed
 * from the docs' description): `cropByBBox` re-windows the SVG's viewBox to
 * the bbox's own origin and extent rather than repositioning elements, so a
 * bbox that doesn't start at (0,0) still crops correctly. One `Resvg`
 * instance produces both outputs so the PNG and the (also-trimmed) SVG stay
 * pixel-consistent with each other.
 *
 * A mark with no visible ink at all (`innerBBox()` returns `undefined` —
 * ink-less input, not expected in practice) renders untrimmed rather than
 * throwing: a full-canvas asset is a better failure than none.
 */
export function trimToInk(svg: string): TrimmedRender {
  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  const bbox = resvg.innerBBox();
  if (bbox) {
    resvg.cropByBBox(bbox);
  }
  const rendered = resvg.render();
  return {
    svg: resvg.toString(),
    png: rendered.asPng(),
    width: rendered.width,
    height: rendered.height,
  };
}
