/*
 * Deterministic copy for "Your first week"'s per-step detail — string
 * templating over data the kit already has (practitioner line, practice
 * details, the selected direction's about excerpt), never a model call.
 * Same rule as the asset pipeline: this is assembly, not generation.
 */

export type PracticeDetails = {
  practitionerName: string | null;
  licenseLabel: string | null;
  licenseNumber: string | null;
  city: string | null;
  state: string | null;
};

/**
 * The "board-safe personal statement" the checklist points at for the
 * Psychology Today and Google Business Profile steps — the practitioner
 * line plus the credential and location she already entered, so the words
 * match everywhere rather than being retyped once per directory.
 */
export function personalStatement(
  practitionerLine: string | null,
  practiceDetails: PracticeDetails | null
): string | null {
  const parts: string[] = [];
  if (practitionerLine?.trim()) parts.push(practitionerLine.trim());

  const credential = [practiceDetails?.licenseLabel, practiceDetails?.licenseNumber]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  if (credential) parts.push(credential);

  const location = [practiceDetails?.city, practiceDetails?.state]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
  if (location) parts.push(location);

  if (parts.length === 0) return null;
  return parts.join(" — ");
}

/** A ≤150-char bio for Instagram/Facebook — a truncation of what she already wrote, never invented copy. */
export function shortBio(aboutExcerpt: string | null, limit = 150): string | null {
  const text = aboutExcerpt?.trim();
  if (!text) return null;
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return `${trimmed}…`;
}

/** The plain-text email signature block — name, credential, practice, booking link. */
export function emailSignatureText(
  practiceName: string | null,
  practitionerLine: string | null,
  practiceDetails: PracticeDetails | null,
  bookingUrl: string | null
): string | null {
  const lines: string[] = [];

  const nameLine = [practitionerLine, practiceDetails?.licenseLabel]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
  if (nameLine) lines.push(nameLine);
  if (practiceName) lines.push(practiceName);
  if (bookingUrl) lines.push(bookingUrl);

  if (lines.length === 0) return null;
  return lines.join("\n");
}
