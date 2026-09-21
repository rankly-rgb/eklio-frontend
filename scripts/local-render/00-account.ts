/*
 * Le compte de test : une thérapeute EMDR, le burnout au retour au travail,
 * qui prend de nouveaux clients.
 *
 * Tout ce qui suit passe par les tables et les RPC du produit. Deux lignes
 * sont posées directement parce que leur seule autorité d'écriture est
 * ailleurs et n'a pas sa place ici :
 *   * `auth.users`  — GoTrue, absent de ce bac à sable ;
 *   * `comp_grants` — la table des comptes offerts, écrite à la main par
 *                     construction (c'est ce que « granted_by » veut dire).
 *
 * La ligne `brand_kits`, elle, n'est PAS posée ici : elle est écrite par
 * `/api/briefs/[id]/generate`, qui est le seul insert de kit du dépôt.
 */
import { admin, untypedTable, TEST_EMAIL } from "./lib";

const PRACTICE = "Rowan Mercier Therapy";

async function main() {
  const db = admin();

  /* ── 1. L'utilisatrice, déjà posée par 00-account.sql ─────────────── */
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id")
    .eq("email", TEST_EMAIL)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    throw new Error(
      `No account for ${TEST_EMAIL}. Run scripts/local-render/00-account.sql first — ` +
        "auth.users and comp_grants are the two rows the product does not write."
    );
  }
  const userId = profile.id;
  console.log(`▸ user            ${userId}`);

  /* ── 2. Le projet ──────────────────────────────────────────────────── */
  const { data: found } = await db
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", PRACTICE)
    .maybeSingle();
  const project =
    found ??
    (await db.from("projects").insert({ user_id: userId, name: PRACTICE }).select("id").single()).data;
  if (!project) throw new Error("no project");
  console.log(`▸ project         ${project.id}`);

  /* ── 3. Le brief, les sept étapes remplies ─────────────────────────── */
  const { error: briefError } = await db.from("project_briefs").upsert({
    project_id: project.id,
    progress_step: 7,
    completed_steps: [1, 2, 3, 4, 5, 6, 7],
    practice_name: PRACTICE,
    city: "Oakland",
    state: "CA",
    license_type_id: "lmft",
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
    positioning:
      "EMDR for people who went back to work and found they could not switch off again.",
    usp_statement:
      "I work with people whose first week back at work told them something their last two years did not.",
    referral_quote:
      "She was the first person who did not tell me I was lucky to have the job.",
    prior_career: "Ten years in hospital administration before I retrained.",
    prior_career_public: true,
    data: {},
  }, { onConflict: "project_id" });
  if (briefError) throw briefError;
  console.log("▸ brief           7 steps, EMDR · burnout on the way back to work · Oakland CA");

  /* ── 4. Ses segments ───────────────────────────────────────────────── */
  const segments: string[] = [];
  for (const persona of ["high_functioning", "crossroads"]) {
    /*
     * ⚠ PAS D'`upsert` ICI. `content_segments` porte DEUX index uniques
     * partiels — un pour l'État nommé, un pour l'État absent — et PostgREST
     * ne sait viser ni l'un ni l'autre par `on_conflict`. Lire puis écrire
     * est ce que la forme de l'index permet.
     */
    const { data: seen } = await untypedTable<{ id: string }>(db, "content_segments")
      .select("id")
      .eq("modality_id", "emdr")
      .eq("persona_id", persona)
      .eq("state_code", "CA")
      .maybeSingle();
    const data =
      seen ??
      (await untypedTable<{ id: string }>(db, "content_segments")
        .insert({ modality_id: "emdr", persona_id: persona, state_code: "CA" })
        .select("id")
        .single()).data;
    if (!data) throw new Error("no segment");
    segments.push(data.id);
    console.log(`▸ segment         emdr · ${persona} · CA  ${data.id}`);
  }

  console.log("\n✓ account ready. Next: the kit, through /api/briefs/[id]/generate.");
  console.log(`  project ${project.id}`);
  console.log(`  segments ${segments.join(" ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
