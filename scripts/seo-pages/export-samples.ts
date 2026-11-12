/*
 * ⚠ HARNAIS — exporte en Markdown, par la fonction PRODUIT (`exportMarkdown`),
 * les pièces d'une abonnée de la base LOCALE, vers SAMPLES/. Chaque fichier porte
 * dans son nom ET en première ligne qu'il vient du vrai chemin produit.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=… bun scripts/seo-pages/export-samples.ts <user_id> <month> <profile> [<prefix>]
 *
 * La mention de licence est calculée par le code produit (`licenceFacts` +
 * `licenceMention`), comme l'écran l'affiche — jamais passée à la main.
 */
import { writeFileSync } from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
const [userId, month, profile, prefix = "SAMPLES/session-2"] = process.argv.slice(2);
if (!userId || !month || !profile) throw new Error("usage: <user_id> <month> <profile> [<prefix>]");

const { createAdminClient } = await import("@/lib/supabase/server");
const { PIECE_COLUMNS, pieceRowSchema, seoDb } = await import("@/lib/seo/db");
const { bylineFromStored, exportMarkdown, internalLinksFor } = await import("@/lib/seo/derive");
const { latestKitFor } = await import("@/lib/seo/context");
const { serverPreflightPort } = await import("@/lib/content/month/server-ports");
const { licenceMention } = await import("@/lib/content/licence");

const db = seoDb(createAdminClient());
const kit = await latestKitFor(db, userId);
const mention = kit ? licenceMention(await serverPreflightPort(db as never).licenceFacts(kit.projectId)) : null;
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
    byline: bylineFromStored(p.schema_jsonld, mention) ?? "",
  });
  const file = `${prefix}/REAL-PRODUCT-PATH_profile-${profile}_${month}_${i + 1}_${p.kind}_${p.slug}.md`;
  const head =
    `<!-- SOURCE: REAL PRODUCT PATH — claim_seo_slot → SEO writer (OpenAI ${p.writer_model}) → checks → seo_pieces, ` +
    `LOCAL database. Profile ${profile}, month ${month}. Status: ${p.status}. Cost: $${p.cost_usd.toFixed(4)}. NOT a fixture. -->\n`;
  writeFileSync(file, head + md);
  console.log(file);
}
