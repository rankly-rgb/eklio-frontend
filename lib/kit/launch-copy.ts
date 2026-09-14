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
 * Psychology Today step — the practitioner line plus the credential and
 * location she already entered, so the words match rather than being retyped.
 *
 * ⚠ CE N'EST PLUS LE TEXTE DE LA FICHE GOOGLE. Il l'était : `stepTextBlocks`
 * faisait tomber `update_directory` et `google_profile` sur le même `push`.
 * Les deux lecteurs ne sont pas les mêmes — voir `googleDescription`
 * ci-dessous — et le même paragraphe ne fait pas les deux.
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

/**
 * ── LA DESCRIPTION DE FICHE GOOGLE ──────────────────────────────────────
 *
 * ⚠ DEUX LECTEURS, DEUX TEXTES, ET C'EST TOUT LE LOT. Jusqu'ici la démarche
 * Google recevait EXACTEMENT le bloc de Psychology Today.
 *
 * Un profil Psychology Today est lu par quelqu'un qui cherche déjà une
 * thérapeute et compare des profils : le crédit, la licence et la ville y
 * sont des critères de tri. Une fiche Google est lue par quelqu'un qui a tapé
 * « therapist near me » et ne sait pas encore s'il veut appeler : ce qu'il
 * lui faut, c'est ce que la pratique fait et où.
 *
 * ⚠ ET ELLE N'INVENTE RIEN. Comme `personalStatement`, c'est un assemblage de
 * champs qu'elle a écrits ou approuvés — jamais un appel modèle. La
 * description RÉDIGÉE, celle que The Foundation livre, est un autre objet :
 * elle vit dans `directory_profiles` avec `platform = 'google_business'`, et
 * elle passe par l'Ethics Guard. Celle-ci est le repli déterministe de la
 * checklist, pour quelqu'un qui n'a pas encore de profil rédigé.
 *
 * ⚠ 750 CARACTÈRES, la borne de Google, et ce n'est pas celle de Psychology
 * Today. La base l'impose aussi, par plateforme
 * (`directory_profiles_first_paragraph_check`). Une seule borne pour les deux
 * voudrait dire qu'un des deux textes est coupé sur une page publique.
 */
export const GOOGLE_DESCRIPTION_MAX = 750;

export function googleDescription(
  aboutExcerpt: string | null,
  practiceDetails: PracticeDetails | null
): string | null {
  const parts: string[] = [];

  // Ce que la pratique fait, dans ses mots à elle. C'est la première chose
  // qu'un lecteur Google veut, et la dernière qu'il trouve d'habitude.
  const about = aboutExcerpt?.trim();
  if (about) parts.push(about);

  // Puis où. Pas le numéro de licence : sur Google, c'est un chiffre qui
  // n'aide personne à décider d'appeler, et la place est comptée.
  const location = [practiceDetails?.city, practiceDetails?.state]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
  if (location) parts.push(location);

  if (parts.length === 0) return null;

  const text = parts.join(" ");
  /*
   * ⚠ ON TRONQUE ICI, ET C'EST L'INVERSE DE `lib/directory/profile.ts`.
   * La règle n'est pas contradictoire, les deux objets le sont : là-bas, une
   * prose RÉDIGÉE trop longue est un échec de génération qu'on veut voir ;
   * ici, c'est un assemblage de champs qu'elle a écrits, et le seul recours
   * serait de lui rendre une chaîne vide. Tronquer sur une limite de mot,
   * comme `shortBio` le fait déjà pour Instagram, lui rend quelque chose
   * qu'elle peut coller et corriger.
   */
  return shortBio(text, GOOGLE_DESCRIPTION_MAX);
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
