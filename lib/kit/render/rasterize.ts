import { Resvg } from "@resvg/resvg-js";

/*
 * SVG → PNG, the one place `@resvg/resvg-js` (a native binary) is touched.
 * satori's own SVG output is already fully vectorized — glyphs come out as
 * `<path>` outlines, not `<text>` elements referencing a font — so resvg
 * needs no font files here; it only rasterizes shapes already on the page.
 *
 * No scaling decision is made here: `fitTo: { mode: "original" }` renders
 * at exactly the SVG's own declared width/height. A retina/2x variant is a
 * deliberate choice for whoever extends the catalogue, not implied by this
 * first PNG.
 */
export function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  const rendered = resvg.render();
  return rendered.asPng();
}
