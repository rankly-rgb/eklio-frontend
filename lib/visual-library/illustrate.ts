import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import type { Inventory } from "@/lib/visual-library/inventory";
import { assignMonth, type PostSignals } from "@/lib/visual-library/match";

/*
 * Le port `illustrate` de l'orchestrateur, tel que le produit le passe :
 * l'appariement par le sens sur l'inventaire committé, écart de dix posts.
 * Le harnais passe le même — un harnais qui illustrerait autrement prouverait
 * autre chose que le produit.
 */
const ENTRIES = (inventoryJson as Inventory).entries;

export function illustrateMonth(posts: PostSignals[]): Array<string | null> {
  return assignMonth(posts, ENTRIES).map((m) => m?.id ?? null);
}
