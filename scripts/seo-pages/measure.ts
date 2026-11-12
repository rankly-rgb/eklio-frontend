/*
 * ⚠ HARNAIS — mesure les pièces de la base LOCALE, sans appel de modèle.
 *
 * Pour chaque pièce dont l'abonnée est dans `--users` (préfixe d'identifiant) :
 * passage du premier coup, contrôles du premier et du dernier passage (avec leur
 * détail, qui cite la phrase en cause), coût, et distance (shingles de 5 racines,
 * la mesure des gates) à la pièce la plus proche — chez elle, et chez les autres.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=… bun scripts/seo-pages/measure.ts --users 5e5e0001 [--since <iso>] --out <json>
 */
import { writeFileSync } from "node:fs";
import { arg, LOCAL } from "./session";

process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL;
const prefix = arg("--users") ?? "";
const since = arg("--since");
const { createAdminClient } = await import("@/lib/supabase/server");
const { seoDb } = await import("@/lib/seo/db");
const { similarityTo } = await import("@/lib/seo/gates");

const db = seoDb(createAdminClient());
const { data: pieces, error } = await db
  .from("seo_pieces")
  .select("id, user_id, target_id, month, kind, status, title, body_md, faq, cost_usd, gates_report, created_at")
  .order("created_at");
if (error) throw new Error(error.message);
const { data: targets } = await db.from("seo_targets").select("id, intent_key, primary_query");
const intent = new Map((targets ?? []).map((t: { id: string; intent_key: string }) => [t.id, t.intent_key]));

type P = { id: string; user_id: string; target_id: string; month: string; kind: string; status: string; title: string | null; body_md: string | null; faq: Array<{ question: string; answer: string }> | null; cost_usd: number; gates_report: Record<string, unknown>; created_at: string };
const all = (pieces ?? []) as P[];
const text = (p: P) => `${p.body_md ?? ""}\n${(p.faq ?? []).map((f) => `${f.question} ${f.answer}`).join("\n")}`;
const comparable = all.filter((p) => p.body_md);

const rows = all
  .filter((p) => p.user_id.startsWith(prefix) && (!since || p.created_at >= since))
  .map((p) => {
    const own = comparable.filter((o) => o.user_id === p.user_id && o.id !== p.id);
    const others = comparable.filter((o) => o.user_id !== p.user_id);
    const nearest = (set: P[]) => {
      if (!p.body_md || set.length === 0) return null;
      const scores = similarityTo(text(p), set.map((o) => ({ id: o.id, text: text(o) })));
      const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
      const o = set.find((x) => x.id === best.id)!;
      return { score: Number(best.score.toFixed(4)), user: o.user_id.slice(-2), intent: intent.get(o.target_id) };
    };
    const g = p.gates_report as { first_pass?: boolean; attempts?: number; first_findings?: Array<{ check: string; detail: string }>; final_findings?: Array<{ check: string; detail: string }> };
    return {
      user: p.user_id.slice(-2),
      month: p.month,
      kind: p.kind,
      intent: intent.get(p.target_id),
      status: p.status,
      firstPass: g.first_pass ?? null,
      attempts: g.attempts ?? null,
      first: g.first_findings ?? [],
      final: g.final_findings ?? [],
      costUsd: Number(p.cost_usd),
      nearestOwn: nearest(own),
      nearestOther: nearest(others),
    };
  });

const out = arg("--out");
if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
for (const r of rows) {
  console.log(
    `${r.user} ${r.month} ${r.kind.padEnd(10)} ${String(r.intent).padEnd(42)} ${r.status.padEnd(12)} first=${r.firstPass} att=${r.attempts} $${r.costUsd.toFixed(4)} own=${r.nearestOwn?.score ?? "-"} other=${r.nearestOther?.score ?? "-"}(${r.nearestOther?.user ?? ""} ${r.nearestOther?.intent ?? ""})`
  );
  for (const f of r.first) console.log(`      first: [${f.check}] ${f.detail.slice(0, 260)}`);
  if (r.status === "quarantined") for (const f of r.final) console.log(`      final: [${f.check}] ${f.detail.slice(0, 260)}`);
}
