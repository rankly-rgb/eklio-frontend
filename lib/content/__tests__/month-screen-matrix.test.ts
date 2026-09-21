import { describe, expect, it } from "vitest";
import { monthScreen, type MonthScreen, type MonthView } from "@/lib/content/month-screen";
import {
  contentMonthSchema,
  type ContentItem,
  type ContentMonth,
  type ContentMonthRecord,
  type ContentResult,
} from "@/lib/data/content";

/*
 * ── LA MATRICE VUE × ÉTAT, EXHAUSTIVE ───────────────────────────────────
 *
 * Le trou venait d'une combinaison jamais testée : **calendrier + mois sans
 * post généré**. L'état vide était décidé au-dessus de la vue, donc il
 * court-circuitait les deux. Le bouton basculait — « Open the calendar »
 * devenait « Back to the cards » — et rendait le même écran vide. La grille ne
 * s'affichait jamais, alors que le texte de l'état vide promettait qu'elle
 * pouvait y planifier et écrire ses propres posts.
 *
 * Les cases ne sont plus choisies : elles sont ÉNUMÉRÉES. Deux vues × cinq
 * états = dix, et le test échoue si une case manque à la table.
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
    payload: null,
    topic: null,
    ...overrides,
  };
}

function month(items: ContentItem[], unscheduled: ContentItem[] = []): ContentMonth {
  return contentMonthSchema.parse({
    month: "2026-09-01",
    items,
    unscheduled,
    counts: { scheduled: items.length, ready: 0, posted: 0 },
  });
}

const RECORD: ContentMonthRecord = {
  id: "m1",
  brand_kit_id: "k1",
  month: "2026-09-01",
  themes: ["Rest", "Boundaries", "Beginnings"],
  status: "approved",
  theme_source: null,
  theme_source_text: null,
  created_at: "2026-09-01T00:00:00Z",
};

const GENERATED = item({ id: "g1", month_id: "m1", caption: "Written by Eklio.", scheduled_for: "2026-09-02" });
/** Le brouillon de janvier : créé par « New item », sans date, sans un mot. */
const JANUARY_DRAFT = item({ id: "legacy" });
/** Un post à elle qui porte quelque chose. */
const HERS = item({ id: "hers", caption: "Something I wrote." });

/** Les cinq états, indépendants de la vue. */
type StateName =
  | "not_activated"
  | "activated_no_post"
  | "generated_month"
  | "manual_items_only"
  | "generation_failed"
  /**
   * ⚠ SIXIÈME ÉTAT, ABSENT DE LA LISTE DU BRIEF. Un mois en cours d'écriture
   * est un état réel et il court-circuitait le calendrier exactement comme
   * les autres. Une matrice qui s'arrête à la liste qu'on lui a donnée n'est
   * pas exhaustive, elle est complète par rapport à une liste.
   */
  | "generating";

const STATES: Record<
  StateName,
  { result: ContentResult<ContentMonth>; record: ContentMonthRecord | null; automatic: boolean }
> = {
  /** Migrations absentes ou fonctionnalité non déployée ici. */
  not_activated: {
    result: {
      ok: false,
      code: "schema_mismatch",
      message: "…",
      status: 500,
      detail: "get_content_month — items.0.rationale",
    },
    record: null,
    automatic: false,
  },
  /** Tout est en place, rien n'a encore été écrit. */
  activated_no_post: { result: { ok: true, data: month([]) }, record: null, automatic: true },
  /** Un mois écrit par Eklio. */
  generated_month: {
    result: { ok: true, data: month([GENERATED]) },
    record: RECORD,
    automatic: true,
  },
  /** ⚠ LA CASE QUI MANQUAIT : que ses propres posts, aucun généré. */
  manual_items_only: {
    result: { ok: true, data: month([], [JANUARY_DRAFT, HERS]) },
    record: null,
    automatic: false,
  },
  /** La génération a échoué et n'a rien laissé. */
  generation_failed: {
    result: { ok: true, data: month([]) },
    record: { ...RECORD, status: "failed" },
    automatic: true,
  },
  /** Eklio est en train d'écrire le mois. */
  generating: {
    result: { ok: true, data: month([]) },
    record: { ...RECORD, status: "generating" },
    automatic: true,
  },
};

/**
 * L'écran attendu pour chaque case.
 *
 * ⚠ LA COLONNE « calendar » EST CONSTANTE SAUF SUR UN REFUS DE LECTURE, et
 * c'est tout le correctif : la grille répond à « qu'est-ce qui est posé sur
 * quel jour », une question qui a une réponse même quand Eklio n'a rien écrit.
 * On ne dessine en revanche pas une grille à partir de données qu'on n'a pas
 * pu lire.
 */
const EXPECTED: Record<StateName, Record<MonthView, MonthScreen["kind"]>> = {
  not_activated: { stream: "not_deployed", calendar: "not_deployed" },
  activated_no_post: { stream: "empty", calendar: "calendar" },
  generated_month: { stream: "month", calendar: "calendar" },
  manual_items_only: { stream: "empty", calendar: "calendar" },
  generation_failed: { stream: "generation_failed", calendar: "calendar" },
  generating: { stream: "generating", calendar: "calendar" },
};

const VIEWS: MonthView[] = ["stream", "calendar"];

describe("⚠ MATRICE vue × état", () => {
  it("la table couvre les douze cases, sans trou", () => {
    /*
     * Sans cette garde, retirer un état de `EXPECTED` ferait simplement
     * disparaître ses cas — une matrice qui rétrécit en silence ne mesure
     * plus ce qu'elle annonce.
     */
    const names = Object.keys(STATES) as StateName[];
    expect(names).toHaveLength(6);
    for (const name of names) {
      expect(Object.keys(EXPECTED[name]).sort(), name).toEqual(["calendar", "stream"]);
    }
  });

  for (const name of Object.keys(STATES) as StateName[]) {
    for (const view of VIEWS) {
      it(`${name} · ${view} → ${EXPECTED[name][view]}`, () => {
        const { result, record, automatic } = STATES[name];
        const screen = monthScreen({ result, record, automatic, detail: null, view });
        expect(screen.kind).toBe(EXPECTED[name][view]);
      });
    }
  }
});

describe("⚠ LE CAS NÉGATIF — il échoue sur abe7f12", () => {
  /*
   * ⚠ CE QUI ÉTAIT RÉELLEMENT CASSÉ SUR `abe7f12`, EXACTEMENT.
   *
   * La page branchait sur la vue APRÈS les états de flux, donc seuls les
   * états qui court-circuitaient étaient atteints :
   *
   *   calendrier + activé sans post      → l'état vide     ❌
   *   calendrier + items manuels seuls   → l'état vide     ❌  (le rapporté)
   *   calendrier + génération en échec   → l'écran d'échec ❌
   *   calendrier + en cours d'écriture   → l'écran d'attente ❌
   *   calendrier + mois généré           → la grille       ✓  (marchait)
   *   calendrier + non activé            → « pas activé »  ✓  (correct)
   *
   * Quatre cases sur six, pas une. La reproduction ci-dessous neutralise le
   * correctif dans `monthScreen`, ce qui fait aussi tomber `mois généré` —
   * artefact de la méthode, pas du bug en production. C'est écrit ici pour
   * qu'on ne relise pas ce fichier en croyant que cinq cases étaient
   * cassées.
   */
  it("calendrier + mois sans post généré rend la GRILLE, pas l'état vide", () => {
    /*
     * C'est le bug rapporté. Avant le correctif, `monthScreen` ne recevait pas
     * la vue et rendait « empty » ici, donc la page affichait l'état vide dans
     * les deux vues et la grille n'apparaissait jamais.
     */
    const screen = monthScreen({
      ...STATES.manual_items_only,
      detail: null,
      view: "calendar",
    });
    expect(screen.kind).toBe("calendar");
    expect(screen.kind).not.toBe("empty");
  });

  it("et le flux, lui, montre bien l'état vide sur la même donnée", () => {
    // Les deux moitiés : la grille apparaît SANS que l'état vide disparaisse.
    const screen = monthScreen({ ...STATES.manual_items_only, detail: null, view: "stream" });
    expect(screen.kind).toBe("empty");
  });

  it("⚠ UN REFUS DE LECTURE RESTE AU-DESSUS DE LA VUE", () => {
    // On ne dessine pas une grille à partir de données qu'on n'a pas pu lire.
    const screen = monthScreen({ ...STATES.not_activated, detail: null, view: "calendar" });
    expect(screen.kind).toBe("not_deployed");
  });
});

describe("⚠ CE QUE LA GRILLE PORTE — le brouillon de janvier", () => {
  /*
   * Mesuré sur une base rejouée aux 133 migrations d'avant le chantier, donc
   * la production : `get_content_month` ne filtre PAS `unscheduled` par mois.
   *
   *   le brouillon de janvier, vu depuis septembre : unscheduled = 1
   *   vu depuis mars                              : unscheduled = 1
   *
   * Un item sans date revient donc sur N'IMPORTE QUEL mois, et le calendrier
   * le rend dans sa liste « Unscheduled ». C'est le chemin identifiable par
   * lequel elle le retrouve, et il ne dépend pas du mois affiché.
   */
  it("un brouillon sans date arrive bien dans `unscheduled`, pas dans la grille datée", () => {
    const model = STATES.manual_items_only.result;
    expect(model.ok).toBe(true);
    if (!model.ok) return;
    expect(model.data.items).toHaveLength(0);
    expect(model.data.unscheduled.map((i) => i.id)).toContain("legacy");
  });

  it("et la vue calendrier est bien celle qui le reçoit", () => {
    const screen = monthScreen({ ...STATES.manual_items_only, detail: null, view: "calendar" });
    expect(screen.kind).toBe("calendar");
  });
});
