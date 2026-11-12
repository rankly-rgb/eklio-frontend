import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEO_COLUMNS, SEO_RPC_ARGS } from "@/lib/seo/db";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES RPC SEO CONTRE LEUR SIGNATURE SQL — LE CONTRÔLEUR QUE LES TYPES NE PEUVENT PAS ÊTRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `lib/__tests__/rpc-signatures.test.ts` compare chaque `rpc("nom", {...})` aux
 * `Args` de `types/supabase.ts`. Les trois RPC SEO n'y sont pas encore (types non
 * régénérés, voir `lib/seo/db.ts`) ; elles passent donc par `seoRpc`, et ce test
 * prend le relais en lisant la SOURCE elle-même : la migration du backend.
 *
 * ⚠ IL LIT `../eklio-backend`, comme onze autres tests (la CI le clone à côté,
 * sur `main`). Tant que la migration n'est pas sur `main`, le fichier est absent
 * de ce clone : le test est alors SAUTÉ, et le dit par son nom — jamais vert à vide.
 */
const DIR = resolve(__dirname, "../../../../eklio-backend/supabase/migrations");
const MIGRATION = resolve(DIR, "20261112102000_seo_quota_chokepoint.sql");
const present = existsSync(MIGRATION);

function sqlArgs(sql: string, fn: string): string[] {
  const m = new RegExp(`create or replace function public\\.${fn}\\(([^)]*)\\)`, "i").exec(sql);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((p) => p.trim().split(/\s+/)[0])
    .filter(Boolean);
}

describe.skipIf(!present)("les RPC SEO correspondent à leur signature SQL (migration absente : sauté)", () => {
  const sql = present ? readFileSync(MIGRATION, "utf8") : "";

  it.each(Object.entries(SEO_RPC_ARGS))("%s", (fn, args) => {
    const declared = sqlArgs(sql, fn);
    expect(declared.length, `${fn} introuvable dans la migration`).toBeGreaterThan(0);
    expect([...args]).toEqual(declared);
  });
});

/** Les colonnes d'une table : son `create table`, puis ses `add column`. */
function sqlColumns(sql: string, table: string): string[] {
  const create = new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  const cols = create
    ? create[1]
        .split("\n")
        .map((l) => /^\s{2}([a-z_0-9]+)\s+(uuid|text|date|jsonb|numeric|timestamptz|integer|smallint|boolean)/.exec(l)?.[1])
        .filter((c): c is string => Boolean(c))
    : [];
  for (const m of sql.matchAll(new RegExp(`alter table public\\.${table} add column if not exists ([a-z_0-9]+)`, "g"))) cols.push(m[1]);
  return cols;
}

describe.skipIf(!present)("les colonnes SEO écrites existent en SQL (migrations absentes : sauté)", () => {
  const sql = present
    ? ["20261112100000_seo_targets_templates_metrics.sql", "20261112101000_seo_pieces_review_lifecycle.sql", "20261112102000_seo_quota_chokepoint.sql"]
        .map((f) => readFileSync(resolve(DIR, f), "utf8"))
        .join("\n")
    : "";

  it.each(Object.entries(SEO_COLUMNS))("%s", (table, columns) => {
    expect([...columns].sort()).toEqual(sqlColumns(sql, table).sort());
  });
});
