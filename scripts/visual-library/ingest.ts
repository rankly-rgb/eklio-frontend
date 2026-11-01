/*
 * Dépose la bibliothèque de visuels dans `content-assets/library/<famille>/<id>.<ext>`.
 *
 *   bun scripts/visual-library/ingest.ts                 # plan à blanc : ce qui partirait
 *   bun scripts/visual-library/ingest.ts --confirm       # dépose (base LOCALE seulement)
 *   bun scripts/visual-library/ingest.ts --confirm --allow-remote-storage
 *
 * ⚠ RELANÇABLE. Seuls les fichiers absents du seau, ou dont le MD5 diffère de
 * l'eTag de leur objet, partent (`lib/visual-library/ingest.ts`). Une seconde exécution sans
 * changement ne dépose rien.
 *
 * ⚠ UNE URL QUI N'EST PAS LOCALE EST REFUSÉE sans `--allow-remote-storage`,
 * même à blanc. Aucune valeur par défaut, aucune variable ne lève ce verrou :
 * déposer en production est un geste écrit à la main.
 *
 * Demande NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import { depositBytes, FAMILIES, type Inventory } from "@/lib/visual-library/inventory";
import { ingest } from "@/lib/visual-library/ingest";

const BUCKET = "content-assets";
const args = new Set(process.argv.slice(2));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises — rien n'a été déposé");
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\b/.test(url);
if (!local && !args.has("--allow-remote-storage")) {
  throw new Error(`${url} n'est pas local : --allow-remote-storage est exigé — rien n'a été déposé`);
}

const root = join(import.meta.dirname, "..", "..");
const inventory = inventoryJson as Inventory;
const db = createClient(url, key, { auth: { persistSession: false } });
const bucket = db.storage.from(BUCKET);

const outcome = await ingest(
  {
    async existing() {
      /* ⚠ L'eTag est le MD5 du contenu pour un dépôt en une partie ; les guillemets sont retirés. */
      const out = new Map<string, string>();
      for (const family of Object.values(FAMILIES)) {
        const { data, error } = await bucket.list(`library/${family}`, { limit: 1000 });
        if (error) throw new Error(`content-assets list library/${family} : ${error.message}`);
        for (const o of data ?? []) {
          const etag = String((o.metadata as { eTag?: string } | null)?.eTag ?? "").replace(/"/g, "");
          if (etag) out.set(`library/${family}/${o.name}`, etag);
        }
      }
      return out;
    },
    async upload(path, bytes, contentType) {
      const { error } = await bucket.upload(path, bytes, { contentType, upsert: true });
      return error?.message ?? null;
    },
    bytesOf: (entry) => depositBytes(entry.file, readFileSync(join(root, entry.file))),
  },
  inventory,
  { dryRun: !args.has("--confirm") }
);

console.log(
  JSON.stringify(
    { dryRun: !args.has("--confirm"), uploaded: outcome.uploaded.length, skipped: outcome.skipped, failed: outcome.failed },
    null,
    2
  )
);
if (outcome.failed.length > 0) process.exit(1);
