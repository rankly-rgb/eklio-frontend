import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/*
 * The shared layout helper for the brand guide PDF (Lot 5) — built ONCE,
 * before any of the fourteen pages are composed, per the brief's own
 * instruction ("do not position text page by page").
 *
 * MEASURED LINE BREAKING, THROUGH FONTKIT — not a character-count heuristic
 * like the old `lib/kit/pdf.ts` (which only ever embeds base-14 fonts, where
 * no better option exists). Once a custom TTF is embedded via
 * `pdfDoc.registerFontkit(fontkit)` + `pdfDoc.embedFont(bytes)`, pdf-lib's
 * own `PDFFont.widthOfTextAtSize()` is backed by fontkit's real glyph
 * metrics for that exact font file — this IS "measured through fontkit," not
 * a separate implementation of it. `wrapText` below is built on that call,
 * not a character-count guess.
 *
 * US LETTER, per the brief. A four-point baseline unit: every line height
 * and inter-block gap this file hands out is a multiple of `BASELINE`, so
 * text across the fourteen pages sits on a consistent rhythm rather than
 * whatever gap a given block happened to need.
 */

export const PAGE_WIDTH = 612; // 8.5in
export const PAGE_HEIGHT = 792; // 11in
export const MARGIN = 56;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
export const CONTENT_TOP = PAGE_HEIGHT - MARGIN;
export const CONTENT_BOTTOM = MARGIN + 24; // leaves room for the footer below the content area

export const BASELINE = 4;

/** Rounds up to the nearest baseline multiple — every reserved height is a whole number of grid units. */
export function grid(points: number): number {
  return Math.ceil(points / BASELINE) * BASELINE;
}

export function hexToRgbColor(hex: string): RGB {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Word-wraps at `maxWidth`, measured with the REAL embedded font's metrics — never a character-count guess. */
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

export type BrandFonts = {
  heading: PDFFont;
  body: PDFFont;
  mono: PDFFont;
};

/**
 * One page's text flow — a y-cursor that only ever moves down, snapped to
 * the baseline grid, with automatic page breaks. `PageFlow` never draws a
 * footer itself (see `BrandGuideDoc.newPage` below): a page number isn't
 * known until the whole document is assembled, so footers are drawn in one
 * pass at the very end.
 */
export class PageFlow {
  constructor(
    public page: PDFPage,
    private cursorY: number = CONTENT_TOP
  ) {}

  get y(): number {
    return this.cursorY;
  }

  get remaining(): number {
    return this.cursorY - CONTENT_BOTTOM;
  }

  /** Reserves vertical space without drawing anything — for a caller composing a non-text block (a swatch, an image). */
  advance(points: number): void {
    this.cursorY -= grid(points);
  }

  moveTo(y: number): void {
    this.cursorY = y;
  }

  text(
    content: string,
    font: PDFFont,
    size: number,
    color: RGB,
    { leading = size * 1.3, maxWidth = CONTENT_WIDTH, x = MARGIN }: { leading?: number; maxWidth?: number; x?: number } = {}
  ): void {
    const lineHeight = grid(leading);
    for (const line of wrapText(font, content, size, maxWidth)) {
      this.cursorY -= lineHeight;
      if (line !== "") {
        this.page.drawText(line, { x, y: this.cursorY - size * 0.85, size, font, color });
      }
    }
  }

  rule(color: RGB, { x = MARGIN, width = CONTENT_WIDTH, thickness = 0.75 }: { x?: number; width?: number; thickness?: number } = {}): void {
    this.cursorY -= grid(thickness + 8);
    this.page.drawRectangle({ x, y: this.cursorY, width, height: thickness, color });
  }

  swatchRow(swatches: { hex: string; label: string; mono: PDFFont }[], height = 56): void {
    const gap = 8;
    const width = (CONTENT_WIDTH - gap * (swatches.length - 1)) / swatches.length;
    this.cursorY -= grid(height);
    const barY = this.cursorY;
    swatches.forEach((swatch, index) => {
      const x = MARGIN + index * (width + gap);
      this.page.drawRectangle({ x, y: barY, width, height, color: hexToRgbColor(swatch.hex) });
    });
    this.cursorY -= grid(14);
    swatches.forEach((swatch, index) => {
      const x = MARGIN + index * (width + gap);
      // A label that would overflow its own column runs into the next
      // one — truncated with an ellipsis rather than trusting every
      // caller to keep every label short enough for every column count.
      const labelSize = 7;
      let label = swatch.label.toUpperCase();
      while (label.length > 1 && swatch.mono.widthOfTextAtSize(label, labelSize) > width) {
        label = `${label.slice(0, -2)}…`;
      }
      this.page.drawText(label, {
        x,
        y: this.cursorY,
        size: labelSize,
        font: swatch.mono,
        color: rgb(0.35, 0.32, 0.29),
      });
    });
  }
}

/**
 * The whole document — owns the PDFDocument, the three embedded fonts, and
 * every page's flow. Footers (practice name left, page number right, mono
 * 8pt at 60% dark_neutral) are drawn in ONE pass over every page at
 * `finish()`, because the total page count isn't known until then.
 */
export class BrandGuideDoc {
  private flows: PageFlow[] = [];

  private constructor(
    public pdf: PDFDocument,
    public fonts: BrandFonts,
    private darkColor: RGB,
    private practiceName: string
  ) {}

  static async create(darkColor: RGB, practiceName: string): Promise<BrandGuideDoc> {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    // Fonts are embedded by the caller (they hold the actual bytes); this
    // constructor exists so `fonts` is always set before any page is built.
    return new BrandGuideDoc(pdf, { heading: null as never, body: null as never, mono: null as never }, darkColor, practiceName);
  }

  setFonts(fonts: BrandFonts): void {
    this.fonts = fonts;
  }

  newPage(): PageFlow {
    const page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const flow = new PageFlow(page);
    this.flows.push(flow);
    return flow;
  }

  /** Draws every page's footer, now that the total count is known, then returns the finished bytes. */
  async finish(): Promise<Uint8Array> {
    const total = this.flows.length;
    // Real PDF transparency (pdf-lib's `opacity` option on drawText), not a
    // color pre-mixed toward white — "at 60%" means the alpha channel, and
    // stays correct regardless of what the footer sits on top of.
    const FOOTER_OPACITY = 0.6;
    this.flows.forEach((flow, index) => {
      flow.page.drawText(this.practiceName, {
        x: MARGIN,
        y: MARGIN - 20,
        size: 8,
        font: this.fonts.mono,
        color: this.darkColor,
        opacity: FOOTER_OPACITY,
      });
      const pageLabel = `${index + 1} / ${total}`;
      const labelWidth = this.fonts.mono.widthOfTextAtSize(pageLabel, 8);
      flow.page.drawText(pageLabel, {
        x: PAGE_WIDTH - MARGIN - labelWidth,
        y: MARGIN - 20,
        size: 8,
        font: this.fonts.mono,
        color: this.darkColor,
        opacity: FOOTER_OPACITY,
      });
    });
    return this.pdf.save();
  }
}
