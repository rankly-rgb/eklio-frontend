import type { LaunchStepKey } from "@/lib/data/checklist";

/*
 * ── WHERE EACH STEP ACTUALLY HAPPENS ─────────────────────────────────────
 *
 * The list used to read like seven Eklio features. Five of the seven are
 * errands on someone else's website, and the product's whole job on those is
 * to hand her the exact words and the exact file to take there. A row that
 * does not say where the work happens is a row that misrepresents the work.
 *
 * ⚠ THE LINK IS THE SERVICE'S FRONT DOOR, NEVER A GUESSED ACCOUNT URL. Eklio
 * does not hold her Psychology Today id, her Google listing id or her Instagram
 * handle. A constructed deep link would be a guess, and a guess that lands on
 * the wrong profile — or on a 404 — is worse than the service's own home page,
 * from which she knows her own way. So: one URL per service, no path, no
 * query, no identifier.
 *
 * ⚠ NO THIRD-PARTY LOGOS. The service is named in text beside a neutral mark,
 * the decision already taken for the signature screen.
 */

export type StepPlace = {
  /** Mono label on the row: `IN EKLIO`, `PSYCHOLOGY TODAY`, … */
  label: string;
  /**
   * The service she finishes this step on, or `null` when it is done inside
   * Eklio (or inside her own mail client, which is not a website to link to).
   */
  service: { name: string; url: string } | null;
  /**
   * True when Eklio CANNOT observe that the step happened. Those steps get
   * "Mark as done" — she is declaring something the product cannot see — and
   * the wording says so.
   */
  declared: boolean;
};

export const STEP_PLACES: Record<LaunchStepKey, StepPlace> = {
  // Her pages, her builder. The material is here; the paste is not.
  /*
   * ⚠ NOT "IN EKLIO". The prompt is assembled here and the site is built
   * somewhere else — she leaves with the words and comes back with a site.
   * Labelling it as an Eklio errand was the thing that made the whole list
   * read like seven product features.
   */
  site_setup: {
    label: "Eklio → your builder",
    service: { name: "Lovable", url: "https://lovable.dev/" },
    declared: true,
  },

  update_directory: {
    label: "Psychology Today",
    service: { name: "Psychology Today", url: "https://www.psychologytoday.com/" },
    declared: true,
  },

  google_profile: {
    label: "Google",
    service: { name: "Google Business Profile", url: "https://business.google.com/" },
    declared: true,
  },

  social_setup: {
    label: "Instagram",
    service: { name: "Instagram", url: "https://www.instagram.com/" },
    declared: true,
  },

  // Her mail client, not a website. Gmail and Outlook both get their
  // instructions in the step itself; neither gets a link, because "open your
  // email" is not a destination Eklio can usefully send her to.
  email_signature: { label: "Your email", service: null, declared: true },

  /*
   * The booking link is an errand across every profile she has, so it has no
   * single destination. What it DOES have is a prerequisite that lives here:
   * `cta_target_url` is nullable and seeded null, and with no link there is
   * nothing to put anywhere. The step points back into Eklio for that.
   */
  booking_link: { label: "In Eklio", service: null, declared: true },

  first_post: {
    label: "Instagram",
    service: { name: "Instagram", url: "https://www.instagram.com/" },
    declared: true,
  },
};

/** Where the one-screen-per-step version of a row lives. */
export function stepHref(key: LaunchStepKey): string {
  return `/app/launch/${key}`;
}
