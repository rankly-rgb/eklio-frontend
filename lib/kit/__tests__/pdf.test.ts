import { describe, expect, it } from "vitest";
import { renderMarkdownPdf } from "@/lib/kit/pdf";

/*
 * The PDF is written by hand: this test holds the file's structure, because
 * one byte off in the xref table gives a file no reader opens — and that
 * doesn't show up at compile time.
 *
 * `renderBrandKitPdf` (the brand guide) moved to `lib/kit/pdf/brand-guide.ts`
 * — pdf-lib + fontkit, its own tests. What's left here, `renderMarkdownPdf`,
 * is the site setup sheet's PDF export, and is the only thing this file's
 * hand-rolled PDF-1.4 engine still backs.
 */

function decode(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("renderMarkdownPdf", () => {
  it("produces a well-formed PDF file", () => {
    const text = decode(renderMarkdownPdf("Setup", "# Hello\n\nSome body text."));

    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Pages");
    expect(text).toContain("startxref");
  });

  it("the xref table's offsets point at their actual objects", () => {
    const text = decode(
      renderMarkdownPdf(
        "Setup",
        "# Heading one\n\nA paragraph.\n\n## Heading two\n\n- item one\n- item two\n\n> a quote\n\n---\n"
      )
    );

    const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");

    const table = text.slice(startxref).split("\n");
    // Line 0: "xref", line 1: "0 N", line 2: the free object.
    const total = Number(table[1].split(" ")[1]);
    for (let index = 1; index < total; index += 1) {
      const offset = Number(table[2 + index].slice(0, 10));
      expect(text.slice(offset).startsWith(`${index} 0 obj`)).toBe(true);
    }
  });

  it("carries the title and real markdown content", () => {
    const text = decode(renderMarkdownPdf("Your setup sheet", "# A real heading\n\nReal body text."));

    expect(text).toContain("Your setup sheet");
    expect(text).toContain("A real heading");
    expect(text).toContain("Real body text.");
  });

  it("stays valid for markdown with no recognized blocks at all", () => {
    const text = decode(renderMarkdownPdf("Setup", "just plain text, no headings or lists"));

    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
  });

  it("stays valid for empty markdown", () => {
    const text = decode(renderMarkdownPdf("Setup", ""));

    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
  });
});
