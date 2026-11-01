import { createHash } from "node:crypto";
import type { Inventory, LibraryEntry } from "@/lib/visual-library/inventory";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'INGESTION DANS `content-assets/library/` — RELANÇABLE, SANS DOUBLON
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ LE MÊME PRINCIPE QUE `rendered_assets.content_hash` : l'identité d'un dépôt
 * est le hachage de son contenu, et un contenu déjà déposé ne repart pas.
 *
 * ⚠ PAS DE MANIFESTE AU SEAU, ET C'EST UNE CONTRAINTE, PAS UN CHOIX.
 * `content-assets` n'accepte que svg, png, jpeg et webp (`allowed_mime_types`) :
 * un `manifest.json` y serait refusé. Le stockage tient déjà, pour chaque objet,
 * l'empreinte de son contenu — son `eTag`, le MD5 des octets pour un dépôt en
 * une partie (tous les fichiers du pack font moins de 1 Mo). On compare donc le
 * MD5 des octets à déposer à celui que le seau rend : égal, rien ne part.
 *
 * ⚠ RIEN N'EST SUPPRIMÉ. Un fichier retiré du dossier sort de l'inventaire — le
 * moteur ne le tire plus — mais son objet reste au seau. Supprimer est une
 * décision, pas l'effet de bord d'une relance.
 */

export type IngestPort = {
  /** Ce que le seau porte déjà sous `library/` : chemin → MD5 du contenu (eTag). */
  existing(): Promise<Map<string, string>>;
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string | null>;
  /** Les octets à déposer pour une entrée (le SVG nettoyé, le JPEG tel quel). */
  bytesOf(entry: LibraryEntry): Uint8Array;
};

export type IngestOutcome = {
  uploaded: string[];
  skipped: number;
  failed: Array<{ path: string; why: string }>;
};

export function md5(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

/** Ce qui doit partir : les entrées absentes du seau, ou dont le contenu a changé. */
export function plan(inventory: Inventory, existing: Map<string, string>, bytesOf: (e: LibraryEntry) => Uint8Array): LibraryEntry[] {
  return inventory.entries.filter((e) => existing.get(e.storagePath) !== md5(bytesOf(e)));
}

export async function ingest(port: IngestPort, inventory: Inventory, options: { dryRun: boolean }): Promise<IngestOutcome> {
  const todo = plan(inventory, await port.existing(), port.bytesOf);
  const out: IngestOutcome = { uploaded: [], skipped: inventory.entries.length - todo.length, failed: [] };
  for (const entry of todo) {
    if (options.dryRun) {
      out.uploaded.push(entry.storagePath);
      continue;
    }
    const error = await port.upload(entry.storagePath, port.bytesOf(entry), entry.contentType);
    if (error) out.failed.push({ path: entry.storagePath, why: error });
    else out.uploaded.push(entry.storagePath);
  }
  return out;
}
