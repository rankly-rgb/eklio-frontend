import type { SitePreviewTokens } from "@/lib/site/types";

/*
 * The deterministic placeholder for a photograph that doesn't exist yet — a
 * diagonal gradient from her primary color to her dark neutral, the same two
 * tokens the (not-yet-built) ambiance prompt starts from to tint the photo,
 * so the block never reads as generic. Same formula as
 * `lib/brand/derive.ts`'s `ambianceGradient`, restated against
 * `SitePreviewTokens` (`primary`/`dark_neutral`) rather than the reveal's own
 * `PreviewTokens` (`primary`/`dark`) — the two token shapes come from
 * different subsystems (site-spec vs. reveal) and aren't interchangeable.
 */
export function ambiancePlaceholder(
  tokens: Pick<SitePreviewTokens, "primary" | "dark_neutral">
): string {
  return `linear-gradient(135deg, ${tokens.primary} 0%, ${tokens.dark_neutral} 100%)`;
}
