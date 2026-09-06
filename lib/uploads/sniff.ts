/*
 * ── WHAT A FILE ACTUALLY IS ─────────────────────────────────────────────
 *
 * The extension is a claim by whoever named the file, and `Content-Type` is a
 * claim by whoever sent it. Neither is evidence. `portrait.png` can be an SVG
 * with a script in it, and a browser asked to render it as an image will
 * happily execute that script under our origin.
 *
 * So the bytes decide, here, before anything is uploaded or recorded. What the
 * caller claimed is kept only to be reported as a mismatch — it never selects
 * the type.
 *
 * The database holds the other half of this: a mime allowlist on the column
 * and on the bucket. Neither half is sufficient alone, and the migration says
 * the same thing from its side.
 */

export const UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
] as const;
export type UploadMimeType = (typeof UPLOAD_MIME_TYPES)[number];

export type SniffResult =
  | {
      ok: true;
      mimeType: UploadMimeType;
      /** True when the file name or the declared type disagreed with the bytes. */
      mismatched: boolean;
    }
  | { ok: false; reason: "empty" | "unsupported" };

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** The type a file NAME claims, used only to detect a mismatch. Never to pick one. */
export function claimedTypeFor(fileName: string | null, declared: string | null): string | null {
  if (declared && (UPLOAD_MIME_TYPES as readonly string[]).includes(declared)) return declared;
  const extension = (fileName ?? "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    default:
      return null;
  }
}

/**
 * What these bytes really are.
 *
 * SVG has no magic number — it is XML — so it is the one type identified by
 * shape rather than signature, and only after every binary signature has been
 * ruled out. That ordering matters: a file beginning with the PNG signature is
 * a PNG even if the string "<svg" appears further in.
 */
export function sniff(bytes: Uint8Array, claimed: string | null = null): SniffResult {
  if (bytes.length === 0) return { ok: false, reason: "empty" };

  const found = detect(bytes);
  if (!found) return { ok: false, reason: "unsupported" };

  return { ok: true, mimeType: found, mismatched: claimed !== null && claimed !== found };
}

function detect(bytes: Uint8Array): UploadMimeType | null {
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG: 89 P N G CR LF 1A LF
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";

  // WEBP: "RIFF" <4-byte size> "WEBP"
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }

  // PDF: "%PDF-"
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";

  return looksLikeSvg(bytes) ? "image/svg+xml" : null;
}

/** The UTF-8 byte order mark, which a text editor may have written in front. */
const BOM = "﻿";

/**
 * SVG, by shape.
 *
 * Deliberately narrow: after the prologue, the first element must be `<svg`.
 * An HTML page containing an `<svg>` somewhere in the middle is therefore not
 * an image, and is not stored as one.
 */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  // Only the head is examined. A real SVG declares itself immediately, and
  // scanning ten megabytes for an angle bracket is a denial of service waiting
  // to be handed one.
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 2048));
  let rest = head.startsWith(BOM) ? head.slice(BOM.length) : head;
  rest = rest.trimStart();

  // Strip the prologue: XML declaration, comments, DOCTYPE, processing
  // instructions. Bounded — a malformed prologue must not spin.
  for (let step = 0; step < 20; step += 1) {
    const before = rest;
    rest = rest
      .replace(/^<\?xml[^>]*\?>/i, "")
      .replace(/^<!--[\s\S]*?-->/, "")
      .replace(/^<!DOCTYPE[^>]*>/i, "")
      .replace(/^<\?[^>]*\?>/, "")
      .trimStart();
    if (rest === before) break;
  }

  return /^<svg[\s/>]/i.test(rest);
}

/**
 * A file name safe to store and to show back: no directory, no control
 * characters, bounded length. Returns null when nothing usable is left.
 */
export function safeFileName(name: string | null): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  return cleaned.length > 0 ? cleaned : null;
}
