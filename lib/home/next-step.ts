import type { LaunchStepKey } from "@/lib/data/checklist";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";
import {
  emailSignatureText,
  personalStatement,
  shortBio,
} from "@/lib/kit/launch-copy";

/*
 * What the NEXT STEP card can show beside a step's title and body: the exact
 * text the step asks her to paste, and the one asset it asks her to use.
 *
 * ⚠ NEITHER IS INVENTED, AND NEITHER IS MANDATORY. A step that carries no
 * copy and no asset renders neither block — the card stays composed with a
 * title, a body and its two buttons, which is the honest shape for "open the
 * site editor". Nothing here fills a gap with an example.
 */

/**
 * The catalogue key each step's own copy already points at.
 *
 * ⚠ READ OFF THE PRODUCT, NOT CHOSEN. `LaunchStepDetail` already tells her
 * which file each of these steps needs — "Get your avatar and cover image",
 * "Get your signature template" — and sends her to the assets page for it.
 * This names the same file so the card can show it in place. A key absent
 * from the manifest yields no asset row rather than an empty one: the
 * catalogue is the authority on what exists.
 */
export const STEP_ASSET_KEY: Partial<Record<LaunchStepKey, string>> = {
  social_setup: "avatar_400",
  email_signature: "email_signature_png",
  first_post: "post_signature_1080",
};

export type StepCopy = {
  /** The mono label above the well — what this text IS. */
  label: string;
  /** The exact text, as she will paste it. Never truncated, never an excerpt. */
  text: string;
};

/**
 * The copyable text a step carries, or `null`.
 *
 * ⚠ THE SAME FOUR HELPERS `LaunchStepDetail` USES, called the same way. This
 * exists because that component returns rendered blocks — buttons, hints, a
 * character counter — and this card needs the string itself to put in its own
 * well. The step→text mapping is therefore written twice in this repo; the
 * two are listed side by side in FINDINGS.md so the second one cannot be
 * changed without the first.
 */
export function launchStepCopy(
  step: LaunchStepKey,
  context: LaunchStepContext
): StepCopy | null {
  switch (step) {
    case "update_directory":
    case "google_profile": {
      const text = personalStatement(context.practitionerLine, context.practiceDetails);
      return text ? { label: "Statement", text } : null;
    }

    case "social_setup": {
      const text = shortBio(context.aboutExcerpt);
      return text ? { label: "Bio", text } : null;
    }

    case "email_signature": {
      const text = emailSignatureText(
        context.practiceName,
        context.practitionerLine,
        context.practiceDetails,
        context.bookingUrl
      );
      return text ? { label: "Signature", text } : null;
    }

    case "booking_link":
      return context.bookingUrl ? { label: "Booking link", text: context.bookingUrl } : null;

    // `site_setup` sends her to the site editor and `first_post` to her
    // templates. Neither has a string she pastes from here.
    default:
      return null;
  }
}

/** `png` + 1000 × 1000 → `PNG · 1000×1000`. The format alone when it has no pixels. */
export function assetFormatLine(
  kind: string,
  width: number | null,
  height: number | null
): string {
  const format = kind.toUpperCase();
  return width && height ? `${format} · ${width}×${height}` : format;
}
