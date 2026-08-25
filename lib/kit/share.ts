/*
 * Identifiant de partage d'un kit (`brand_kits.share_slug`, unique en base).
 *
 * Il est fabriqué et conservé dès le Lot 3 pour qu'un lien reste stable d'une
 * régénération à l'autre. ATTENTION : la RLS de `brand_kits` est owner-only
 * (policy `brand_kits_all_own`) — aucune lecture anonyme par slug n'est
 * autorisée aujourd'hui. Ouvrir un vrai partage public demande une décision de
 * schéma côté `eklio-backend` ; le front ne la prend pas.
 */

/** Suffixe aléatoire, alphabet sans caractères ambigus (ni 0/O, ni 1/l/I). */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomSuffix(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** Réduit un nom libre à un fragment d'URL lisible ; vide si rien d'utilisable. */
export function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/**
 * Slug de partage : nom lisible + suffixe aléatoire.
 *
 * Le suffixe n'est pas décoratif — sans lui, deux praticiens portant le même
 * nom de cabinet entreraient en collision sur une colonne unique, et le slug
 * serait devinable.
 */
export function buildShareSlug(practiceName: string): string {
  const base = slugifyName(practiceName);
  return base === "" ? `kit-${randomSuffix()}` : `${base}-${randomSuffix()}`;
}
