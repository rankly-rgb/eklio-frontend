import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEO_RPC_ARGS } from "@/lib/seo/db";

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
const MIGRATION = resolve(
  __dirname,
  "../../../../eklio-backend/supabase/migrations/20261112102000_seo_quota_chokepoint.sql"
);
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
