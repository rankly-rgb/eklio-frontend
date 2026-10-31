import { describe, expect, it, vi } from "vitest";
import { cardPath, storeMonthCards, storedCardFor, type CardStorePort } from "@/lib/content/month/card-store";
import { reviewCardFrom, type CardItem } from "@/lib/content/review";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * Novembre 2026 : 24 posts, aucune carte gardée. Ce qui est éprouvé ici :
 * la carte gardée EST celle que l'écran décidera, sous une clé qui change dès
 * que ce qui est dessiné change.
 */

const KIT = "45de0dac-958f-4096-b83e-1559a89437e6";
const DIRECTION = {
  primary: "#3E5C50", secondary: "#B9A27A", dark: "#1F2A26", light: "#F4EFE6", paper: "#FBF8F2",
} as unknown as DirectionPalette;
const LICENCE = "LMFT #12345";

function item(over: Partial<CardItem> = {}): CardItem {
  return {
    id: "item-1",
    theme: null,
    title: "Grief can arrive with relief",
    payload: { statement: "Grief can arrive with relief." },
    compose_archetype: "single_statement",
    topic: { id: "t1", angle: "normalise", angle_label: "Normalise", archetype_key: "single_statement", timely: false },
    ...over,
  };
}

describe("la carte gardée est celle de l'écran", () => {
  it("le chemin est sous le kit, par post, et sa clé est celle que l'écran recalcule", () => {
    const stored = storedCardFor(KIT, item(), null, DIRECTION, "Still Water", LICENCE)!;
    expect(stored.path.startsWith(`${KIT}/cards/item-1/`)).toBe(true);
    expect(stored.path).toMatch(/\/[0-9a-f]{64}\.png$/);
    /* L'écran passe par la même fonction : même carte, même chemin. */
    expect(stored.card).toEqual(reviewCardFrom(item(), null, DIRECTION, "Still Water", LICENCE));
    expect(storedCardFor(KIT, item(), null, DIRECTION, "Still Water", LICENCE)!.path).toBe(stored.path);
  });

  it("tout ce qui est dessiné change la clé : titre, payload, mise en page, licence, palette", () => {
    const base = storedCardFor(KIT, item(), null, DIRECTION, "Still Water", LICENCE)!.path;
    const variants = [
      storedCardFor(KIT, item({ title: "Another line" }), null, DIRECTION, "Still Water", LICENCE),
      storedCardFor(KIT, item({ payload: { statement: "Changed." } }), null, DIRECTION, "Still Water", LICENCE),
      storedCardFor(KIT, item({ compose_archetype: "carousel", payload: { cards: [] } }), null, DIRECTION, "Still Water", LICENCE),
      /* ⚠ La licence est dans le pied : une ancienne licence ne doit jamais être resservie. */
      storedCardFor(KIT, item(), null, DIRECTION, "Still Water", "LMFT #99999"),
      storedCardFor(KIT, item(), null, { ...DIRECTION, primary: "#123456" } as DirectionPalette, "Still Water", LICENCE),
    ];
    for (const v of variants) expect(v?.path).not.toBe(base);
  });

  it("rien à composer, rien à garder : pas de palette, ou pas de payload hors single_statement", () => {
    expect(storedCardFor(KIT, item(), null, null, "Still Water", LICENCE)).toBeNull();
    expect(
      storedCardFor(KIT, item({ payload: null, compose_archetype: "cycle" }), null, DIRECTION, "Still Water", LICENCE)
    ).toBeNull();
  });

  it("cardPath commence par le kit — le premier segment que la policy de lecture lit", () => {
    expect(cardPath(KIT, "i", "k").split("/")[0]).toBe(KIT);
  });
});

describe("storeMonthCards ne fait jamais échouer le mois, et dit ce qui manque", () => {
  const port = (rows: Array<{ item: CardItem }>, upload = vi.fn(async () => null as string | null)): CardStorePort => ({
    monthItems: async () => rows.map((r) => ({ item: r.item, topic: null })),
    upload,
  });
  const input = { kitId: KIT, monthId: "m1", direction: DIRECTION, practiceName: "Still Water", licence: LICENCE };

  it("chaque post composable est rendu et déposé à son chemin", async () => {
    const upload = vi.fn(async () => null as string | null);
    const rows = [{ item: item({ id: "a" }) }, { item: item({ id: "b", title: "Other" }) }];
    const out = await storeMonthCards(port(rows, upload), async () => new Uint8Array([1, 2, 3]), input);
    expect(out).toEqual({ stored: 2, failed: [] });
    expect(upload.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual([
      storedCardFor(KIT, rows[0].item, null, DIRECTION, "Still Water", LICENCE)!.path,
      storedCardFor(KIT, rows[1].item, null, DIRECTION, "Still Water", LICENCE)!.path,
    ]);
  });

  it("un refus du moteur, un dépôt refusé, une lecture en panne : rendus, jamais levés", async () => {
    const rows = [{ item: item({ id: "a" }) }, { item: item({ id: "b", title: "B" }) }, { item: item({ id: "c", payload: null, compose_archetype: "cycle" }) }];
    let n = 0;
    const out = await storeMonthCards(
      port(rows, vi.fn(async () => (n++ === 0 ? "bucket says no" : null))),
      async (card) => {
        if (card.headline === "B") throw new Error("does not fit");
        return new Uint8Array([1]);
      },
      input
    );
    expect(out.stored).toBe(0);
    expect(out.failed.map((f) => f.itemId)).toEqual(["a", "b", "c"]);
    expect(out.failed[0].why).toContain("bucket says no");
    expect(out.failed[1].why).toContain("does not fit");

    const broken: CardStorePort = { monthItems: async () => { throw new Error("db down"); }, upload: async () => null };
    const none = await storeMonthCards(broken, async () => new Uint8Array(), input);
    expect(none.stored).toBe(0);
    expect(none.failed[0].why).toContain("db down");
  });
});
