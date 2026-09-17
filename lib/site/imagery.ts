import { IMAGE_SLOTS, type ImageSlot } from "@/lib/images/config";

/*
 * ── WHICH PHOTOGRAPHS BELONG ON THE WEBSITE ──────────────────────────────
 *
 * Eklio generates seven photographs. Only four of them are for a website.
 *
 * ⚠ `post_bg_1`, `post_bg_2` and `post_bg_3` ARE SOCIAL POST BACKGROUNDS, not
 * site imagery — square, with the subject cropped to the bottom quarter and the
 * whole upper half left plain so a caption can sit over it (see their briefs in
 * `lib/images/config.ts`). Step 1 listed all seven because it filtered on
 * "current and stored" and nothing else, so the prompt named three files the
 * instructions below never tell a builder what to do with. Dropped here.
 *
 * ⚠ THE ROLE SENTENCE IS PART OF THE FILE. A slot name on its own ("ambient_a")
 * tells a builder nothing, and it told her nothing either when she went to
 * download it. Each entry carries the aspect it was generated at and the one
 * place it goes, so the same list drives the prompt and the download list on
 * the step screen — one source, no drift.
 */

export type SiteImage = {
  slot: ImageSlot;
  /** What it is, for a human choosing a file to download. */
  title: string;
  /** The one instruction a builder needs. */
  role: string;
  /** As generated — "1536 × 1024". Never a crop suggestion. */
  dimensions: string;
};

/** The site's four, in the order a page uses them. */
const SITE_IMAGE_ROLES: { slot: ImageSlot; title: string; role: string }[] = [
  {
    slot: "hero",
    title: "Hero photograph",
    role:
      "The hero band's background, full-bleed. It was composed with its left third left empty so the headline sits there — place the headline on the left and do not centre it over the subject.",
  },
  {
    slot: "ambient_a",
    title: "Ambient photograph (tall)",
    role:
      "A supporting image beside a text section, portrait, roughly half the width. It fills its frame edge to edge, so no text goes over it.",
  },
  {
    slot: "ambient_b",
    title: "Ambient photograph (tall, quieter)",
    role:
      "The second supporting image, for a section further down the page, so the same photograph is never used twice on one page.",
  },
  {
    slot: "texture",
    title: "Texture",
    role:
      "A background behind a single quiet band only, at low contrast and never behind body text. It is a surface, not a subject — do not use it as a hero or as a section illustration.",
  },
];

/** The slot keys a website uses, in page order. */
export const SITE_IMAGE_SLOTS: readonly ImageSlot[] = SITE_IMAGE_ROLES.map((r) => r.slot);

/**
 * The generated photographs she actually has, as site roles.
 *
 * `available` is the slot keys returned by the image read — anything not in the
 * four above drops out, and a site slot she has not generated yet is simply
 * absent rather than a placeholder promising a file that does not exist.
 */
export function siteImages(available: readonly string[]): SiteImage[] {
  const have = new Set(available);
  return SITE_IMAGE_ROLES.filter((entry) => have.has(entry.slot)).map((entry) => {
    const [w, h] = IMAGE_SLOTS[entry.slot].size.split("x");
    return { ...entry, dimensions: `${w} × ${h}` };
  });
}
