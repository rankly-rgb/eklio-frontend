import { describe, expect, it } from "vitest";
import {
  hasNoGeneratedPosts,
  isEmptyDraft,
  isFailedGeneration,
  isGenerated,
  partitionMonth,
} from "@/lib/content/partition";
import { monthScreen } from "@/lib/content/month-screen";
import { contentMonthSchema, type ContentItem, type ContentMonth } from "@/lib/data/content";

/*
 * ── LA CARTE VIDE DE LA PREVIEW ─────────────────────────────────────────
 *
 * Ce que `/app/content` montrait : une grande carte sans titre, sans légende,
 * sans visuel, « Unscheduled », avec Swap / Edit / Approve, et « 0 of 1
 * ready » — sur un compte où AUCUN mois n'a jamais été généré.
 *
 * Prouvé sur une base rejouée aux 133 migrations d'avant le chantier (donc la
 * production) : `content_topics` et `content_items.topic_id` n'y existent
 * pas, donc aucun item ne PEUT venir de la banque ; et
 * `create_content_item` — l'ancien bouton « New item » — écrit exactement
 * cette ligne : title NULL, caption NULL, on_image_text NULL, scheduled_for
 * NULL, month_id NULL, status draft.
 *
 * ⚠ CHAQUE BLOC CI-DESSOUS PORTE SON CAS NÉGATIF : l'assertion qui échouait
 * avant le correctif est marquée, pour qu'on sache ce que le test attrape.
 */

function item(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "i1",
    brand_kit_id: "k1",
    archetype: "statement",
    status: "draft",
    title: null,
    caption: null,
    on_image_text: null,
    alt_text: null,
    tags: [],
    category: null,
    image_slot: null,
    register: null,
    month_id: null,
    theme: null,
    scheduled_for: null,
    created_at: "2026-01-14T00:00:00Z",
    updated_at: "2026-01-14T00:00:00Z",
    posted: false,
    posted_at: null,
    channel: null,
    rationale: null,
    compose_archetype: null,
    topic: null,
    ...overrides,
  };
}

/** La ligne EXACTE que `create_content_item` produit. Voir l'en-tête. */
const LEGACY_EMPTY = item({ id: "legacy", created_at: "2026-01-14T00:00:00Z" });

/** Un vrai post du mois. */
function generatedItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return item({
    id: "g1",
    month_id: "m1",
    title: "Rest is not a reward",
    caption: "A caption the bank wrote.",
    on_image_text: "Rest is not a reward you earn",
    scheduled_for: "2026-09-02",
    topic: {
      id: "t1",
      angle: "normalise",
      angle_label: "You are not the only one",
      archetype_key: "single_statement",
      timely: false,
    },
    ...overrides,
  });
}

function month(items: ContentItem[], unscheduled: ContentItem[] = []): ContentMonth {
  return contentMonthSchema.parse({
    month: "2026-09-01",
    items,
    unscheduled,
    counts: { scheduled: items.length, ready: 0, posted: 0 },
  });
}

describe("⚠ A.1 — un item à elle n'est jamais un post du mois", () => {
  it("CAS NÉGATIF : la carte vide de la preview n'entre plus dans le flux", () => {
    /*
     * Avant : elle apparaissait en grande carte avec Swap et Approve. Swap
     * n'a pas de sujet à retirer du paquet, Approve accepte une proposition
     * qu'Eklio n'a jamais faite.
     */
    const { generated, hers, emptyDrafts } = partitionMonth(month([], [LEGACY_EMPTY]));
    expect(generated).toHaveLength(0);
    expect(hers).toHaveLength(0);
    expect(emptyDrafts).toHaveLength(1);
  });

  it("un post à elle qui PORTE quelque chose va dans sa section, pas au rebut", () => {
    const hers = partitionMonth(month([], [item({ caption: "Something I wrote." })])).hers;
    expect(hers).toHaveLength(1);
  });

  it("⚠ RIEN N'EST SUPPRIMÉ : le brouillon vide est compté, pas jeté", () => {
    // La partition le rend ; c'est l'écran qui choisit de ne pas le peindre.
    const parts = partitionMonth(month([], [LEGACY_EMPTY]));
    expect(parts.emptyDrafts[0].id).toBe("legacy");
  });

  it("le signal est `month_id`, et un post du mois qui a perdu son sujet le reste", () => {
    /*
     * ⚠ C'EST L'ÉCART ASSUMÉ AVEC LE BRIEF, et voici le cas qui le justifie.
     * `topic_id` est `on delete set null` : retirer un sujet de la banque met
     * `topic` à null sur de VRAIS posts du mois. Classer sur `topic` les
     * ferait basculer vers « ses propres posts » et leur retirerait Swap —
     * exactement le bouton dont ils ont le plus besoin.
     */
    const orphan = generatedItem({ id: "orphan", topic: null });
    expect(isGenerated(orphan)).toBe(true);
    expect(partitionMonth(month([orphan])).generated).toHaveLength(1);
  });

  it("et un post à elle ne peut pas prendre un month_id par l'éditeur", async () => {
    // Garde-fou de contrat : la liste blanche du patch ne porte pas month_id.
    const { contentPatchSchema } = await import("@/lib/data/content");
    expect(contentPatchSchema.safeParse({ month_id: "m1" }).success).toBe(false);
  });
});

describe("⚠ A.2 — le mois est vide quand rien n'a été généré", () => {
  it("CAS NÉGATIF : un brouillon à elle ne fait plus exister le mois", () => {
    /*
     * Avant : `items.length + unscheduled.length > 0` suffisait, donc la
     * carte de janvier remplaçait l'état vide sur un mois jamais généré.
     */
    const screen = monthScreen({
      result: { ok: true, data: month([], [LEGACY_EMPTY]) },
      record: null,
      automatic: false,
      detail: null,
    
      view: "stream",
    });
    expect(screen.kind).toBe("empty");
  });

  it("même avec un post à elle bien rempli", () => {
    const screen = monthScreen({
      result: { ok: true, data: month([], [item({ caption: "Mine." })]) },
      record: null,
      automatic: false,
      detail: null,
    
      view: "stream",
    });
    expect(screen.kind).toBe("empty");
  });

  it("un seul post généré suffit à ce que le mois existe", () => {
    const screen = monthScreen({
      result: { ok: true, data: month([generatedItem()]) },
      record: null,
      automatic: false,
      detail: null,
    
      view: "stream",
    });
    expect(screen.kind).toBe("month");
  });

  it("hasNoGeneratedPosts ne regarde que le généré", () => {
    expect(hasNoGeneratedPosts(month([], [LEGACY_EMPTY]))).toBe(true);
    expect(hasNoGeneratedPosts(month([generatedItem()], [LEGACY_EMPTY]))).toBe(false);
  });
});

describe("⚠ A.3 — le compteur ne compte que le généré", () => {
  /*
   * `MonthProgress` est un composant ; ce qui est testable sans rendu est le
   * nombre qu'il affiche, c'est-à-dire la taille de `generated`.
   */
  it("CAS NÉGATIF : « 0 of 1 ready » sur un mois jamais généré tombe à zéro", () => {
    expect(partitionMonth(month([], [LEGACY_EMPTY])).generated).toHaveLength(0);
  });

  it("et un mois généré compte ses posts, pas ceux qu'elle a ajoutés", () => {
    const m = month([generatedItem(), generatedItem({ id: "g2" })], [item({ caption: "Mine." })]);
    expect(partitionMonth(m).generated).toHaveLength(2);
  });
});

describe("⚠ A.4 — un post généré incomplet a son propre état", () => {
  it("CAS NÉGATIF : ni légende ni ligne d'image n'est plus une grande carte blanche", () => {
    const broken = generatedItem({ id: "broken", caption: null, on_image_text: null });
    expect(isFailedGeneration(broken)).toBe(true);
  });

  it("un titre seul ne sauve pas le post : ce n'est pas ce qu'une génération produit", () => {
    const titleOnly = generatedItem({ caption: null, on_image_text: "  ", title: "A title" });
    expect(isFailedGeneration(titleOnly)).toBe(true);
  });

  it("une légende suffit à en faire un vrai post", () => {
    expect(isFailedGeneration(generatedItem({ on_image_text: null }))).toBe(false);
  });

  it("⚠ ET UN POST À ELLE N'EST JAMAIS « une génération ratée »", () => {
    // Elle n'a rien lancé. Lui dire que ça a raté serait lui attribuer un échec.
    expect(isFailedGeneration(LEGACY_EMPTY)).toBe(false);
  });
});

describe("isEmptyDraft — ce qui compte comme « il y a quelque chose »", () => {
  it.each([
    ["un titre", { title: "A" }],
    ["une légende", { caption: "A" }],
    ["une ligne d'image", { on_image_text: "A" }],
    ["une photographie choisie", { image_slot: "post_bg_1" }],
  ])("%s suffit", (_label, overrides) => {
    expect(isEmptyDraft(item(overrides as Partial<ContentItem>))).toBe(false);
  });

  it("des espaces ne suffisent pas", () => {
    expect(isEmptyDraft(item({ title: "   ", caption: "\n" }))).toBe(true);
  });

  it("⚠ UNE DATE NE SUFFIT PAS. Un post daté sans un mot dedans reste vide", () => {
    expect(isEmptyDraft(item({ scheduled_for: "2026-09-04" }))).toBe(true);
  });
});
