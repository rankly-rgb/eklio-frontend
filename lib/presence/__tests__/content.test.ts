import { describe, expect, it } from "vitest";
import {
  clampCalendar,
  monthlyPresenceSchema,
  parseStoredPresence,
  publishablePresenceText,
  type CalendarEntry,
} from "@/lib/presence/content";
import {
  daysInMonth,
  formatMonth,
  isMonthKey,
  monthStart,
  parseMonthKey,
  weekdayOf,
} from "@/lib/presence/month";
import { checkEthics } from "@/lib/ethics/rules";
import {
  MONTHLY_PRESENCE_POSTS,
  MONTHLY_PRESENCE_STORIES,
} from "@/lib/billing/plans";

/*
 * Le livrable mensuel est la surface publiable la plus volumineuse et la plus
 * répétée du produit : douze posts par mois, tous les mois, publiés sans
 * relecture d'un tiers. Deux choses doivent donc tenir absolument — qu'aucune
 * borne de comptage ne puisse jeter un mois entier (leçon n°2 du kit), et que
 * RIEN de publiable n'échappe au contrôle déontologique.
 */

function post(n: number) {
  return {
    title: `Post ${n}`,
    hook: `A first line for post ${n}.`,
    caption: `The body of post ${n}, written plainly.`,
    teaches: "What a session actually involves.",
  };
}

function story(n: number) {
  return {
    title: `Story ${n}`,
    prompt: `Show something for story ${n}.`,
    purpose: "Take one unknown off the table.",
  };
}

function month(overrides: Record<string, unknown> = {}) {
  return {
    month_focus: "This month attends to what the first session involves.",
    posts: Array.from({ length: MONTHLY_PRESENCE_POSTS }, (_, i) => post(i + 1)),
    stories: Array.from({ length: MONTHLY_PRESENCE_STORIES }, (_, i) =>
      story(i + 1)
    ),
    calendar: [{ day: 3, publish: "Post 1", note: "Morning." }],
    ...overrides,
  };
}

describe("normalisation des listes — aucune borne cassante", () => {
  it("accepte un mois au compte exact", () => {
    const parsed = parseStoredPresence(month());

    expect(parsed?.posts).toHaveLength(MONTHLY_PRESENCE_POSTS);
    expect(parsed?.stories).toHaveLength(MONTHLY_PRESENCE_STORIES);
  });

  it("garde les premiers quand le modèle en écrit trop, sans rien rejeter", () => {
    /*
     * C'est exactement ce qui a détruit un kit complet : le modèle avait rendu
     * six contre-exemples pour un maximum annoncé de cinq, et une borne zod a
     * jeté 127 secondes de génération. « 12 posts » est une consigne en
     * langage naturel, jamais une garantie — l'API n'autorise pas `maxItems`
     * dans un schéma d'outil strict.
     */
    const parsed = parseStoredPresence(
      month({
        posts: Array.from({ length: 18 }, (_, i) => post(i + 1)),
        stories: Array.from({ length: 9 }, (_, i) => story(i + 1)),
      })
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.posts).toHaveLength(MONTHLY_PRESENCE_POSTS);
    expect(parsed?.posts[0].title).toBe("Post 1");
    expect(parsed?.stories).toHaveLength(MONTHLY_PRESENCE_STORIES);
  });

  it("accepte un mois plus court que demandé plutôt que de le jeter", () => {
    // Onze posts valent infiniment mieux que zéro post et deux minutes perdues.
    const parsed = parseStoredPresence(
      month({ posts: [post(1), post(2), post(3)] })
    );

    expect(parsed?.posts).toHaveLength(3);
  });

  it("refuse en revanche une liste VIDE, qui n'est plus un livrable", () => {
    expect(parseStoredPresence(month({ posts: [] }))).toBeNull();
    expect(parseStoredPresence(month({ stories: [] }))).toBeNull();
    expect(parseStoredPresence(month({ calendar: [] }))).toBeNull();
  });

  it("refuse une forme inattendue plutôt que d'afficher un mois à trous", () => {
    expect(parseStoredPresence(null)).toBeNull();
    expect(parseStoredPresence({})).toBeNull();
    expect(parseStoredPresence("un mois")).toBeNull();
    expect(
      parseStoredPresence(month({ calendar: [{ day: 3, publish: "Post 1" }] }))
    ).toBeNull();
  });

  it("accepte une prose longue sans la tronquer au milieu d'une phrase", () => {
    const long = "Une phrase de contenu. ".repeat(200);
    const parsed = monthlyPresenceSchema.safeParse(
      month({
        posts: [{ ...post(1), caption: long.trim() }],
      })
    );

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.posts[0].caption).toBe(long.trim());
  });
});

describe("clampCalendar — normaliser, pas rejeter", () => {
  const entries: CalendarEntry[] = [
    { day: 30, publish: "Post 3", note: "Afternoon." },
    { day: 31, publish: "Post 4", note: "Morning." },
    { day: 3, publish: "Post 1", note: "Morning." },
  ];

  it("écarte les jours hors du mois et remet le reste en ordre", () => {
    // Un 31 février est une erreur du modèle sur UNE entrée, pas une raison de
    // jeter douze posts et quatre stories.
    expect(clampCalendar(entries, 28).map((entry) => entry.day)).toEqual([3]);
    expect(clampCalendar(entries, 31).map((entry) => entry.day)).toEqual([
      3, 30, 31,
    ]);
  });
});

describe("mois — calage au premier, en UTC", () => {
  it("cale toujours au premier du mois", () => {
    expect(monthStart(new Date("2026-03-17T23:30:00Z"))).toBe("2026-03-01");
    expect(monthStart(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
    expect(monthStart(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-01");
  });

  it("reconnaît une clé valide et rejette tout ce qui ne l'est pas", () => {
    // La colonne porte le CHECK `month = date_trunc('month', month)`. Laisser
    // passer autre chose transformerait une faute d'appel en erreur Postgres.
    expect(isMonthKey("2026-03-01")).toBe(true);
    for (const bad of ["2026-03-15", "2026-3-01", "2026-13-01", "hier", ""]) {
      expect(isMonthKey(bad)).toBe(false);
      expect(parseMonthKey(bad)).toBeNull();
    }
    expect(parseMonthKey(null)).toBeNull();
  });

  it("compte les jours du mois, année bissextile comprise", () => {
    expect(daysInMonth("2026-02-01")).toBe(28);
    expect(daysInMonth("2028-02-01")).toBe(29);
    expect(daysInMonth("2026-04-01")).toBe(30);
    expect(daysInMonth("2026-12-01")).toBe(31);
  });

  it("écrit le mois et les jours en anglais", () => {
    expect(formatMonth("2026-03-01")).toBe("March 2026");
    expect(weekdayOf("2026-03-01", 1)).toBe("Sunday");
  });
});

describe("déontologie — rien de publiable n'échappe au contrôle", () => {
  it("aplatit CHAQUE champ de CHAQUE entrée, sans échantillonner", () => {
    /*
     * Contrairement au kit, RIEN n'est exclu ici : il n'y a pas de
     * contre-exemple pédagogique dans ce livrable, tout est destiné à être
     * publié — y compris les notes du calendrier, lues juste avant de publier.
     */
    const content = parseStoredPresence(
      month({
        posts: [post(1)],
        stories: [story(1)],
        calendar: [{ day: 3, publish: "Post 1", note: "Morning." }],
      })
    )!;

    const text = publishablePresenceText(content);

    for (const expected of [
      content.month_focus,
      content.posts[0].title,
      content.posts[0].hook,
      content.posts[0].caption,
      content.posts[0].teaches,
      content.stories[0].title,
      content.stories[0].prompt,
      content.stories[0].purpose,
      content.calendar[0].publish,
      content.calendar[0].note,
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("attrape une promesse de résultat glissée dans un HOOK", () => {
    // Le point de fuite propre au social : le hook doit arrêter le défilement,
    // et c'est là qu'un modèle entraîné au copywriting promet un résultat.
    const content = parseStoredPresence(
      month({
        posts: [
          {
            ...post(1),
            hook: "Three sessions to heal your anxiety for good.",
          },
        ],
      })
    )!;

    const violations = publishablePresenceText(content).flatMap(
      (text) => checkEthics(text).violations
    );

    expect(violations.some((violation) => violation.severity === "block")).toBe(
      true
    );
  });

  it("attrape un témoignage glissé dans une NOTE de calendrier", () => {
    const content = parseStoredPresence(
      month({
        calendar: [
          { day: 3, publish: "Post 1", note: "Add a client testimonial here." },
        ],
      })
    )!;

    const violations = publishablePresenceText(content).flatMap(
      (text) => checkEthics(text).violations
    );

    expect(violations.some((violation) => violation.severity === "block")).toBe(
      true
    );
  });

  it("laisse passer un mois conforme", () => {
    const content = parseStoredPresence(month())!;
    const violations = publishablePresenceText(content).flatMap(
      (text) => checkEthics(text).violations
    );

    expect(violations).toEqual([]);
  });
});
