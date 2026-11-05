/*
 * ══════════════════════════════════════════════════════════════════════════
 *  CE QUE LES TROIS SCRIPTS D'EXPLOITATION PARTAGENT (2026-11-05)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ils sont lancés par Naima, sur la production, avec SES identifiants. Ils
 * lisent ces identifiants dans l'environnement EXPLICITE et jamais ailleurs :
 * pas de repli sur `.env.local`, qui viserait la base locale sans le dire.
 *
 * ⚠ SIMULATION PAR DÉFAUT. Un script n'écrit que s'il reçoit `--write`.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/supabase";
import { MONTH_LIMITS } from "../../../lib/content/month-checks";
import { POSTS_PER_MONTH } from "../../../lib/content/bank";

export type Db = ReturnType<typeof createClient<Database>>;

export const flag = (name: string) => process.argv.includes(name);
export const option = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
};

export function refuse(why: string): never {
  console.error(`\n✗ REFUS AVANT TOUT APPEL — ${why}\n  Rien n'a été écrit, rien n'a été dépensé.\n`);
  process.exit(2);
}

/** Les variables requises, lues dans l'environnement explicite ; refus nominatif si l'une manque. */
export function requireEnv(names: string[]): Record<string, string> {
  const missing = names.filter((n) => !process.env[n] || !process.env[n]!.trim());
  if (missing.length) refuse(`variable(s) d'environnement absente(s) : ${missing.join(", ")} (voir RUNBOOK.md)`);
  return Object.fromEntries(names.map((n) => [n, process.env[n]!.trim()]));
}

export function production(): Db {
  const env = requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (/127\.0\.0\.1|localhost/.test(env.NEXT_PUBLIC_SUPABASE_URL) && !flag("--allow-local")) {
    refuse(`NEXT_PUBLIC_SUPABASE_URL vise une base locale (${env.NEXT_PUBLIC_SUPABASE_URL}) ; ajoutez --allow-local si c'est voulu`);
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** Les deux migrations du 2026-11-01/02 sont-elles en base ? Une lecture des colonnes suffit. */
export async function requireMigrations(db: Db): Promise<void> {
  const { error } = await db.from("content_items").select("illustration_key, card_ground").limit(1);
  if (error) refuse(`les migrations 20261101090000 / 20261102090000 manquent en base (${error.message})`);
}

export async function requireKit(db: Db, kitId: string | null) {
  if (!kitId) refuse("--kit <brand_kit_id> est obligatoire (le constat les liste)");
  const { data, error } = await db.from("brand_kits").select("id, project_id, selected_direction_id, directions").eq("id", kitId).maybeSingle();
  if (error) refuse(`lecture du kit : ${error.message}`);
  if (!data) refuse(`aucun kit ${kitId}`);
  return data;
}

/*
 * ── LES PLANCHERS DU BANC, LUS AVANT D'ÉCRIRE ───────────────────────────
 *
 * Au moins 55 candidats tirables pour 30 posts, et une marge de posts à
 * PHRASE d'au moins +2. La marge : au plus 10 phrases seules (35 %) et 9
 * carrousels (30 %) — la carte praticienne ne sort plus (F135) —, pour
 * `30 − 14` posts à phrase nécessaires sous le plafond de listes.
 */
export const MIN_CANDIDATES = 55;
export const MIN_PHRASE_MARGIN = 2;

export async function bankFloors(db: Db, kitId: string) {
  const { data, error } = await db.rpc("drawable_count_for_kit", { p_brand_kit_id: kitId });
  if (error) refuse(`drawable_count_for_kit : ${error.message}`);
  const by = Object.fromEntries((data ?? []).map((r) => [r.archetype_key, Number(r.drawable)])) as Record<string, number>;
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const n = POSTS_PER_MONTH;
  const singles = Math.min(by.single_statement ?? 0, Math.floor(n * (MONTH_LIMITS.archetypeShareCaps.single_statement ?? MONTH_LIMITS.maxArchetypeShare)));
  const carousels = Math.min(by.carousel ?? 0, Math.floor(n * MONTH_LIMITS.maxArchetypeShare));
  const needed = n - Math.floor(n * MONTH_LIMITS.maxListShare);
  const margin = singles + carousels - needed;
  const failing: string[] = [];
  if (total < MIN_CANDIDATES) failing.push(`candidats tirables ${total} < ${MIN_CANDIDATES}`);
  if (margin < MIN_PHRASE_MARGIN) failing.push(`marge de posts à phrase ${margin >= 0 ? "+" : ""}${margin} < +${MIN_PHRASE_MARGIN} (phrases seules ${singles}, carrousels ${carousels}, nécessaires ${needed})`);
  return { by, total, singles, carousels, needed, margin, failing };
}

export function table(rows: Array<Record<string, unknown>>): void {
  if (!rows.length) return console.log("  (rien)");
  const keys = Object.keys(rows[0]);
  const w = keys.map((k) => Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)));
  console.log("  " + keys.map((k, i) => k.padEnd(w[i])).join("  "));
  for (const r of rows) console.log("  " + keys.map((k, i) => String(r[k] ?? "").padEnd(w[i])).join("  "));
}
