import type { PracticeDetails } from "@/lib/kit/launch-copy";

/*
 * The two site-spec fields the launch steps need, read in ONE place.
 *
 * The kit page already derived these inline for its own cards, and the guided
 * flow needs exactly the same ones. A second copy of the mapping is a second
 * copy that can fall behind the spec's shape — so both call this.
 */

type SpecShape = {
  practice_details?: {
    practitioner_name?: string | null;
    license_label?: string | null;
    license_number?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  hero: { cta_target_url?: string | null };
};

export function practiceDetailsFrom(spec: SpecShape | null): PracticeDetails | null {
  if (!spec?.practice_details) return null;
  return {
    practitionerName: spec.practice_details.practitioner_name ?? null,
    licenseLabel: spec.practice_details.license_label ?? null,
    licenseNumber: spec.practice_details.license_number ?? null,
    city: spec.practice_details.city ?? null,
    state: spec.practice_details.state ?? null,
  };
}

/** The booking link, or null. An empty string is not a link. */
export function bookingUrlFrom(spec: SpecShape | null): string | null {
  return spec?.hero.cta_target_url || null;
}
