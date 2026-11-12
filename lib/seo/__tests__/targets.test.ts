import { describe, expect, it } from "vitest";
import {
  chooseMonthTargets,
  deriveTargets,
  intentFragment,
  metricKey,
  normalizeQuery,
  rankTargets,
  targetMatchesBrief,
  type BriefGrid,
  type QueryTemplate,
  type SearchTerms,
} from "@/lib/seo/targets";

/* La banque telle que la migration 20261112100000 la pose. */
const TEMPLATES: QueryTemplate[] = [
  { id: "local_modality_city", kind: "local_page", queryPattern: "{modality} in {city}, {state}", intentPattern: "local:{modality}:{city}-{state}", priority: 10, active: true },
  { id: "local_population_city", kind: "local_page", queryPattern: "therapy for {population} in {city}, {state}", intentPattern: "local:pop-{population}:{city}-{state}", priority: 20, active: true },
  { id: "article_modality_population", kind: "article", queryPattern: "{modality} for {population}", intentPattern: "article:{modality}:for-{population}", priority: 30, active: true },
  { id: "article_first_session", kind: "article", queryPattern: "what to expect in a first {modality} session", intentPattern: "article:{modality}:first-session", priority: 40, active: true },
  { id: "article_how_it_works", kind: "article", queryPattern: "how {modality} works", intentPattern: "article:{modality}:how-it-works", priority: 50, active: true },
];

const TERMS: SearchTerms = {
  modality: new Map([
    ["emdr", "EMDR therapy"],
    ["ifs", "IFS therapy"],
  ]),
  population: new Map([
    ["new_parents", "new parents"],
    ["high_functioning", "high-achieving professionals"],
  ]),
};

const GRID: BriefGrid = {
  modalityKeys: ["emdr", "ifs"],
  populationKeys: ["new_parents", "high_functioning"],
  state: "ca",
  city: " Oakland ",
};

describe("générer les cibles", () => {
  const targets = deriveTargets(GRID, TEMPLATES, TERMS);

  it("croise la grille et la banque, sans doublon", () => {
    // local : 2 modalités + 2 personas ; articles : 2×2 + 2 + 2
    expect(targets.filter((t) => t.kind === "local_page")).toHaveLength(4);
    expect(targets.filter((t) => t.kind === "article")).toHaveLength(8);
    expect(new Set(targets.map((t) => t.intentKey)).size).toBe(targets.length);
  });

  it("remplit la requête avec les termes et l'intention avec les clés", () => {
    const local = targets.find((t) => t.intentKey === "local:emdr:oakland-ca");
    expect(local?.primaryQuery).toBe("EMDR therapy in Oakland, CA");
    expect(local?.state).toBe("CA");
    expect(local?.city).toBe("Oakland");
    const pop = targets.find((t) => t.intentKey === "article:emdr:for-new_parents");
    expect(pop?.primaryQuery).toBe("EMDR therapy for new parents");
    expect(pop?.state).toBeNull();
  });

  it("est déterministe", () => {
    expect(deriveTargets(GRID, TEMPLATES, TERMS)).toEqual(targets);
  });

  it("n'invente rien : une clé sans terme curé est écartée", () => {
    const t = deriveTargets({ ...GRID, modalityKeys: ["reiki"] }, TEMPLATES, TERMS);
    expect(t.some((x) => x.modalityKey === "reiki")).toBe(false);
    expect(t.every((x) => x.populationKey !== null)).toBe(true);
  });

  it("sans ville ou sans État : aucune page locale", () => {
    expect(deriveTargets({ ...GRID, city: null }, TEMPLATES, TERMS).some((t) => t.kind === "local_page")).toBe(false);
    expect(deriveTargets({ ...GRID, state: "California" }, TEMPLATES, TERMS).some((t) => t.kind === "local_page")).toBe(false);
  });

  it("un gabarit inactif ne produit rien", () => {
    const off = TEMPLATES.map((t) => (t.id === "article_how_it_works" ? { ...t, active: false } : t));
    expect(deriveTargets(GRID, off, TERMS).some((t) => t.templateId === "article_how_it_works")).toBe(false);
  });

  it("normalise un lieu accentué dans l'intention", () => {
    expect(intentFragment("San José")).toBe("san-jose");
    expect(intentFragment("  Mill Valley ")).toBe("mill-valley");
  });
});

describe("classer", () => {
  const targets = deriveTargets(GRID, TEMPLATES, TERMS);

  it("sans métrique : la page locale de la modalité principale d'abord, puis les populations", () => {
    const ranked = rankTargets(targets, new Map());
    const locals = ranked.filter((t) => t.kind === "local_page").map((t) => t.intentKey);
    expect(locals[0]).toBe("local:emdr:oakland-ca");
    expect(locals[1]).toBe("local:ifs:oakland-ca");
    expect(locals.slice(2).every((k) => k.startsWith("local:pop-"))).toBe(true);
    const articles = ranked.filter((t) => t.kind === "article").map((t) => t.templateId);
    expect(articles[0]).toBe("article_modality_population");
    expect(articles.indexOf("article_first_session")).toBeLessThan(articles.indexOf("article_how_it_works"));
  });

  it("avec une métrique : le volume mesuré passe devant la priorité", () => {
    const ifsLocal = targets.find((t) => t.intentKey === "local:ifs:oakland-ca")!;
    const ranked = rankTargets(targets, new Map([[metricKey(ifsLocal), 90]]));
    expect(ranked.filter((t) => t.kind === "local_page")[0].intentKey).toBe("local:ifs:oakland-ca");
    expect(metricKey(ifsLocal)).toBe("ifs therapy in oakland, ca|CA");
  });

  it("normalise comme le CHECK de seo_query_metrics", () => {
    expect(normalizeQuery("  EMDR   Therapy in Oakland, CA ")).toBe("emdr therapy in oakland, ca");
  });
});

describe("anti-cannibalisation et quota", () => {
  const ranked = rankTargets(deriveTargets(GRID, TEMPLATES, TERMS), new Map());

  it("1 page locale + 2 articles, de deux gabarits différents", () => {
    const month = chooseMonthTargets(ranked, new Set(), { local_page: 1, article: 2 });
    expect(month.local_page.map((t) => t.intentKey)).toEqual(["local:emdr:oakland-ca"]);
    expect(month.article).toHaveLength(2);
    expect(new Set(month.article.map((t) => t.templateId)).size).toBe(2);
  });

  it("exclut toute intention déjà assignée chez elle", () => {
    const taken = new Set(["local:emdr:oakland-ca", "article:emdr:for-new_parents"]);
    const month = chooseMonthTargets(ranked, taken, { local_page: 1, article: 2 });
    expect(month.local_page[0].intentKey).toBe("local:ifs:oakland-ca");
    expect(month.article.map((t) => t.intentKey)).not.toContain("article:emdr:for-new_parents");
  });

  it("douze mois sans jamais deux fois la même intention", () => {
    const taken = new Set<string>();
    for (let m = 0; m < 12; m += 1) {
      const month = chooseMonthTargets(ranked, taken, { local_page: 1, article: 2 });
      for (const t of [...month.local_page, ...month.article]) {
        expect(taken.has(t.intentKey)).toBe(false);
        taken.add(t.intentKey);
      }
    }
    expect(taken.size).toBe(12);
  });

  it("quota zéro : aucune cible", () => {
    const month = chooseMonthTargets(ranked, new Set(), { local_page: 0, article: 0 });
    expect(month.local_page).toEqual([]);
    expect(month.article).toEqual([]);
  });

  it("une cible enregistrée qui ne correspond plus au brief est écartée", () => {
    const local = ranked.find((t) => t.intentKey === "local:emdr:oakland-ca")!;
    expect(targetMatchesBrief(local, GRID)).toBe(true);
    expect(targetMatchesBrief(local, { ...GRID, city: "Berkeley" })).toBe(false);
    expect(targetMatchesBrief(local, { ...GRID, modalityKeys: ["ifs"] })).toBe(false);
  });
});

describe("une cible impossible n'est pas proposée (session 2, profil C′)", () => {
  it("une requête de plus de 60 caractères ne peut pas entrer dans un title de 60 : elle est écartée", () => {
    const terms: SearchTerms = {
      modality: new Map([["gottman", "Gottman Method couples therapy"]]),
      population: new Map([["couples_roommates", "couples"]]),
    };
    const t = deriveTargets(
      { modalityKeys: ["gottman"], populationKeys: ["couples_roommates"], state: "CA", city: "San Diego" },
      TEMPLATES,
      terms
    );
    // La requête réelle, 64 caractères, qui a fini en quarantaine sur seo.query_missing.
    expect("what to expect in a first Gottman Method couples therapy session".length).toBe(64);
    expect(t.map((x) => x.primaryQuery)).not.toContain("what to expect in a first Gottman Method couples therapy session");
    expect(t.every((x) => x.primaryQuery.length <= 60)).toBe(true);
    // Les autres cibles de la même grille restent.
    expect(t.map((x) => x.primaryQuery)).toContain("Gottman Method couples therapy in San Diego, CA");
  });
});
