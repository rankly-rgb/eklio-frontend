import { describe, expect, it } from "vitest";
import {
  contentMonthKey,
  contentMonthLabel,
  contentPatchSchema,
  daysInMonth,
  firstWeekday,
  getContentItem,
  getContentMonth,
  markContentPosted,
} from "@/lib/data/content";

/*
 * Un client Supabase minimal : on ne teste pas PostgREST, on teste ce que
 * cette couche fait de CE QUE la base répond — et notamment des refus.
 */
function clientReturning(data: unknown, error: { message: string } | null = null) {
  return {
    rpc: async () => ({ data, error }),
  } as never;
}

describe("un refus de la base devient un refus typé", () => {
  /*
   * ⚠ LE POINT LE PLUS IMPORTANT DE CE FICHIER.
   *
   * `not_found` est un 404 et jamais un 403 : un 403 confirmerait que l'item
   * d'une autre existe. C'est la règle du produit, et c'est ici qu'elle est
   * réellement tenue plutôt qu'énoncée.
   */
  it("« not_found » est un 404, jamais un 403", async () => {
    const result = await getContentItem(
      clientReturning({ error: { code: "not_found", message: "No such content item." } }),
      "d3ad0000-0000-0000-0000-000000000000"
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(result.status).not.toBe(403);
  });

  it("« payment_required » est un 402, pas une liste vide", async () => {
    // Un refus rendu comme « rien ici » se lit comme une panne. 402 est une
    // offre, et le §7 le demande explicitement.
    const result = await getContentMonth(
      clientReturning({
        error: { code: "payment_required", message: "This brand kit is not yet paid for." },
      }),
      "kit",
      "2026-09-01"
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(402);
  });

  it("un code inconnu ne devient pas un 200", async () => {
    const result = await markContentPosted(
      clientReturning({ error: { code: "something_new", message: "…" } }),
      "id",
      true,
      null
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(500);
  });

  it("une forme inattendue est une erreur, pas un état vide silencieux", async () => {
    // Un éditeur qui rend « rien » est indiscernable d'un item sans contenu.
    const result = await getContentItem(clientReturning({ id: 12 }), "id");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("server_error");
  });

  it("une erreur transport n'est pas confondue avec un refus", async () => {
    const result = await getContentItem(clientReturning(null, { message: "timeout" }), "id");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("server_error");
    expect(result.status).toBe(500);
  });
});

describe("le patch dit la différence entre « ne touche pas » et « efface »", () => {
  it("une clé absente reste absente après validation", () => {
    // Si zod ajoutait la clé à undefined, l'appel effacerait un champ que
    // personne n'a touché — et l'autosave d'un onglet écraserait l'autre.
    const parsed = contentPatchSchema.parse({ caption: "Written." });
    expect(Object.keys(parsed)).toEqual(["caption"]);
    expect("title" in parsed).toBe(false);
  });

  it("une clé présente à null survit à la validation", () => {
    const parsed = contentPatchSchema.parse({ title: null });
    expect(Object.keys(parsed)).toEqual(["title"]);
    expect(parsed.title).toBeNull();
  });

  it("une clé inconnue est REFUSÉE, pas ignorée", () => {
    // Ignorer, c'est laisser un champ renommé s'enregistrer dans le vide
    // pendant toute une version sans que rien ne devienne rouge.
    expect(contentPatchSchema.safeParse({ titel: "typo" }).success).toBe(false);
  });

  it("les limites sont celles des colonnes, pas des limites inventées", () => {
    expect(contentPatchSchema.safeParse({ title: "x".repeat(34) }).success).toBe(true);
    expect(contentPatchSchema.safeParse({ title: "x".repeat(35) }).success).toBe(false);
    expect(contentPatchSchema.safeParse({ caption: "x".repeat(2200) }).success).toBe(true);
    expect(contentPatchSchema.safeParse({ caption: "x".repeat(2201) }).success).toBe(false);
    expect(contentPatchSchema.safeParse({ tags: Array(9).fill("a") }).success).toBe(false);
  });

  it("un emplacement d'image inventé est refusé", () => {
    expect(contentPatchSchema.safeParse({ image_slot: "hero" }).success).toBe(true);
    expect(contentPatchSchema.safeParse({ image_slot: "banner" }).success).toBe(false);
    expect(contentPatchSchema.safeParse({ image_slot: null }).success).toBe(true);
  });
});

describe("le mois, sans fuseau qui traîne", () => {
  it("la grille connaît sa propre longueur", () => {
    expect(daysInMonth("2026-02-01")).toBe(28);
    expect(daysInMonth("2024-02-01")).toBe(29);
    expect(daysInMonth("2026-09-01")).toBe(30);
    expect(daysInMonth("2026-12-01")).toBe(31);
  });

  it("le premier du mois tombe sur le bon jour de semaine", () => {
    // 2026-09-01 est un mardi.
    expect(firstWeekday("2026-09-01")).toBe(2);
  });

  it("la clé du mois est celle de New York, pas celle du serveur", () => {
    // 1er octobre 00:30 UTC est encore le 30 septembre à New York : un serveur
    // en UTC classerait cet item dans le mauvais mois.
    expect(contentMonthKey(new Date("2026-10-01T00:30:00Z"))).toBe("2026-09-01");
  });

  it("le libellé est en anglais américain et porte l'année", () => {
    expect(contentMonthLabel("2026-09-01")).toBe("September 2026");
  });
});
