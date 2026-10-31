import { describe, expect, it } from "vitest";
import {
  checkVariety,
  measureVariety,
  negationsIn,
  openingCap,
  openingFamilies,
} from "@/lib/content/variety";
import { checkAcrossPosts, type PostUnderCheck } from "@/lib/content/month-checks";
import { NOVEMBER_2026, type NovemberPost } from "@/lib/content/__tests__/fixtures/november-2026-openings";

/*
 * Novembre 2026, kit 45de0dac : 24 posts, aucun titre en double, et la même
 * formule partout. Ce que la déduplication des titres ne voyait pas.
 */

const asPost = (p: NovemberPost): PostUnderCheck => ({
  archetype: "single_statement",
  title: p.cardLine,
  cardLine: p.cardLine,
  payload: p.statement ? { statement: p.statement } : {},
  caption: p.caption,
  hook: p.hook,
});
const published = NOVEMBER_2026.filter((p) => p.published).map(asPost);

describe("les constructions d'ouverture se replient en familles", () => {
  it("« An unwanted / An unchosen / An unwanted crossroads » sont une seule construction", () => {
    const families = [
      "An unwanted change can leave you grieving.",
      "An unchosen change can bring grief.",
      "An unwanted turning point can hold more than one emotion.",
      "An unwanted crossroads can bring grief.",
    ].map((s) => openingFamilies(s)[0]);
    expect(new Set(families)).toEqual(new Set(["lead:a unwanted"]));
  });

  it("« EMDR is not… » et « EMDR does not… » partagent la famille « emdr + négation »", () => {
    expect(openingFamilies("EMDR is not designed to erase the past.")).toContain("neg:emdr");
    expect(openingFamilies("EMDR does not require telling every detail.")).toContain("neg:emdr");
    expect(openingFamilies("EMDR isn't limited to the worst memory.")).toContain("neg:emdr");
  });

  it("une subordonnée se lit par son subordonnant", () => {
    expect(openingFamilies("When the past still shapes today, CBT can help.")[0]).toBe("lead:when");
    expect(openingFamilies("When a plan changes without consent.")[0]).toBe("lead:when");
  });
});

describe("la négation se lit sur son sujet, pas dans une relative", () => {
  it("« CBT does not ask… » deux fois est la même négation", () => {
    expect(negationsIn("CBT does not ask someone to feel grateful.")).toEqual(["cbt not ask"]);
    expect(negationsIn("CBT does not ask people to think positively.")).toEqual(["cbt not ask"]);
  });

  it("« not only » garde le mot nié qui suit", () => {
    expect(negationsIn("EMDR is not only about revisiting what happened.")).toEqual(["emdr not about"]);
  });

  it("« a future that never got to happen » n'est pas une négation sur un sujet", () => {
    expect(negationsIn("An unchosen change can bring grief for a future that never got to happen.")).toEqual([]);
    expect(negationsIn("a life change they never wanted")).toEqual([]);
  });
});

describe("mesuré sur le mois de novembre 2026 tel qu'il est sorti", () => {
  it("le plafond est une part fixe : 3 sur 24, 4 sur 30", () => {
    expect(openingCap(24)).toBe(3);
    expect(openingCap(30)).toBe(4);
  });

  it("il aurait été refusé sur cinq constats, ceux que la relecture a vus", () => {
    const findings = checkVariety(published);
    expect(findings.map((f) => f.check).sort()).toEqual([
      "variety.negation", "variety.negation", "variety.opening", "variety.opening", "variety.opening",
    ]);
    const report = measureVariety(published);
    const count = (family: string) => report.openings.find((o) => o.family === family)?.posts.length;
    expect(count("lead:a unwanted")).toBe(6);
    expect(count("lead:when")).toBe(4);
    expect(count("neg:emdr")).toBe(4);
    expect(report.negations.map((n) => n.key).sort()).toEqual(["cbt not ask", "you not have"]);
  });

  it("chaque constat nomme un post par sa ligne de carte — c'est ce que la sélection échange", () => {
    for (const f of checkVariety(published)) {
      expect(published.some((p) => f.detail.includes(`« ${p.cardLine} »`)), f.detail).toBe(true);
    }
  });

  it("le contrôle est dans le mois : `checkAcrossPosts` le rend", () => {
    const checks = checkAcrossPosts({ posts: published } as never).map((f) => f.check);
    expect(checks).toContain("variety.opening");
    expect(checks).toContain("variety.negation");
  });

  it("et les 57 posts déjà payés contenaient un mois de 30 sans constat de variété", () => {
    const all = NOVEMBER_2026.map(asPost);
    const chosen: PostUnderCheck[] = [];
    for (const p of all) {
      if (chosen.length >= 30) break;
      if (checkVariety([...chosen, p]).length === 0) chosen.push(p);
    }
    expect(chosen).toHaveLength(30);
  });
});
