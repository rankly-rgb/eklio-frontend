import type { Direction } from "@/lib/brand/shapes";
import type { SeedClamped, SeedClampNote } from "@/lib/site/types";

/*
 * `seed_clamped` — ce que le semeur a raccourci (§7 du contrat).
 *
 * ── LIRE LES CLÉS PRÉSENTES, PAS UNE LISTE DE TROIS ─────────────────────
 *
 * En pratique seules trois clés apparaissent — `hero.overline`,
 * `hero.cta_label`, `about_excerpt` — parce que `hero.headline` et
 * `hero.subhead` sont bornés en amont à 46 et 60 par
 * `brand_kits_directions_rendering_check`, bien à l'intérieur des 90 et 220 du
 * spec. Mais un kit écrit AVANT que ce CHECK soit resserré pourrait porter un
 * titre plus long. On itère donc sur ce qui est là.
 *
 * ── PAS DE BOUTON « RESTAURER » ─────────────────────────────────────────
 *
 * Le texte d'origine est lisible dans la direction retenue. Il ne peut PAS
 * être réenregistré : la limite est un CHECK, et l'original est au-dessus —
 * c'est exactement pourquoi il a été coupé. Un bouton « restaurer » échouerait
 * avec `too_long` à tous les coups. La note MONTRE ce qui a été retiré et
 * invite à réécrire à la bonne longueur.
 *
 * ── ELLE SE DISSIPE TOUTE SEULE ─────────────────────────────────────────
 *
 * Écrire un champ retire SON entrée, et seulement la sienne. Quand la dernière
 * part, `seed_clamped` devient `null` — pas `{}`.
 */

export type ClampedField = {
  /** La clé telle qu'elle arrive : `hero.overline`, `about_excerpt`… */
  key: string;
  note: SeedClampNote;
  /** Le texte complet, lu dans la direction retenue. `null` s'il est introuvable. */
  original: string | null;
};

/** Le texte d'origine d'une clé, dans la direction retenue. */
export function originalFor(direction: Direction, key: string): string | null {
  if (key === "about_excerpt") return direction.about_excerpt;

  const heroField = key.startsWith("hero.") ? key.slice("hero.".length) : null;
  if (!heroField) return null;

  const hero = direction.hero as unknown as Record<string, unknown>;
  const value = hero[heroField];
  return typeof value === "string" ? value : null;
}

/** Toutes les entrées présentes, dans un ordre stable. */
export function clampedFields(
  seedClamped: SeedClamped,
  direction: Direction
): ClampedField[] {
  if (!seedClamped) return [];

  return Object.entries(seedClamped)
    .filter(([, note]) => note && typeof note.original_length === "number")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, note]) => ({ key, note, original: originalFor(direction, key) }));
}

/** L'entrée d'une clé donnée, pour poser la note SUR le champ concerné. */
export function clampNoteFor(
  seedClamped: SeedClamped,
  direction: Direction,
  key: string
): ClampedField | null {
  return clampedFields(seedClamped, direction).find((entry) => entry.key === key) ?? null;
}
