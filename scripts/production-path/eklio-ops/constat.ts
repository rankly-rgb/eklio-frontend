/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE CONSTAT — LIT LA PRODUCTION, N'ÉCRIT RIEN (2026-11-05)
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   bun scripts/production-path/eklio-ops/constat.ts
 *
 * Aucun `--write` : ce script n'a pas de chemin d'écriture. Il affiche les
 * fiches, leur banc tirable et les planchers, leurs mois, la banque, et dit
 * lesquelles ressemblent à des fiches réelles et lesquelles à des fiches de
 * test — avec le critère, signal par signal, pour qu'on le corrige.
 */
import { bankFloors, production, requireMigrations, table } from "./common";

const db = production();
await requireMigrations(db);

const { data: kits } = await db.from("brand_kits").select("id, project_id, selected_direction_id, created_at").order("created_at");
const { data: projects } = await db.from("projects").select("id, user_id, name, status");
const { data: briefs } = await db.from("project_briefs").select("project_id, practice_name, license_number, state, city, modality_ids");
const { data: subs } = await db.from("subscriptions").select("user_id, status, stripe_subscription_id");
const { data: months } = await db.from("content_months").select("id, brand_kit_id, month, status");
const { count: topics } = await db.from("content_topics").select("id", { count: "exact", head: true });
const { count: segments } = await db.from("content_segments").select("id", { count: "exact", head: true });

/*
 * ── LE CRITÈRE « FICHE DE TEST », SIGNAL PAR SIGNAL ─────────────────────
 *
 *   e-mail     domaine d'exemple ou de test (example.*, test.*, *.test,
 *              mailinator…) ou « test » dans la partie locale ;
 *   licence    numéro de fixture : chiffres tous identiques, suite
 *              croissante (123456…) ou absent ;
 *   abonnement aucun abonnement `active`/`trialing` avec un identifiant Stripe.
 *
 * Verdict : « test » dès qu'un signal e-mail ou licence est levé ; « réelle »
 * si aucun ne l'est ET qu'un abonnement actif existe ; « indéterminée » sinon.
 */
const TEST_DOMAIN = /@(example\.|test\.|mailinator\.|.*\.test$|.*\.invalid$)/i;
const fixtureLicence = (n: string | null) => !n || /^(\d)\1+$/.test(n.replace(/\D/g, "")) || /1234/.test(n.replace(/\D/g, ""));

const rows: Array<Record<string, unknown>> = [];
for (const kit of kits ?? []) {
  const project = (projects ?? []).find((p) => p.id === kit.project_id);
  const brief = (briefs ?? []).find((b) => b.project_id === kit.project_id);
  const user = project?.user_id ? (await db.auth.admin.getUserById(project.user_id)).data.user : null;
  const email = user?.email ?? "";
  const sub = (subs ?? []).find((s) => s.user_id === project?.user_id && ["active", "trialing"].includes(String(s.status)) && s.stripe_subscription_id);
  const signals: string[] = [];
  if (TEST_DOMAIN.test(email) || /test/i.test(email.split("@")[0] ?? "")) signals.push("e-mail de test");
  if (fixtureLicence(brief?.license_number ?? null)) signals.push("licence de fixture ou absente");
  if (!sub) signals.push("pas d'abonnement actif");
  const verdict = signals.some((s) => s !== "pas d'abonnement actif") ? "test" : sub ? "réelle" : "indéterminée";
  const floors = await bankFloors(db, kit.id);
  const kitMonths = (months ?? []).filter((m) => m.brand_kit_id === kit.id);
  rows.push({
    kit: kit.id,
    cabinet: brief?.practice_name ?? "—",
    "état": brief?.state ?? "—",
    "e-mail": email ? email.replace(/^(.).*(@.*)$/, "$1…$2") : "—",
    verdict,
    signaux: signals.join(" ; ") || "aucun",
    "tirables": floors.total,
    "marge phrase": `${floors.margin >= 0 ? "+" : ""}${floors.margin}`,
    "banc": floors.failing.length ? `NON — ${floors.failing.join(" ; ")}` : "oui",
    mois: kitMonths.map((m) => `${m.month.slice(0, 7)}:${m.status}`).join(" ") || "aucun",
  });
}

console.log(`\nCONSTAT DE PRODUCTION — ${new Date().toISOString()}`);
console.log(`  kits ${kits?.length ?? 0} · fiches ${briefs?.length ?? 0} · abonnements ${subs?.length ?? 0} · sujets en banque ${topics ?? 0} · segments ${segments ?? 0} · mois ${months?.length ?? 0}\n`);
table(rows);
console.log(`\n  Critère « test » : e-mail de test, ou licence de fixture/absente. « réelle » : aucun des deux ET un abonnement actif.`);
console.log(`  Planchers du banc : au moins 55 candidats tirables, marge de posts à phrase au moins +2.\n`);
