import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  buildSinceRows,
  buildWeekStrip,
  homeAsOfDate,
  homeHeaderDate,
  hrefForNotification,
  nyDateKey,
  pickNextAction,
  type NextAction,
} from "@/lib/data/home";
import type { LaunchProgress, LaunchStepKey } from "@/lib/data/checklist";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";
import type { ContentItem, ContentMonth } from "@/lib/data/content";
import type { BrandKit } from "@/lib/data/brand-kit";
import type { Notification } from "@/lib/data/notifications";

/*
 * The home canvas's data shaping is pure -- everything below is a function of
 * its arguments, no Supabase client anywhere -- so it is tested directly,
 * spending nothing, the same discipline as the rest of this chantier.
 */

const CONTEXT: LaunchStepContext = {
  practiceName: "Elm & Ember Therapy",
  practitionerLine: "Dana Whitfield, LCSW",
  aboutExcerpt: "About copy.",
  practiceDetails: null,
  bookingUrl: null,
  assetsHref: "/app/brand-kits/k1/assets",
  siteHref: "/app/brand-kits/k1/site-editor",
};

function step(key: LaunchStepKey, status: "todo" | "done" | "skipped") {
  return { key, label: key, description: null, status };
}

function progress(items: LaunchProgress["items"]): LaunchProgress {
  return { items, resolvedCount: items.filter((i) => i.status !== "todo").length, total: items.length };
}

function item(overrides: Partial<ContentItem>): ContentItem {
  return {
    id: overrides.id ?? "item-1",
    brand_kit_id: "k1",
    archetype: "statement",
    status: "ready",
    title: "A post",
    caption: null,
    alt_text: null,
    tags: [],
    category: null,
    image_slot: null,
    // Null, like every item in production: these predate the generator.
    register: null,
    month_id: null,
    scheduled_for: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    posted: false,
    posted_at: null,
    channel: null,
    ...overrides,
  };
}

function month(items: ContentItem[], ready = items.length): ContentMonth {
  return {
    month: "2026-09-01",
    items,
    unscheduled: [],
    counts: { scheduled: items.length, ready, posted: 0 },
  };
}

describe("nyDateKey et addDaysToKey", () => {
  it("lit le jour dans le fuseau du produit, pas celui du serveur", () => {
    // 1er octobre 00:30 UTC est encore le 30 septembre à New York.
    expect(nyDateKey(new Date("2026-10-01T00:30:00Z"))).toBe("2026-09-30");
  });

  it("avance de N jours civils, en traversant un changement de mois", () => {
    expect(addDaysToKey("2026-09-29", 3)).toBe("2026-10-02");
    expect(addDaysToKey("2026-09-06", -6)).toBe("2026-08-31");
  });
});

describe("homeHeaderDate et homeAsOfDate", () => {
  it("rendent le format attendu par l'en-tête et la légende", () => {
    const noon = new Date("2026-09-05T16:00:00Z"); // 12:00 EDT
    expect(homeHeaderDate(noon)).toBe("Saturday, September 5");
    expect(homeAsOfDate(noon)).toBe("Sep 5, 2026");
  });
});

describe("⚠ pickNextAction — exactement UNE chose, jamais une liste", () => {
  it("une étape de lancement non résolue passe avant tout contenu", () => {
    const result = pickNextAction({
      checklist: progress([step("site_setup", "done"), step("update_directory", "todo")]),
      month: month([item({ scheduled_for: nyDateKey(new Date()) })]),
      todayKey: nyDateKey(new Date()),
      launchContext: CONTEXT,
      photoUrlFor: () => null,
    });
    expect(result.kind).toBe("launch_step");
    if (result.kind === "launch_step") expect(result.step.key).toBe("update_directory");
  });

  it("prend la PREMIÈRE étape non résolue, dans l'ordre reçu", () => {
    const result = pickNextAction({
      checklist: progress([
        step("site_setup", "skipped"),
        step("update_directory", "todo"),
        step("google_profile", "todo"),
      ]),
      month: month([]),
      todayKey: "2026-09-06",
      launchContext: CONTEXT,
      photoUrlFor: () => null,
    });
    expect(result.kind).toBe("launch_step");
    if (result.kind === "launch_step") expect(result.step.key).toBe("update_directory");
  });

  it("checklist résolue : le contenu dans les trois jours devient le geste", () => {
    const today = "2026-09-06";
    const inRange = item({ id: "in-range", scheduled_for: "2026-09-08" });
    const result = pickNextAction({
      checklist: progress([step("site_setup", "done")]),
      month: month([inRange]),
      todayKey: today,
      launchContext: CONTEXT,
      photoUrlFor: () => null,
    });
    expect(result.kind).toBe("content_item");
    if (result.kind === "content_item") expect(result.item.id).toBe("in-range");
  });

  it("hors de la fenêtre de trois jours, ce n'est pas le geste", () => {
    const result = pickNextAction({
      checklist: progress([step("site_setup", "done")]),
      month: month([item({ scheduled_for: "2026-09-15" })]),
      todayKey: "2026-09-06",
      launchContext: CONTEXT,
      photoUrlFor: () => null,
    });
    expect(result.kind).toBe("none");
  });

  it("un item déjà publié ne redevient pas le geste", () => {
    const result = pickNextAction({
      checklist: progress([step("site_setup", "done")]),
      month: month([item({ scheduled_for: "2026-09-07", posted: true })]),
      todayKey: "2026-09-06",
      launchContext: CONTEXT,
      photoUrlFor: () => null,
    });
    expect(result.kind).toBe("none");
  });

  it("le plus proche des candidats gagne", () => {
    const near = item({ id: "near", scheduled_for: "2026-09-07" });
    const far = item({ id: "far", scheduled_for: "2026-09-08" });
    const result = pickNextAction({
      checklist: progress([step("site_setup", "done")]),
      month: month([far, near]),
      todayKey: "2026-09-06",
      launchContext: CONTEXT,
      photoUrlFor: () => null,
    });
    expect(result.kind).toBe("content_item");
    if (result.kind === "content_item") expect(result.item.id).toBe("near");
  });

  it("rien à faire : le troisième état, une valeur nommée plutôt qu'un null", () => {
    const result: NextAction = pickNextAction({
      checklist: progress([step("site_setup", "done")]),
      month: month([]),
      todayKey: "2026-09-06",
      launchContext: CONTEXT,
      photoUrlFor: () => null,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("le slot de l'item choisi passe par photoUrlFor, jamais deviné", () => {
    const withSlot = item({ scheduled_for: "2026-09-07", image_slot: "post_bg_1" });
    const result = pickNextAction({
      checklist: progress([step("site_setup", "done")]),
      month: month([withSlot]),
      todayKey: "2026-09-06",
      launchContext: CONTEXT,
      photoUrlFor: (slot) => (slot === "post_bg_1" ? "https://signed.example/x.webp" : null),
    });
    expect(result.kind).toBe("content_item");
    if (result.kind === "content_item") expect(result.photoUrl).toBe("https://signed.example/x.webp");
  });
});

describe("buildWeekStrip", () => {
  it("rend sept jours, dimanche en premier, contenant aujourd'hui", () => {
    // 2026-09-06 est un dimanche.
    const days = buildWeekStrip(month([]), "2026-09-06");
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe("2026-09-06");
    expect(days[6].key).toBe("2026-09-12");
    expect(days[0].isToday).toBe(true);
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
  });

  it("marque un point sous chaque jour qui porte du contenu daté", () => {
    const days = buildWeekStrip(month([item({ scheduled_for: "2026-09-08" })]), "2026-09-06");
    const tuesday = days.find((d) => d.key === "2026-09-08");
    expect(tuesday?.hasContent).toBe(true);
    expect(days.filter((d) => d.hasContent)).toHaveLength(1);
  });

  it("un item sans date ne marque aucun jour", () => {
    const days = buildWeekStrip(month([item({ scheduled_for: null })]), "2026-09-06");
    expect(days.some((d) => d.hasContent)).toBe(false);
  });
});

describe("hrefForNotification", () => {
  const KIT = "k1";

  it("asset_rendered mène à la bibliothèque, filtrée sur la clé quand elle existe", () => {
    const n: Notification = {
      id: "n1",
      kind: "asset_rendered",
      payload: { key: "wordmark", asset_id: "a1" },
      read_at: null,
      created_at: "2026-09-06T00:00:00Z",
    };
    expect(hrefForNotification(KIT, n)).toBe("/app/brand-kits/k1/assets?keys=wordmark");
  });

  it("site_stale mène à l'éditeur de site", () => {
    const n: Notification = {
      id: "n2",
      kind: "site_stale",
      payload: {},
      read_at: null,
      created_at: "2026-09-06T00:00:00Z",
    };
    expect(hrefForNotification(KIT, n)).toBe("/app/brand-kits/k1/site-editor");
  });

  /*
   * ⚠ LE CAS `content_ready` A DISPARU AVEC SON GENRE.
   *
   * Ce bloc vérifiait qu'un `content_ready` était routé vers le calendrier
   * plutôt que vers `payload.item_id`, parce que cet id pointait dans l'espace
   * d'ids d'une table morte. Le chantier Content a retiré la table, le genre,
   * sa contrainte CHECK et l'index partiel qui indexait ce payload
   * (20260910082539). Le genre n'est plus dans `NotificationKind`, donc le
   * test ne peut plus se construire — et c'est le bon échec : il ne compile
   * pas, plutôt que de passer en testant un genre que la base refuse.
   *
   * Ce qui reste vérifié est plus fort : un genre inconnu tombe sur `default`.
   */
  it("un genre inconnu retombe sur l'accueil, sans deviner d'id", () => {
    const n = {
      id: "n3",
      kind: "something_we_do_not_know",
      payload: { item_id: "an-id-from-nowhere" },
      read_at: null,
      created_at: "2026-09-06T00:00:00Z",
    } as unknown as Notification;

    const href = hrefForNotification(KIT, n);
    expect(href).toBe("/app");
    expect(href).not.toContain("an-id-from-nowhere");
  });
});

describe("buildSinceRows", () => {
  const KIT = { row: { id: "k1" }, selectedDirection: { name: "Quiet Room" } } as unknown as BrandKit;

  it("replie l'ancien bandeau « site prêt » comme première ligne, sous la même condition", () => {
    const rows = buildSinceRows({ kit: KIT, month: month([], 0), notifications: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("site-ready");
    expect(rows[0].href).toBe("/app/brand-kits/k1/site-editor");
  });

  it("ne replie rien dès qu'un item est prêt ce mois-ci", () => {
    const rows = buildSinceRows({ kit: KIT, month: month([item({})], 1), notifications: [] });
    expect(rows.some((r) => r.id === "site-ready")).toBe(false);
  });

  it("plafonne à trois lignes, bandeau replié compris", () => {
    const notifications: Notification[] = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`,
      kind: "asset_rendered",
      payload: { key: `k${i}` },
      read_at: null,
      created_at: "2026-09-06T00:00:00Z",
    }));
    const rows = buildSinceRows({ kit: KIT, month: month([], 0), notifications });
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe("site-ready");
  });
});
