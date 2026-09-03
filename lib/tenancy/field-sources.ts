import { z } from "zod";
import type { FieldSource } from "@/types/supabase";

export type { FieldSource };

/*
 * Les neuf champs de `site_specs` dont la provenance est suivie, mirés depuis
 * `supabase/migrations/20260903102000_brand_field_sources.sql`
 * (`validate_field_sources()`) — six rôles de couleur, la paire typographique,
 * et `logo` en UNE clé conceptuelle couvrant les quatre colonnes de chemin de
 * fichier (`logo_svg_path`, `logo_png_light_path`, `logo_png_dark_path`,
 * `monogram_svg_path`), comme la même migration le documente.
 *
 * Toute évolution de la liste des clés se fait là-bas d'abord — le test de ce
 * module vérifie qu'elles restent synchronisées.
 */
export const FIELD_SOURCE_KEYS = [
  "primary_hex",
  "secondary_hex",
  "accent_hex",
  "light_neutral_hex",
  "dark_neutral_hex",
  "paper_hex",
  "heading_font",
  "body_font",
  "logo",
] as const;

export type FieldSourceKey = (typeof FIELD_SOURCE_KEYS)[number];

const FIELD_SOURCE_VALUES = [
  "generated",
  "imported",
  "derived",
  "inherited",
] as const;

export const fieldSourceSchema = z.enum(FIELD_SOURCE_VALUES);

/*
 * Forme du jsonb `site_specs.field_sources` — un objet partiel (aucune clé
 * n'est requise, un objet vide est l'état par défaut, exactement comme
 * `validate_field_sources()` l'accepte) dont chaque clé PRÉSENTE doit être une
 * des neuf ci-dessus et chaque valeur une des quatre sources.
 *
 * ⚠ `z.record(z.enum([...]), …)` REND CHAQUE CLÉ DE L'ENUM OBLIGATOIRE en Zod
 * 4 — il modélise `Record<K, V>`, pas un dictionnaire partiel, et un objet
 * vide y échoue (trouvé en faisant réellement tourner ce test). C'est
 * `z.partialRecord` qu'il fallait : mêmes clés autorisées, mais chacune
 * facultative, et une clé hors de l'énumération toujours rejetée — la même
 * règle que le CHECK SQL, ni plus permissive, ni plus stricte.
 */
export const fieldSourcesSchema = z.partialRecord(
  z.enum(FIELD_SOURCE_KEYS),
  fieldSourceSchema
);

export type FieldSources = z.infer<typeof fieldSourcesSchema>;

/*
 * `imported` et `inherited` sont les deux sources qu'un client ne doit pas
 * pouvoir réécrire librement dans l'éditeur — la première parce que c'est
 * l'identité EXACTE que la cliniciene a apportée, la seconde parce que c'est
 * la charte de marque de l'organisation qui en fait foi. `generated` et
 * `derived` restent modifiables : ce sont des points de départ, pas des faits.
 *
 * ⚠ Ceci ne fait qu'INFORMER l'UI. Rien côté base ne refuse encore l'écriture
 * d'un champ `inherited` — cette application-là est un lot ultérieur, comme
 * le documente déjà le commentaire sur `site_specs.field_sources` en base.
 */
export function isLocked(source: FieldSource): boolean {
  return source === "imported" || source === "inherited";
}
