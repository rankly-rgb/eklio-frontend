/**
 * La forme du brief, partagée entre le serveur et le wizard client.
 * Rien ici n'est écrit à la main contre le schéma : les noms de colonnes
 * viennent de `Database["public"]["Tables"]["project_briefs"]`.
 */
import type { Database } from "@/types/supabase";

export type BriefRow = Database["public"]["Tables"]["project_briefs"]["Row"];
export type BriefPatch = Database["public"]["Tables"]["project_briefs"]["Update"];

export type BriefPreview = {
  practice_name: string | null;
  tokens: {
    primary: string;
    secondary: string;
    light: string;
    dark: string;
    paper: string;
    heading_font: string;
    body_font: string;
    google_fonts_url: string;
  };
  hero: {
    overline: string | null;
    headline: string;
    subhead: string;
    cta_label: string;
  };
  about_excerpt: string;
  specialties: string[];
};

export const BRIEF_STEPS = [
  { key: "practice", overline: "Your practice" },
  { key: "positioning", overline: "Positioning" },
  { key: "audience", overline: "Audience" },
  { key: "tone", overline: "Voice" },
  { key: "palette", overline: "Palette" },
  { key: "typography", overline: "Typography" },
  { key: "site", overline: "Your site" },
] as const;

export const BRIEF_STEP_COUNT = BRIEF_STEPS.length;

/** `palette_family_ids` est ordonné : l'élément 1 est la palette LEADING,
 *  celle qui pilote la preview. Trois au maximum, c'est un CHECK. */
export const MAX_PALETTES = 3;

/** La preview rend exactement deux chips de spécialité. */
export const MAX_PREVIEW_SPECIALTIES = 2;

export function toggleInList(list: string[], id: string, max?: number): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (max !== undefined && list.length >= max) return list;
  return [...list, id];
}
