import type { LaunchStepKey } from "@/lib/data/checklist";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";
import {
  emailSignatureText,
  personalStatement,
  shortBio,
} from "@/lib/kit/launch-copy";

/*
 * ── WHAT EACH STEP HANDS HER ─────────────────────────────────────────────
 *
 * Five of the seven steps are errands on someone else's website. The product's
 * entire job on those is to hand over the exact words and the exact file, so
 * that the trip to Psychology Today is a paste rather than a writing session.
 *
 * ⚠ NOTHING HERE IS WRITTEN BY THIS MODULE. Every string is assembled from
 * fields she filled in or approved — the practitioner line, the credential, the
 * about excerpt, the booking URL — by the same four helpers `/app/launch`
 * already used. A step whose source field is null yields NO block, never an
 * empty well and never a placeholder.
 *
 * Two blocks the reference asks for do not exist and are not invented here:
 * Psychology Today's structured fields (modalities, populations, licensed
 * state, which live as unresolved catalogue ids) and a Google-specific short
 * description. Both are copy generation, which belongs to the Ethics Guard
 * pipeline. They are recorded in FINDINGS.md and their steps ship without them.
 */

export type TextBlock = {
  /** The mono label above the well, and the copy button's accessible name. */
  label: string;
  /** The exact text, as she will paste it. Never truncated for display. */
  text: string;
};

/**
 * Every copyable string a step carries, in the order it should be read.
 *
 * The four helpers are the SAME ones `LaunchStepDetail` calls, so the
 * board-safe statement cannot say one thing on the step screen and another in
 * the accordion.
 */
export function stepTextBlocks(
  key: LaunchStepKey,
  context: LaunchStepContext
): TextBlock[] {
  const blocks: TextBlock[] = [];
  const push = (label: string, text: string | null) => {
    if (text) blocks.push({ label, text });
  };

  switch (key) {
    case "update_directory":
    case "google_profile":
      push("Statement", personalStatement(context.practitionerLine, context.practiceDetails));
      break;

    case "social_setup":
      // Already ≤150 by construction — `shortBio` truncates on a word boundary
      // whatever the source length, which is what Instagram's limit needs.
      push("Bio", shortBio(context.aboutExcerpt));
      break;

    case "email_signature":
      push(
        "Signature",
        emailSignatureText(
          context.practiceName,
          context.practitionerLine,
          context.practiceDetails,
          context.bookingUrl
        )
      );
      break;

    case "booking_link":
      push("Booking link", context.bookingUrl);
      break;

    // `site_setup` hands over a file and the site editor; `first_post` hands
    // over an image. Neither has a string she pastes from this screen.
    default:
      break;
  }

  return blocks;
}

/**
 * The catalogue keys a step needs, most important first.
 *
 * ⚠ READ OFF THE PRODUCT, NOT CHOSEN. Each step's own description already
 * names the file it needs — "your avatar and cover image", "the signature
 * template", "your board-safe statement and your avatar". These are those
 * files, by catalogue key. A key absent from the manifest yields no row: the
 * catalogue decides what exists, not this list.
 */
export const STEP_ASSET_KEYS: Record<LaunchStepKey, readonly string[]> = {
  site_setup: ["site_setup_md"],
  update_directory: ["avatar_400"],
  google_profile: ["icon_512", "og_image_1200x630"],
  social_setup: ["avatar_400", "cover_facebook_1640x624"],
  email_signature: ["email_signature_html", "email_signature_png", "wordmark_png_dark"],
  booking_link: [],
  first_post: ["post_signature_1080"],
};

/** `png` + 1000 × 1000 → `PNG · 1000×1000`. The format alone when it has no pixels. */
export function assetFormatLine(
  kind: string,
  width: number | null,
  height: number | null
): string {
  const format = kind.toUpperCase();
  return width && height ? `${format} · ${width}×${height}` : format;
}
