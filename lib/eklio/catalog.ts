import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Card = { id: string; label: string; description: string; sort_order: number };
export type Specialty = { id: string; label: string; sort_order: number };
export type ToneCard = { id: string; keywords: string[]; sample_hero: string; sort_order: number };
export type PaletteFamily = {
  id: string;
  label: string;
  primary_hex: string;
  secondary_hex: string;
  light_hex: string;
  dark_hex: string;
  paper_hex: string;
  accent_hex: string;
  swatches: string[];
  sort_order: number;
};
export type TypePairing = {
  id: string;
  heading_font: string;
  body_font: string;
  google_fonts_url: string;
  sort_order: number;
};
export type BuilderTarget = {
  id: string;
  label: string;
  accepts_prompt: boolean | null;
  output_kind: string;
  sort_order: number;
};

export type BriefCatalog = {
  licenseTypes: Card[];
  specialties: Specialty[];
  personas: Card[];
  problems: Card[];
  gains: Card[];
  tones: ToneCard[];
  palettes: PaletteFamily[];
  typePairings: TypePairing[];
  siteGoals: Card[];
  primaryActions: { id: string; label: string; sort_order: number }[];
  builderTargets: BuilderTarget[];
};

/**
 * Les onze catalogues, en une passe.
 *
 * ⚠ On filtre `active = true` ICI, à l'affichage, et nulle part ailleurs. La
 * policy de lecture ne filtre pas dessus exprès : un brief qui a choisi une
 * carte depuis retirée doit continuer à la résoudre, sinon sa preview perd sa
 * palette en silence.
 */
export async function loadBriefCatalog(): Promise<BriefCatalog> {
  const supabase = await createClient();
  const active = <T>(q: PromiseLike<{ data: T[] | null }>) => q;

  const [
    licenseTypes,
    specialties,
    personas,
    problems,
    gains,
    tones,
    palettes,
    typePairings,
    siteGoals,
    primaryActions,
    builderTargets,
  ] = await Promise.all([
    active(supabase.from("license_types").select("id,label,description,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("specialties").select("id,label,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("client_persona_cards").select("id,label,description,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("problem_cards").select("id,label,description,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("gain_cards").select("id,label,description,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("tone_cards").select("id,keywords,sample_hero,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("palette_families").select("id,label,primary_hex,secondary_hex,light_hex,dark_hex,paper_hex,accent_hex,swatches,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("type_pairings").select("id,heading_font,body_font,google_fonts_url,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("site_goals").select("id,label,description,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("primary_actions").select("id,label,sort_order").eq("active", true).order("sort_order")),
    active(supabase.from("builder_targets").select("id,label,accepts_prompt,output_kind,sort_order").eq("active", true).order("sort_order")),
  ]);

  return {
    licenseTypes: (licenseTypes.data ?? []) as Card[],
    specialties: (specialties.data ?? []) as Specialty[],
    personas: (personas.data ?? []) as Card[],
    problems: (problems.data ?? []) as Card[],
    gains: (gains.data ?? []) as Card[],
    tones: (tones.data ?? []) as ToneCard[],
    palettes: (palettes.data ?? []) as PaletteFamily[],
    typePairings: (typePairings.data ?? []) as TypePairing[],
    siteGoals: (siteGoals.data ?? []) as Card[],
    primaryActions: (primaryActions.data ?? []) as { id: string; label: string; sort_order: number }[],
    builderTargets: (builderTargets.data ?? []) as BuilderTarget[],
  };
}
