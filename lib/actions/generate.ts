"use server";

import { revalidatePath } from "next/cache";

import { generateDirections, type BriefFacts, type EthicsRule, type TypePairingChoice } from "@/lib/ai/directions";
import { runEthicsGuard } from "@/lib/ai/ethics";
import {
  FALLBACK_DIRECTION_LIMITS,
  validateDirections,
  type DirectionLimits,
  type GeneratedDirection,
} from "@/lib/ai/limits";
import { consumeGenerationCredit } from "@/lib/eklio/rpc";
import { getOrCreateBrandKit, getOrCreateWorkspace } from "@/lib/eklio/project";
import { createClient } from "@/lib/supabase/server";

export type GenerateResult =
  | { ok: true; brandKitId: string }
  | { ok: false; reason: "no_credit" | "no_workspace" | "generation_failed" | "write_failed"; detail?: string };

/**
 * Un run de génération, de bout en bout.
 *
 * L'ordre compte : le crédit est pris JUSTE avant l'appel au modèle, par la
 * fonction qui prend le verrou de ligne. Lire les compteurs et décider soi-même
 * serait une course que deux POST concurrents gagneraient tous les deux.
 */
export async function generate(): Promise<GenerateResult> {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) return { ok: false, reason: "no_workspace" };

  const brandKitId = workspace.brandKitId ?? (await getOrCreateBrandKit(workspace.projectId));
  if (!brandKitId) return { ok: false, reason: "no_workspace" };

  const supabase = await createClient();

  const [{ data: catalog }, { data: rules }, { data: pairings }, brief] = await Promise.all([
    supabase.rpc("site_catalog"),
    supabase
      .from("ethics_rules")
      .select("id,short_label,description,example_forbidden")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("type_pairings")
      .select("id,heading_font,body_font,google_fonts_url")
      .eq("active", true)
      .order("sort_order"),
    loadBriefFacts(workspace.projectId),
  ]);

  const limits =
    ((catalog as { direction_limits?: DirectionLimits } | null)?.direction_limits) ??
    FALLBACK_DIRECTION_LIMITS;

  const pairingRows = (pairings ?? []) as (TypePairingChoice & { google_fonts_url: string })[];
  if (pairingRows.length < limits.directions_count) {
    return { ok: false, reason: "generation_failed", detail: "Not enough type pairings in the catalog." };
  }

  // ⚠ Le péage. Après cette ligne, un run est dépensé.
  const allowed = await consumeGenerationCredit(brandKitId);
  if (!allowed) return { ok: false, reason: "no_credit" };

  const result = await generateDirections({
    brief,
    limits,
    pairings: pairingRows.map(({ id, heading_font, body_font }) => ({ id, heading_font, body_font })),
    rules: (rules ?? []) as EthicsRule[],
  });

  if ("error" in result) {
    return { ok: false, reason: "generation_failed", detail: result.error };
  }

  const { generation } = result;

  // Le garde relit ce qui sera lu par une visiteuse : les héros, les About,
  // et la ligne de signature. Les rationales sont de la copie interne à la
  // carte de reveal, mais elles se retrouvent sous ses yeux, donc elles passent
  // aussi.
  const fields: Record<string, string> = { practitioner_line: generation.practitioner_line };
  generation.directions.forEach((d, i) => {
    fields[`directions[${i}].hero.headline`] = d.hero.headline;
    fields[`directions[${i}].hero.subhead`] = d.hero.subhead;
    fields[`directions[${i}].about_excerpt`] = d.about_excerpt;
    fields[`directions[${i}].rationale`] = d.rationale;
  });

  const { check, rewrites } = await runEthicsGuard(fields, (rules ?? []) as EthicsRule[], {
    "hero.headline": limits.hero_headline,
    "hero.subhead": limits.hero_subhead,
    rationale: limits.rationale_max,
  });

  const directions = generation.directions.map((d, i) => {
    const pairing = pairingRows.find((p) => p.id === d.type_pairing_id) ?? pairingRows[i];
    return {
      id: d.id,
      name: d.name,
      rationale: rewrites[`directions[${i}].rationale`] ?? d.rationale,
      about_excerpt: rewrites[`directions[${i}].about_excerpt`] ?? d.about_excerpt,
      palette: d.palette,
      typography: {
        heading_font: pairing.heading_font,
        body_font: pairing.body_font,
        google_fonts_url: pairing.google_fonts_url,
      },
      hero: {
        overline: d.hero.overline,
        headline: rewrites[`directions[${i}].hero.headline`] ?? d.hero.headline,
        subhead: rewrites[`directions[${i}].hero.subhead`] ?? d.hero.subhead,
        cta_label: d.hero.cta_label,
      },
      tone_keywords: d.tone_keywords,
    };
  });

  // ⚠ Une réécriture éthique peut dépasser une borne de rendu. On revalide, et
  // si une réécriture casse une limite on garde l'originale et le verdict passe
  // à false — plutôt que d'écrire un livrable que le CHECK refusera, ou de
  // prétendre qu'il est propre.
  const forCheck = directions.map((d, i) => ({
    ...d,
    type_pairing_id: generation.directions[i].type_pairing_id,
  })) as unknown as GeneratedDirection[];

  let ethicsCheck = check;
  let finalDirections = directions;
  const problems = validateDirections(forCheck, limits, pairingRows.map((p) => p.id));

  if (problems.length > 0) {
    finalDirections = generation.directions.map((d, i) => ({
      ...directions[i],
      rationale: d.rationale,
      about_excerpt: d.about_excerpt,
      hero: { ...directions[i].hero, headline: d.hero.headline, subhead: d.hero.subhead },
    }));
    ethicsCheck = { ...check, passed: false };
  }

  const { error } = await supabase
    .from("brand_kits")
    .update({
      directions: finalDirections,
      voice_guide: generation.voice_guide,
      practitioner_line: rewrites.practitioner_line ?? generation.practitioner_line,
      ethics_check: ethicsCheck,
    })
    .eq("id", brandKitId);

  if (error) return { ok: false, reason: "write_failed", detail: error.message };

  revalidatePath("/app/directions");
  return { ok: true, brandKitId };
}

async function loadBriefFacts(projectId: string): Promise<BriefFacts> {
  const supabase = await createClient();

  const { data: brief } = await supabase
    .from("project_briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const empty: BriefFacts = {
    practiceName: null, city: null, state: null, license: null, specialties: [],
    positioning: null, personas: [], problems: [], gains: [], toneKeywords: [],
    toneSample: null, palettes: [], siteGoals: [], primaryAction: null, builderTarget: null,
  };
  if (!brief) return empty;

  const labels = async (table: "specialties" | "client_persona_cards" | "problem_cards" | "gain_cards" | "site_goals", ids: string[]) => {
    if (ids.length === 0) return [];
    const { data } = await supabase.from(table).select("id,label").in("id", ids);
    // ⚠ On restitue l'ordre choisi par elle : `in` ne le garantit pas, et pour
    // les spécialités le premier élément est celui que la preview rend.
    return ids.map((id) => data?.find((r) => r.id === id)?.label).filter((l): l is string => Boolean(l));
  };

  const [specialties, personas, problems, gains, siteGoals] = await Promise.all([
    labels("specialties", brief.specialty_ids),
    labels("client_persona_cards", brief.client_persona_ids),
    labels("problem_cards", brief.problem_card_ids),
    labels("gain_cards", brief.gain_card_ids),
    labels("site_goals", brief.site_goal_ids),
  ]);

  const [{ data: tone }, { data: license }, { data: action }, { data: builder }, { data: palettes }] =
    await Promise.all([
      supabase.from("tone_cards").select("keywords,sample_hero").eq("id", brief.tone_card_id ?? "").maybeSingle(),
      supabase.from("license_types").select("label").eq("id", brief.license_type_id ?? "").maybeSingle(),
      supabase.from("primary_actions").select("label").eq("id", brief.primary_action_id ?? "").maybeSingle(),
      supabase.from("builder_targets").select("label").eq("id", brief.builder_target_id ?? "").maybeSingle(),
      brief.palette_family_ids.length
        ? supabase.from("palette_families").select("id,label,swatches").in("id", brief.palette_family_ids)
        : Promise.resolve({ data: [] as { id: string; label: string; swatches: string[] }[] }),
    ]);

  return {
    practiceName: brief.practice_name,
    city: brief.city,
    state: brief.state,
    license: license?.label ?? null,
    specialties,
    positioning: brief.positioning,
    personas,
    problems,
    gains,
    toneKeywords: tone?.keywords ?? [],
    toneSample: tone?.sample_hero ?? null,
    palettes: brief.palette_family_ids
      .map((id) => palettes?.find((p) => p.id === id))
      .filter((p): p is { id: string; label: string; swatches: string[] } => Boolean(p))
      .map((p) => ({ label: p.label, swatches: p.swatches })),
    siteGoals,
    primaryAction: action?.label ?? null,
    builderTarget: builder?.label ?? null,
  };
}
