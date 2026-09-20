import { describe, expect, it } from "vitest";
import { contentItemSchema, contentMonthSchema, toleratedKeys } from "@/lib/data/content";

/*
 * ── LA CHARGE QUE LA PRODUCTION RENVOIE VRAIMENT ────────────────────────
 *
 * ⚠ CE N'EST PAS UNE FIXTURE INVENTÉE. Cet objet a été capturé en rejouant,
 * sur la stack PostgreSQL 16 locale, UNIQUEMENT les 133 migrations antérieures
 * au chantier — c'est-à-dire ce que `fobgdsupyfslxbswfuay` porte, et donc ce
 * que la preview Vercel interroge — puis en appelant `get_content_month`
 * depuis le rôle `authenticated`. La méthode est dans `CONTENT_BUG_REPORT.md`
 * §1.3.
 *
 * Ce que ce fichier protège : une base déployée plus ancienne que le code doit
 * RENDRE L'ÉCRAN, pas le faire échouer. Avant le correctif, les trois
 * assertions ci-dessous échouaient avec
 *
 *   items.0.rationale         expected string, received undefined
 *   items.0.compose_archetype expected string, received undefined
 *   items.0.topic             expected object, received undefined
 *
 * parce qu'en Zod `.nullable()` exige quand même la clef.
 */
const PRODUCTION_MONTH = {
  items: [
    {
      id: "ec006d94-0e3b-4b4c-8d44-a30794c72644",
      tags: [],
      theme: null,
      title: "A post that exists",
      posted: false,
      status: "draft",
      caption: null,
      channel: null,
      alt_text: null,
      category: null,
      month_id: null,
      register: null,
      archetype: "statement",
      posted_at: null,
      created_at: "2026-09-20T19:27:05.068282+00:00",
      image_slot: null,
      updated_at: "2026-09-20T19:27:05.068282+00:00",
      brand_kit_id: "73211377-b62d-4bf0-865e-70d4c19afe5e",
      on_image_text: null,
      scheduled_for: "2026-09-01",
    },
  ],
  month: "2026-09-01",
  counts: { ready: 0, posted: 0, proposed: 0, scheduled: 1 },
  unscheduled: [],
} as const;

/** Les trois clefs que les migrations du chantier ont ajoutées. */
const ADDED_BY_THE_CHANTIER = ["rationale", "compose_archetype", "topic"] as const;

describe("⚠ RÉGRESSION — une base plus ancienne que le code rend l'écran", () => {
  it("la charge capturée ne porte VRAIMENT pas les trois clefs", () => {
    /*
     * Sans cette assertion, le test suivant passerait le jour où quelqu'un
     * « corrigerait » la fixture en y ajoutant les clefs manquantes — et il ne
     * mesurerait plus rien du tout.
     */
    for (const key of ADDED_BY_THE_CHANTIER) {
      expect(PRODUCTION_MONTH.items[0]).not.toHaveProperty(key);
    }
  });

  it("le mois se décode quand même", () => {
    const parsed = contentMonthSchema.safeParse(PRODUCTION_MONTH);
    expect(
      parsed.success,
      parsed.success ? "" : JSON.stringify(parsed.error.issues, null, 2)
    ).toBe(true);
  });

  it("et une clef absente vaut `null`, pas `undefined`", () => {
    /*
     * ⚠ LA DIFFÉRENCE COMPTE À L'ÉCRAN. `item.rationale ?? null` marcherait
     * pour les deux, mais `topic?.angle_label` sur un `undefined` et sur un
     * `null` ne se lisent pas pareil dans un JSX, et un `undefined` qui
     * traverse remonte tôt ou tard dans une prop typée `string | null`.
     */
    const parsed = contentMonthSchema.parse(PRODUCTION_MONTH);
    const item = parsed.items[0];
    expect(item.rationale).toBeNull();
    expect(item.compose_archetype).toBeNull();
    expect(item.topic).toBeNull();
  });

  it("un mois VIDE se décodait déjà, et continue", () => {
    // C'est pour ça que la panne n'apparaissait qu'aux praticiennes qui
    // avaient déjà écrit au moins un post.
    const empty = { ...PRODUCTION_MONTH, items: [], unscheduled: [] };
    expect(contentMonthSchema.safeParse(empty).success).toBe(true);
  });

  it("un item seul se décode aussi — c'est le chemin de /app/content/[id]", () => {
    /*
     * `getContentItem` passe par `contentItemSchema` directement, et son échec
     * était PIRE : la page appelait `notFound()`, donc un post qui existe
     * répondait 404.
     */
    const parsed = contentItemSchema.safeParse(PRODUCTION_MONTH.items[0]);
    expect(
      parsed.success,
      parsed.success ? "" : JSON.stringify(parsed.error.issues, null, 2)
    ).toBe(true);
  });
});

describe("⚠ ET LA TOLÉRANCE RESTE BORNÉE", () => {
  it("une clef VRAIMENT obligatoire qui manque est toujours une erreur", () => {
    /*
     * Rendre le schéma tolérant ne veut pas dire tout accepter. Si le jour où
     * `title` disparaît de la réponse le schéma se taisait, on aurait échangé
     * une panne visible contre un écran vide inexplicable.
     */
    const withoutTitle: Record<string, unknown> = { ...PRODUCTION_MONTH.items[0] };
    delete withoutTitle.title;
    expect(contentItemSchema.safeParse(withoutTitle).success).toBe(false);
  });

  it("une valeur du mauvais TYPE reste une erreur, présente ou non", () => {
    const wrong = { ...PRODUCTION_MONTH.items[0], rationale: 42 };
    expect(contentItemSchema.safeParse(wrong).success).toBe(false);
  });

  it("et une valeur explicitement `null` est acceptée, comme avant", () => {
    const explicit = {
      ...PRODUCTION_MONTH.items[0],
      rationale: null,
      compose_archetype: null,
      topic: null,
    };
    expect(contentItemSchema.safeParse(explicit).success).toBe(true);
  });

  it("une base À JOUR fait traverser les trois valeurs", () => {
    const current = {
      ...PRODUCTION_MONTH.items[0],
      rationale: "Because burnout keeps coming up.",
      compose_archetype: "cycle",
      topic: {
        id: "t1",
        angle: "invite",
        angle_label: "A soft invitation",
        archetype_key: "cycle",
        timely: false,
      },
    };
    const parsed = contentItemSchema.parse(current);
    expect(parsed.rationale).toBe("Because burnout keeps coming up.");
    expect(parsed.compose_archetype).toBe("cycle");
    expect(parsed.topic?.angle_label).toBe("A soft invitation");
  });
});

describe("⚠ LA LISTE DES CLEFS TOLÉRÉES EST FERMÉE", () => {
  /*
   * Une tolérance qu'on n'énumère pas s'élargit : à la première charge qui ne
   * parse pas, la tentation est d'ajouter un `sinceMigration` de plus, et
   * personne ne compte. Ici on compte.
   */
  it("exactement trois, et chacune nomme sa migration", () => {
    const tolerated = toleratedKeys(contentItemSchema);
    expect(Object.keys(tolerated).sort()).toEqual([
      "compose_archetype",
      "rationale",
      "topic",
    ]);
    for (const [key, migration] of Object.entries(tolerated)) {
      expect(migration, key).toMatch(/^2026\d{10}_[a-z_]+$/);
    }
  });
});
