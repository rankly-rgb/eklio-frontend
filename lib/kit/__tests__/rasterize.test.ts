import { describe, expect, it } from "vitest";
import { svgToPng } from "@/lib/kit/render/rasterize";

/*
 * A real resvg call — no mocking — on a tiny, self-contained SVG (no font
 * dependency, so this test needs no network). The point is proving the
 * native binary loads and produces real PNG bytes, not testing resvg's own
 * rendering correctness.
 */
const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">
  <rect x="0" y="0" width="100" height="50" fill="#2B2A27"/>
</svg>`;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("svgToPng", () => {
  it("produces a real PNG (correct magic bytes) from a simple SVG", () => {
    const png = svgToPng(SIMPLE_SVG);
    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    expect(png.byteLength).toBeGreaterThan(0);
  });

  it("renders at the SVG's own declared dimensions (fitTo: original)", () => {
    // IHDR chunk: bytes 16-19 width, 20-23 height, big-endian, right after
    // the 8-byte signature + 4-byte length + 4-byte "IHDR" tag.
    const png = svgToPng(SIMPLE_SVG);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    expect(width).toBe(100);
    expect(height).toBe(50);
  });
});
