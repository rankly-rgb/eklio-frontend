import { COLOR_ROLE_KEYS, isDerivedToken } from "@/lib/site/colors";

/*
 * Ce qu'un patch a le droit de porter, et à quelle « zone » il appartient.
 *
 * La zone sert à l'analytique (`site_spec_edited`) et à rien d'autre : elle
 * dit QUE quelque chose a été édité, jamais quoi. Aucun texte de la
 * praticienne ne sort d'ici.
 */

export type SpecArea =
  | "colors"
  | "typography"
  | "copy"
  | "structure"
  | "details"
  | "instructions";

const AREA_OF_KEY: Record<string, SpecArea> = {
  ...Object.fromEntries(COLOR_ROLE_KEYS.map((key) => [key, "colors" as const])),
  heading_font: "typography",
  body_font: "typography",
  type_pairing_id: "typography",
  google_fonts_url: "typography",
  hero: "copy",
  about_excerpt: "copy",
  pages: "structure",
  practice_details: "details",
  extra_instructions: "instructions",
};

/** Les zones touchées par un patch, dédupliquées, dans un ordre stable. */
export function patchAreas(patch: object): SpecArea[] {
  const seen = new Set<SpecArea>();
  for (const key of Object.keys(patch)) {
    const area = AREA_OF_KEY[key];
    if (area) seen.add(area);
  }
  return [...seen];
}

/**
 * Retire d'un patch tout ce qui n'est pas patchable.
 *
 * En pratique : les quatre variantes dérivées (`primary_text`,
 * `secondary_text`, `accent_text`, `cta_ink`) et les colonnes que la base
 * calcule (`spec_version`, `updated_at`, `last_copied_spec_version`…).
 *
 * ⚠ Ce n'est PAS une validation — la base refuserait de toute façon une clé
 * inconnue avec `unknown_field`. C'est une garde contre un bug de composant :
 * un formulaire qui renverrait `preview.tokens` en bloc enverrait les quatre
 * variantes, et la praticienne verrait une erreur qu'elle n'a pas causée sur
 * un contrôle qui n'existe pas.
 */
const NOT_PATCHABLE = new Set([
  "brand_kit_id",
  "spec_version",
  "last_copied_spec_version",
  "updated_at",
  "seed_clamped",
  "target",
]);

export function sanitizePatch<T extends object>(patch: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (isDerivedToken(key) || NOT_PATCHABLE.has(key)) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}
