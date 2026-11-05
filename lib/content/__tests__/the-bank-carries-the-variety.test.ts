import { describe, expect, it } from "vitest";
import { admitToSegment, bankOpeningCap, MYTH_INTENT, saturatedOpenings, situationFor, topicOpenings, type BankTopicText } from "@/lib/content/bank-variety";
import { CANDIDATES_PER_ATTEMPT, drawnPerAttempt, drawQuotas, POSTS_PER_MONTH } from "@/lib/content/bank";
import { checkMix, LONE_SENTENCE, MONTH_LIMITS } from "@/lib/content/month-checks";
import { payloadShape } from "@/lib/compose/archetypes/schema";
import { PRACTITIONER_CARDS_PER_MONTH } from "@/lib/content/practitioner";

/*
 * LA BANQUE (2026-11-04). Le mois refusé sur « when… », « an unwanted… »,
 * « EMDR is… » tenait ces ouvertures de la banque ; le contrôle est posé où les
 * sujets s'écrivent. Et le tirage suit la forme des charges utiles.
 */
const t = (title: string, hook: string, intent = "educate"): BankTopicText => ({ title, hook, intent });

describe("la variété se contrôle à l'écriture du sujet, avec la notion d'ouverture du mois", () => {
  const segment = Array.from({ length: 29 }, (_, i) => t(`Idea number ${i}`, `Hook ${i} opens its own way.`));

  it("les familles d'ouverture d'un sujet : son titre et sa ligne d'image, comme au mois", () => {
    expect(topicOpenings(t("When the plan changes", "An unchosen change can unsettle."))).toEqual(["title/lead:when", "hook/lead:a unwanted"]);
  });

  it("un segment de trente admet trois titres en « when… », pas quatre", () => {
    expect(bankOpeningCap(30)).toBe(3);
    const two = [...segment.slice(0, 27), t("When x", "a."), t("When y", "b.")];
    expect(admitToSegment(two, t("When z", "c."))).toBeNull();
    const three = [...two, t("When z", "c.")];
    expect(admitToSegment(three, t("When w", "d."))).toMatch(/^opening title\/lead:when: 4 of 31, cap 3/);
  });

  it("« an unwanted » et « an unchosen » sont une même famille, comme au mois", () => {
    const two = [...segment.slice(0, 18), t("a", "An unwanted change."), t("b", "An unchosen move.")];
    expect(admitToSegment(two, t("c", "An unplanned loss."))).toMatch(/hook\/lead:a unwanted/);
  });

  it("« corriger un mythe » est plafonné à 20 % du segment", () => {
    const myths = [...segment.slice(0, 23), ...Array.from({ length: 6 }, (_, i) => t(`Myth ${i}`, `Myth hook ${i}.`, MYTH_INTENT))];
    expect(admitToSegment(myths, t("Another myth", "Fresh hook.", MYTH_INTENT))).toMatch(/correct_a_myth: 7 of 30, cap 6/);
    expect(admitToSegment(myths, t("Not a myth", "Fresh hook.", "invite"))).toBeNull();
  });

  it("les ouvertures fermées sont dites au rédacteur", () => {
    const closed = saturatedOpenings([...segment.slice(0, 26), t("When x", "a."), t("When y", "b."), t("When z", "c.")]);
    expect(closed).toContain("title/lead:when");
  });

  it("l'axe de situation tourne dans la liste de la population, et ne s'invente pas", () => {
    expect(situationFor("crossroads", 0)).not.toBe(situationFor("crossroads", 1));
    expect(situationFor("unknown_population", 0)).toBeNull();
  });
});

describe("le plafond d'archétypes à liste, et le tirage qui le porte", () => {
  it("le tirage suit la part du plafond : 40 % de candidats à liste", () => {
    const drawn = drawnPerAttempt();
    const list = Object.entries(drawn).filter(([k]) => payloadShape(k) === "list").reduce((s, [, n]) => s + n, 0);
    expect(list).toBe(Math.round(CANDIDATES_PER_ATTEMPT * MONTH_LIMITS.maxListShare));
    expect(Object.values(drawQuotas()).reduce((a, b) => a + b, 0)).toBe(CANDIDATES_PER_ATTEMPT);
  });

  it("les deux plafonds tiennent ensemble : assez de posts à phrase possibles sans dépasser les phrases seules", () => {
    const n = POSTS_PER_MONTH;
    const phraseNeeded = n - Math.floor(n * MONTH_LIMITS.maxListShare);
    /* ⚠ Les phrases seules sont bornées par DEUX plafonds : 40 % (phrases seules) et le leur, 35 % — 10 sur 30. */
    const loneMax = Math.min(Math.ceil(n * MONTH_LIMITS.maxLoneSentenceShare) - 1, Math.floor(n * MONTH_LIMITS.archetypeShareCaps.single_statement));
    expect(loneMax).toBe(10);
    /* La marge : 21 possibles, 16 nécessaires (2026-11-05). */
    expect(loneMax + Math.floor(n * MONTH_LIMITS.maxArchetypeShare) + PRACTITIONER_CARDS_PER_MONTH - phraseNeeded).toBe(5);
    const carouselMax = Math.floor(n * MONTH_LIMITS.maxArchetypeShare);
    expect(loneMax + carouselMax + PRACTITIONER_CARDS_PER_MONTH).toBeGreaterThanOrEqual(phraseNeeded);
    /* Et un mois qui les tient tous est un mois que `checkMix` accepte. */
    const month = [
      ...Array(loneMax).fill(LONE_SENTENCE),
      ...Array(phraseNeeded - loneMax - PRACTITIONER_CARDS_PER_MONTH).fill("carousel"),
      ...Array(PRACTITIONER_CARDS_PER_MONTH).fill("practitioner_card"),
      ...["surface_and_beneath", "comparison_pair", "numbered_strategies", "cycle", "concentric_control", "quadrant_model", "annotated_curve", "lettered_technique", "comparison_pair", "surface_and_beneath", "cycle", "quadrant_model", "numbered_strategies", "concentric_control"],
    ];
    expect(month).toHaveLength(n);
    expect(checkMix(month)).toEqual([]);
  });

  it("un quinzième post à liste est refusé ; une onzième phrase seule aussi", () => {
    const swapped = [...Array(10).fill(LONE_SENTENCE), ...Array(5).fill("carousel"), ...Array(15).fill("comparison_pair")];
    expect(checkMix([...Array(11).fill(LONE_SENTENCE), ...Array(5).fill("carousel"), ...Array(14).fill("comparison_pair")]).map((f) => f.check)).toContain("mix.dominant");
    expect(checkMix(swapped).map((f) => f.check)).toContain("mix.list");
  });
});
