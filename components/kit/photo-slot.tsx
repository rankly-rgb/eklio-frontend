"use client";

import type { SitePreviewTokens } from "@/lib/site/types";
import { ambiancePlaceholder } from "@/lib/kit/photo-slot";

/*
 * <PhotoSlot> — the one place, across the kit header, the in-situ frames, and
 * any other editorial image spot, that stands in for a generated photograph.
 *
 * No `src` (every kit today, until Session 3 builds LOT 5's generation
 * pipeline): renders the deterministic gradient block, exactly as the reveal
 * already does for the ambiance image. A `src`, once one exists: the image
 * fades in over it at the motion budget's 400ms, cross-fading FROM the same
 * block rather than from empty space, so nothing ever pops.
 *
 * This is the only thing a later session needs to change to turn a
 * placeholder into a photograph: pass `src`. No loading skeleton — there is
 * nothing to load yet, and a skeleton for a fetch that doesn't exist is a
 * hole dressed up as a feature.
 */
export function PhotoSlot({
  tokens,
  src,
  alt = "",
  className = "",
}: {
  tokens: Pick<SitePreviewTokens, "primary" | "dark_neutral">;
  /** The generated photograph's URL. Omit or pass `null` for the gradient placeholder. */
  src?: string | null;
  /** Required once `src` is set — decorative placeholder use should leave this empty. */
  alt?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: ambiancePlaceholder(tokens) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, ephemeral Storage URLs; next/image's remote-domain allowlist doesn't fit
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-[400ms] [&.loaded]:opacity-100"
          onLoad={(event) => event.currentTarget.classList.add("loaded")}
        />
      ) : null}
    </div>
  );
}
