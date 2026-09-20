import { describe, expect, it } from "vitest";
import { monthScreen } from "@/lib/content/month-screen";
import { contentMonthSchema, type ContentMonth, type ContentMonthRecord } from "@/lib/data/content";

/*
 * ── LES QUATRE CONFIGURATIONS DU DÉBOGAGE ───────────────────────────────
 *
 * Ce dépôt n'a pas d'infrastructure de rendu React, et en ajouter une pour ce
 * correctif serait une dépendance de plus hors périmètre. La décision d'écran
 * a donc été sortie du JSX (`lib/content/month-screen.ts`) pour qu'elle soit
 * éprouvable telle quelle.
 *
 * ⚠ CE QUE CE FICHIER PROUVE ET CE QU'IL NE PROUVE PAS. Il prouve que la page
 * CHOISIT le bon écran dans les quatre configurations. Il ne prouve pas que
 * chaque composant se peint correctement — ça, seul un rendu le dirait, et
 * c'est noté dans `CONTENT_BUG_REPORT.md` §3.
 */

/** La charge d'une base À JOUR : les trois clefs du chantier sont là. */
function currentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "i1",
    brand_kit_id: "k1",
    archetype: "statement",
    status: "draft",
    title: "A post",
    caption: null,
    on_image_text: null,
    alt_text: null,
    tags: [],
    category: null,
    image_slot: null,
    register: null,
    month_id: null,
    theme: null,
    scheduled_for: "2026-09-02",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    posted: false,
    posted_at: null,
    channel: null,
    rationale: null,
    compose_archetype: null,
    topic: null,
    ...overrides,
  };
}

function month(items: unknown[]): ContentMonth {
  return contentMonthSchema.parse({
    month: "2026-09-01",
    items,
    unscheduled: [],
    counts: { scheduled: items.length, ready: 0, posted: 0 },
  });
}

const RECORD: ContentMonthRecord = {
  id: "m1",
  brand_kit_id: "k1",
  month: "2026-09-01",
  themes: ["Rest", "Boundaries", "Beginnings"],
  status: "ready",
  theme_source: null,
  theme_source_text: null,
  created_at: "2026-09-01T00:00:00Z",
};

describe("⚠ CONFIGURATION 1 — sans variables ET sans migrations (la preview qui a cassé)", () => {
  it("une forme plus ancienne que le code montre « pas activé ici », jamais « réessayez »", () => {
    const screen = monthScreen({
      result: {
        ok: false,
        code: "schema_mismatch",
        message: "Eklio is reading this month with a newer plan than the database has.",
        status: 500,
        detail: "get_content_month — items.0.rationale: expected string",
      },
      record: null,
      automatic: false,
      detail: "get_content_month — items.0.rationale: expected string",
    });
    expect(screen.kind).toBe("not_deployed");
    if (screen.kind !== "not_deployed") return;
    expect(screen.detail).toContain("rationale");
  });

  it("une RPC absente donne le MÊME écran — la distinction ne la concerne pas", () => {
    const screen = monthScreen({
      result: {
        ok: false,
        code: "not_deployed",
        message: "This part of Eklio is not switched on for this environment yet.",
        status: 503,
        detail: "credit_meter: 42883 function does not exist",
      },
      record: null,
      automatic: false,
      detail: "credit_meter: 42883 function does not exist",
    });
    expect(screen.kind).toBe("not_deployed");
  });

  it("⚠ ET LA CAUSE NE SORT PAS QUAND L'APPELANT NE LA PASSE PAS", () => {
    // En production, la page passe `detail: null`. L'écran est le même, muet.
    const screen = monthScreen({
      result: {
        ok: false,
        code: "schema_mismatch",
        message: "…",
        status: 500,
        detail: "des détails techniques",
      },
      record: null,
      automatic: false,
      detail: null,
    });
    expect(screen.kind).toBe("not_deployed");
    if (screen.kind !== "not_deployed") return;
    expect(screen.detail).toBeNull();
  });
});

describe("⚠ CONFIGURATION 2 — migrations appliquées, aucune variable posée", () => {
  it("un mois vide est un ÉTAT, et il dit que l'écriture n'est pas activée", () => {
    const screen = monthScreen({
      result: { ok: true, data: month([]) },
      record: null,
      automatic: false, // CONTENT_GENERATION_ARMED absente
      detail: null,
    });
    expect(screen.kind).toBe("empty");
    if (screen.kind !== "empty") return;
    /*
     * ⚠ `automatic: false` CHANGE CE QUE L'ÉCRAN PROMET. Sans génération
     * armée, annoncer « votre mois est écrit le 1er » serait faux — rien ne
     * l'écrira. L'écran propose alors ce qui marche : écrire soi-même.
     */
    expect(screen.automatic).toBe(false);
  });

  it("et les cartes déjà écrites s'affichent quand même", () => {
    const screen = monthScreen({
      result: { ok: true, data: month([currentItem()]) },
      record: null,
      automatic: false,
      detail: null,
    });
    expect(screen.kind).toBe("month");
  });
});

describe("⚠ CONFIGURATION 3 — tout est là, zéro post", () => {
  it("l'état vide promet le 1er, parce que quelque chose écrira vraiment le 1er", () => {
    const screen = monthScreen({
      result: { ok: true, data: month([]) },
      record: null,
      automatic: true,
      detail: null,
    });
    expect(screen.kind).toBe("empty");
    if (screen.kind !== "empty") return;
    expect(screen.automatic).toBe(true);
  });

  it("un mois en cours d'écriture montre l'attente, pas le vide", () => {
    const screen = monthScreen({
      result: { ok: true, data: month([]) },
      record: { ...RECORD, status: "generating" },
      automatic: true,
      detail: null,
    });
    expect(screen.kind).toBe("generating");
  });

  it("une génération ratée le dit, et ne se déguise pas en mois vide", () => {
    const screen = monthScreen({
      result: { ok: true, data: month([]) },
      record: { ...RECORD, status: "failed" },
      automatic: true,
      detail: null,
    });
    expect(screen.kind).toBe("generation_failed");
  });
});

describe("⚠ CONFIGURATION 4 — tout est là, un mois généré", () => {
  it("les cartes gagnent", () => {
    const screen = monthScreen({
      result: { ok: true, data: month([currentItem(), currentItem({ id: "i2" })]) },
      record: RECORD,
      automatic: true,
      detail: null,
    });
    expect(screen.kind).toBe("month");
  });

  it("⚠ ET UN MOIS `generating` QUI PORTE DÉJÀ DES CARTES MONTRE LES CARTES", () => {
    /*
     * Elle préfère lire ce qui est écrit plutôt qu'un écran d'attente pour le
     * reste. L'état du mois ne décide que lorsqu'il n'y a rien à montrer.
     */
    const screen = monthScreen({
      result: { ok: true, data: month([currentItem()]) },
      record: { ...RECORD, status: "generating" },
      automatic: true,
      detail: null,
    });
    expect(screen.kind).toBe("month");
  });
});

describe("⚠ UNE VRAIE PANNE RESTE UNE VRAIE PANNE", () => {
  it("et c'est le seul écran qui dit « réessayez »", () => {
    const screen = monthScreen({
      result: {
        ok: false,
        code: "server_error",
        message: "Something went wrong. Try again.",
        status: 500,
      },
      record: null,
      automatic: true,
      detail: null,
    });
    expect(screen.kind).toBe("failed");
    if (screen.kind !== "failed") return;
    expect(screen.message).toContain("Try again");
  });

  it("un kit impayé n'est pas confondu avec un environnement en retard", () => {
    const screen = monthScreen({
      result: { ok: false, code: "payment_required", message: "…", status: 402 },
      record: null,
      automatic: true,
      detail: null,
    });
    expect(screen.kind).toBe("failed");
  });
});
