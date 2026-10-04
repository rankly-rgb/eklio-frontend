/*
 * ── LE COMPTE DE TEST, SUR LA BASE LOCALE ───────────────────────────────
 *
 * ⚠ CE QUI NE PASSE PAS PAR LE PRODUIT, ET POURQUOI — c'est la liste que
 * l'étiquette de la planche reprend :
 *
 *   auth.users, comp_grants,     `00-account.sql`, comme toujours : GoTrue n'existe
 *   verified_at local            pas ici, et la date de vérification d'un board est
 *                                un acte humain, signé « LOCAL » dans la ligne.
 *   le kit                       la route `/api/briefs/[id]/generate` demande Next
 *                                et un modèle ; Next n'est pas installable (registre
 *                                npm refusé). Le kit est posé ici SANS directions ; la
 *                                palette du mois est celle des épreuves de
 *                                l'orchestrateur, passée par le lanceur. Le mois ne
 *                                lit pas les directions du kit.
 *   préférences, bilan           mêmes valeurs que `05-kit.ts`, écrites en table au
 *                                lieu de passer par leurs routes.
 *
 * Le brief et les segments sont ceux de `00-account.ts`, mot pour mot.
 *
 *   bun scripts/production-path/openai-month/setup.ts --email x@eklio-test.invalid --month 2026-11-01
 */
import { localDb } from "../local-db";
import { arg } from "./session";

const EMAIL = arg("--email") ?? "openai-month@eklio-test.invalid";
const MONTH = arg("--month") ?? "2026-11-01";
const PRACTICE = "Rowan Mercier Therapy";

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function main() {
  const db = localDb();
  const profile = await must("profiles", db.from("profiles").select("id").eq("email", EMAIL).maybeSingle()) as { id: string } | null;
  if (!profile) throw new Error(`aucun compte pour ${EMAIL} : lancer d'abord 00-account.sql`);
  const userId = profile.id;

  const found = await must("projects", db.from("projects").select("id").eq("user_id", userId).eq("name", PRACTICE).maybeSingle()) as { id: string } | null;
  const project = found ?? (await must("projects insert", db.from("projects").insert({ user_id: userId, name: PRACTICE }).select("id").single()) as { id: string });

  await must("project_briefs", db.from("project_briefs").upsert({
    project_id: project.id,
    progress_step: 7,
    completed_steps: [1, 2, 3, 4, 5, 6, 7],
    practice_name: PRACTICE,
    city: "Oakland",
    state: "CA",
    license_type_id: "lmft",
    license_number: "123456",
    license_state_code: "CA",
    degree_id: "ma",
    tone_card_id: "quiet_confidence",
    type_pairing_id: "newsreader_work",
    palette_family_ids: ["clay_sand", "olive_chalk"],
    modality_ids: ["emdr"],
    modality_prominence: "lead_with_it",
    client_persona_ids: ["high_functioning", "crossroads"],
    problem_card_ids: ["cant_switch_off", "running_on_empty", "past_still_here"],
    gain_card_ids: ["rest_without_guilt", "steadier_reactions", "a_name_for_it"],
    specialty_ids: ["burnout", "trauma", "anxiety", "life_transitions"],
    session_style_ids: ["asks_questions", "direct", "body"],
    not_a_fit_ids: ["court_ordered", "higher_level_care", "med_management"],
    not_a_fit_text: "Anyone who needs weekly medication management or a higher level of care.",
    site_goal_ids: ["book_consults", "explain_approach", "attract_better_fit"],
    site_platform_id: "squarespace",
    builder_target_id: "squarespace",
    primary_action_id: "free_call",
    positioning: "EMDR for people who went back to work and found they could not switch off again.",
    usp_statement: "I work with people whose first week back at work told them something their last two years did not.",
    referral_quote: "She was the first person who did not tell me I was lucky to have the job.",
    prior_career: "Ten years in hospital administration before I retrained.",
    prior_career_public: true,
    data: {},
  }, { onConflict: "project_id" }));

  const segments: string[] = [];
  for (const persona of ["high_functioning", "crossroads"]) {
    const seen = await must("content_segments", db.from("content_segments").select("id")
      .eq("modality_id", "emdr").eq("persona_id", persona).eq("state_code", "CA").maybeSingle()) as { id: string } | null;
    const seg = seen ?? (await must("content_segments insert", db.from("content_segments")
      .insert({ modality_id: "emdr", persona_id: persona, state_code: "CA" }).select("id").single()) as { id: string });
    segments.push(seg.id);
  }

  const kitFound = await must("brand_kits", db.from("brand_kits").select("id").eq("project_id", project.id).maybeSingle()) as { id: string } | null;
  /*
   * ⚠ SANS DIRECTIONS, EXPRÈS. La base exige trois directions complètes (héros,
   * palette, polices, mots-clés) que seule la génération de kit écrit ; les
   * inventer ici fabriquerait un kit. Le mois ne lit pas les directions : sa
   * palette est passée par le lanceur, et l'étiquette de la planche le dit.
   */
  const kit = kitFound ?? (await must("brand_kits insert", db.from("brand_kits").insert({
    project_id: project.id,
    tier: "starter",
    content: {},
  }).select("id").single()) as { id: string });

  await must("content_preferences", db.from("content_preferences").upsert({
    brand_kit_id: kit.id,
    cadence_per_week: 3,
    accepted_registers: ["named_feeling", "reflective_question", "how_the_work_works", "permission", "practical_note", "seasonal_note"],
    off_limits: "No clinical claims, no client stories, no before-and-after.",
  }, { onConflict: "brand_kit_id" }));

  await must("content_checkins", db.from("content_checkins").upsert({
    brand_kit_id: kit.id,
    month: MONTH,
    sessions_theme:
      "a lot of returning-to-work burnout this month — people who went back after leave and " +
      "found their body had not agreed to it, and who read that as failure",
    taking_clients: "yes",
    happening: "Evening slots opening in October",
  }, { onConflict: "brand_kit_id,month" }));

  console.log(JSON.stringify({ userId, projectId: project.id, kitId: kit.id, segments, month: MONTH }, null, 2));
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
