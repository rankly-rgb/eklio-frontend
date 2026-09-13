/*
 * ── TWO SLOTS THAT ARE USUALLY EMPTY ─────────────────────────────────────
 *
 * An explanatory video and an affiliate link. Both are configuration, both are
 * read from the environment, and both render NOTHING when unset.
 *
 * ⚠ THERE IS NO FALLBACK, AND THAT IS THE WHOLE POINT. No placeholder URL, no
 * dummy embed, no "coming soon" banner. A block whose entire purpose is to be
 * clicked, carrying a URL nobody set, is the worst defect this screen can
 * ship: it looks finished, it invites the click, and it goes nowhere. An
 * absent slot is simply absent, and the layout is correct without it.
 *
 * The URLs are validated rather than trusted: a value that is not an https URL
 * is treated as unset, because a malformed env var should leave the slot empty
 * rather than render a broken anchor.
 */

function httpsUrl(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    return new URL(text).protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}

export type LaunchSlots = {
  /** A walkthrough video for the site step, or null. */
  videoUrl: string | null;
  /** Her referral link to the builder, or null. */
  affiliateUrl: string | null;
};

/**
 * Read on the SERVER, passed down as props.
 *
 * `NEXT_PUBLIC_` is deliberate — these are links a browser follows, not
 * secrets — but they are still read here rather than in a client component, so
 * one place decides what "set" means.
 */
export function launchSlots(
  env: Record<string, string | undefined> = process.env
): LaunchSlots {
  return {
    videoUrl: httpsUrl(env.NEXT_PUBLIC_LAUNCH_SITE_VIDEO_URL),
    affiliateUrl: httpsUrl(env.NEXT_PUBLIC_LAUNCH_LOVABLE_AFFILIATE_URL),
  };
}
