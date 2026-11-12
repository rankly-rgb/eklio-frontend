/*
 * ⚠ HARNAIS — exporte en Markdown, par la fonction PRODUIT (`exportMarkdown`),
 * les pièces d'une abonnée de la base LOCALE, vers SAMPLES/. Chaque fichier porte
 * dans son nom ET en première ligne qu'il vient du vrai chemin produit.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=… bun scripts/seo-pages/export-samples.ts <user_id> <month> <licence mention>
 */
import { writeFileSync } from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
const [userId, month, mention] = process.argv.slice(2);
if (!userId || !month || !mention) throw new Error("usage: <user_id> <month> <licence mention>");

const { createAdminClient } = await import("@/lib/supabase/server");
const { PIECE_COLUMNS, pieceRowSchema, seoDb } = await import("@/lib/seo/db");
const { exportMarkdown, internalLinksFor } = await import("@/lib/seo/derive");

const db = seoDb(createAdminClient());
const { data, error } = await db
  .from("seo_pieces")
  .select(PIECE_COLUMNS)
  .eq("user_id", userId)
  .eq("month", month)
  .neq("status", "quarantined")
  .order("created_at");
if (error) throw new Error(error.message);

const pieces = (data ?? []).map((r: unknown) => pieceRowSchema.parse(r));
for (const [i, p] of pieces.entries()) {
  const author = (p.schema_jsonld?.author as { name?: string } | undefined)?.name ?? "";
  const md = exportMarkdown({
    kind: p.kind,
    title: p.title ?? "",
    meta: p.meta_description ?? "",
    slug: p.slug ?? "",
    h1: p.h1 ?? "",
    bodyMd: p.body_md ?? "",
    faq: p.faq ?? [],
    schemaJsonLd: p.schema_jsonld ?? {},
    internalLinks: internalLinksFor(p.id, pieces, null),
    byline: `By ${author}, ${mention}`,
  });
  const file = `SAMPLES/REAL-PRODUCT-PATH_${month}_${i + 1}_${p.kind}_${p.slug}.md`;
  const head =
    `<!-- SOURCE: REAL PRODUCT PATH — cron route → claim_seo_slot → SEO writer (OpenAI ${p.writer_model}) → checks → seo_pieces, ` +
    `LOCAL database, ${new Date().toISOString().slice(0, 10)}. Status: ${p.status}. Cost: $${p.cost_usd.toFixed(4)}. NOT a fixture. -->\n`;
  writeFileSync(file, head + md);
  console.log(file);
}
