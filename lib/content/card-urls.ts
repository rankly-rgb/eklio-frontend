import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { DirectionPalette } from "@/lib/compose/palette";
import type { ContentItem } from "@/lib/data/content";
import { CARD_BUCKET, storedCardFor } from "@/lib/content/month/card-store";

/*
 * Les cartes gardées à la génération (`lib/content/month/card-store.ts`), signées
 * pour le flux.
 *
 * ⚠ LA CLÉ EST RECALCULÉE, PAS LUE. Le flux décide la carte de chaque post par
 * `reviewCardFrom`, exactement comme la génération ; si ce qui est dessiné a
 * changé depuis (elle a modifié le titre, la mise en page), la clé change, aucun
 * objet ne lui répond, et le post n'a pas d'URL ici. Le flux le compose alors à
 * la demande — il ne montre jamais une carte périmée.
 *
 * ⚠ SIGNÉE AVEC LE CLIENT DE SESSION. Signer demande le droit de lire, et la
 * policy du seau ne le donne que sur ses kits payés.
 */
export const CARD_URL_TTL_SECONDS = 600;

export async function storedCardUrls(
  supabase: SupabaseClient<Database>,
  kitId: string,
  items: ContentItem[],
  direction: DirectionPalette | null,
  practiceName: string | null,
  licence: string | null
): Promise<Record<string, string>> {
  /*
   * ⚠ LE DESSIN DE CHAQUE POST, LU EN UNE FOIS. Il fait partie de la carte, donc
   * de sa clé : sans lui, le flux ne retrouverait jamais la carte gardée et
   * recomposerait tout à la demande.
   */
  const drawings = new Map<string, string | null>();
  if (items.length > 0) {
    const read = await supabase.from("content_items").select("id, illustration_key").in("id", items.map((i) => i.id));
    if (read.error) console.error("[content] storedCardUrls: illustration_key", { message: read.error.message });
    for (const row of (read.data ?? []) as Array<{ id: string; illustration_key: string | null }>) {
      drawings.set(row.id, row.illustration_key);
    }
  }

  const wanted = new Map<string, string>();
  for (const item of items) {
    const target = storedCardFor(
      kitId,
      { ...item, illustration_key: drawings.get(item.id) ?? null },
      null,
      direction,
      practiceName,
      licence
    );
    if (target) wanted.set(target.path, item.id);
  }
  if (wanted.size === 0) return {};

  const { data, error } = await supabase.storage
    .from(CARD_BUCKET)
    .createSignedUrls([...wanted.keys()], CARD_URL_TTL_SECONDS);
  if (error) {
    console.error("[content] storedCardUrls", { message: error.message });
    return {};
  }
  const urls: Record<string, string> = {};
  for (const entry of data ?? []) {
    const itemId = entry.path ? wanted.get(entry.path) : undefined;
    if (itemId && entry.signedUrl && !entry.error) urls[itemId] = entry.signedUrl;
  }
  return urls;
}
