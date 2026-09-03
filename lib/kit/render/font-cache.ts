import { createAdminClient } from "@/lib/supabase/server";

/*
 * The shared TTF cache behind the `fonts` storage bucket (Lot 4.1–4.3).
 * satori needs real font file bytes, not a browser `<link>` — this is the
 * one place in the paid-space chantier that reaches outside the paid space:
 * warming happens at direction-selection time (`lib/data/brand-kit.ts`,
 * `selectDirection`), strictly additive, fire-and-forget, and a font-fetch
 * failure here must never fail that selection.
 *
 * The `fonts` bucket has zero client RLS policies (see
 * FRONTEND_CONTRACT.md §10, eklio-backend) — only `service_role` can touch
 * it, so every call here goes through `createAdminClient()`.
 */

function slugify(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Google serves woff2 to a modern User-Agent and ttf to an old one — satori
 * accepts ttf/otf/woff, not woff2. This UA is the smallest lever that gets
 * ttf `src` URLs back from the CSS2 API, nothing more exotic.
 */
const TTF_FORCING_USER_AGENT = "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)";

async function fetchFontFaceCss(googleFontsUrl: string): Promise<string> {
  const res = await fetch(googleFontsUrl, {
    headers: { "User-Agent": TTF_FORCING_USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Google Fonts CSS fetch failed: ${res.status}`);
  }
  return res.text();
}

/** The first ttf `src` URL for `family` in a Google Fonts CSS2 response. */
function extractFontFileUrl(css: string, family: string): string | null {
  const blocks = css.split("@font-face");
  for (const block of blocks) {
    if (!block.includes(`'${family}'`) && !block.includes(`"${family}"`)) continue;
    const match = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * The bytes for one font family, from the cache if present, fetched and
 * cached otherwise. Throws on any failure — callers that must not fail
 * (rendering triggered by a paying user waiting for a download) decide how
 * to handle that; `warmFontCache` below is the fire-and-forget wrapper for
 * callers that must never fail.
 */
export async function getCachedFontBuffer(
  family: string,
  googleFontsUrl: string
): Promise<ArrayBuffer> {
  const cacheKey = `${slugify(family)}.ttf`;
  const admin = createAdminClient();

  const cached = await admin.storage.from("fonts").download(cacheKey);
  if (cached.data) {
    return cached.data.arrayBuffer();
  }

  const css = await fetchFontFaceCss(googleFontsUrl);
  const fileUrl = extractFontFileUrl(css, family);
  if (!fileUrl) {
    throw new Error(`No ttf source found for font family "${family}"`);
  }

  const fontRes = await fetch(fileUrl);
  if (!fontRes.ok) {
    throw new Error(`Font file fetch failed for "${family}": ${fontRes.status}`);
  }
  const buffer = await fontRes.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("fonts")
    .upload(cacheKey, buffer, { contentType: "font/ttf", upsert: true });
  if (uploadError) {
    // Cache-fill failure is not render failure: the caller already has the
    // bytes it asked for, just uncached for next time.
    console.error("[kit/render] font cache upload failed", family, uploadError);
  }

  return buffer;
}

/**
 * Fire-and-forget cache warming — never awaited by the caller, never
 * throws. Intended to be called from inside `after()` at direction-selection
 * time, so a font-fetch failure reaches nothing but this log line.
 */
export function warmFontCache(family: string, googleFontsUrl: string): void {
  void getCachedFontBuffer(family, googleFontsUrl).catch((err: unknown) => {
    console.error("[kit/render] font cache warm failed", family, err);
  });
}
