import { createHash } from "node:crypto";
import { ENGINE_VERSION, TYPE } from "@/lib/compose/constants";
import type { Palette } from "@/lib/compose/types";

/*
 * ── THE CACHE KEY ───────────────────────────────────────────────────────
 *
 * `rendered_assets.content_hash` is a SHA-256 over five things, and leaving any
 * one of them out is a distinct bug:
 *
 *   archetype   — obviously
 *   payload     — NORMALISED, so that two objects with the same content and a
 *                 different key order hash the same. Without that the cache
 *                 misses on every call whose JSON was rebuilt, which is all of
 *                 them, and the whole table is dead weight nobody notices.
 *   palette     — the same words in her colours and in somebody else's are two
 *                 different cards.
 *   typography  — the floors are inputs to the layout, so a change to them
 *                 moves pixels.
 *   engine      — ENGINE_VERSION. A cache that outlives its renderer serves
 *                 last month's bug forever, and it looks exactly like a card.
 */

/** Key-sorted JSON, recursively. Arrays keep their order — it is meaning, not layout. */
export function normalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalise);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = normalise((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function contentHash(archetype: string, payload: unknown, palette: Palette): string {
  const material = JSON.stringify({
    archetype,
    payload: normalise(payload),
    palette: {
      key: palette.key,
      paper: palette.paper,
      tints: palette.tints,
      ink: palette.ink,
      inkOnTint: palette.inkOnTint,
      dark: palette.dark,
    },
    typography: TYPE,
    engine: ENGINE_VERSION,
  });
  return createHash("sha256").update(material).digest("hex");
}
