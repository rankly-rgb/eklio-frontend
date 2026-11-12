import { describe, expect, it } from "vitest";
import {
  answersHeading,
  clinicalFindings,
  deterministicFindings,
  licenceFindings,
  linkFindings,
  placeFindings,
  practiceFactFindings,
  seoFindings,
  slugFor,
  structureFindings,
  type PieceText,
} from "@/lib/seo/checks";
import { collisionFindings, distanceFindings, shingles, specificityFindings } from "@/lib/seo/gates";
import { assembleBody } from "@/lib/seo/output";
import { fixtureOutput } from "@/lib/seo/__tests__/fixture-output";

const QUERY = "EMDR therapy in Oakland, CA";

function piece(over: Partial<PieceText> = {}, seed = 1): PieceText {
  const out = fixtureOutput({ query: QUERY, seed, bodyWords: 900 });
  return {
    kind: "local_page",
    primaryQuery: QUERY,
    city: "Oakland",
    state: "CA",
    title: out.title,
    meta: out.meta_description,
    h1: out.h1,
    slug: slugFor(QUERY),
    bodyMd: assembleBody(out),
    faq: out.faq,
    ...over,
  };
}

const ALLOWED = ["https://www.nimh.nih.gov/news", "https://www.apa.org/news"];
const checks = (fs: { check: string }[]) => fs.map((f) => f.check);

describe("la fixture passe tous les contrôles — sinon les tests de refus ne prouvent rien", () => {
  it("aucun constat", () => {
    expect(deterministicFindings(piece(), ALLOWED)).toEqual([]);
  });
});

describe("contrôles SEO", () => {
  it("title ≤ 60", () => {
    expect(checks(seoFindings(piece({ title: `${QUERY} — a long and careful explanation for you` })))).toContain("seo.title_length");
  });
  it("meta de 140 à 160", () => {
    expect(checks(seoFindings(piece({ meta: "Too short." })))).toContain("seo.meta_length");
    expect(checks(seoFindings(piece({ meta: "x".repeat(161) })))).toContain("seo.meta_length");
    expect(checks(seoFindings(piece({ meta: "x".repeat(140) })))).not.toContain("seo.meta_length");
  });
  it("un seul H1", () => {
    const p = piece();
    expect(checks(seoFindings({ ...p, bodyMd: `# Another title\n\n${p.bodyMd}` }))).toContain("seo.single_h1");
    expect(checks(seoFindings({ ...p, h1: "" }))).toContain("seo.single_h1");
  });
  it("la requête dans le title, le H1 et le premier paragraphe", () => {
    const p = piece();
    expect(checks(seoFindings({ ...p, title: "EMDR in the East" }))).toContain("seo.query_missing");
    expect(checks(seoFindings({ ...p, h1: "About EMDR" }))).toContain("seo.query_missing");
    expect(checks(seoFindings({ ...p, bodyMd: p.bodyMd.replace(QUERY, "This approach") }))).toContain("seo.query_missing");
    // la ponctuation et la casse ne comptent pas
    expect(checks(seoFindings({ ...p, title: "emdr therapy in oakland ca" }))).not.toContain("seo.query_missing");
  });
  it("slug en kebab-case sans mots vides", () => {
    expect(slugFor(QUERY)).toBe("emdr-therapy-oakland-ca");
    expect(slugFor("what to expect in a first EMDR therapy session")).toBe("expect-first-emdr-therapy-session");
    expect(checks(seoFindings(piece({ slug: "emdr-therapy-in-oakland" })))).toContain("seo.slug");
    expect(checks(seoFindings(piece({ slug: "EMDR_Oakland" })))).toContain("seo.slug");
  });
});

describe("structure", () => {
  it("bornes de mots par genre", () => {
    const short = piece({}, 2);
    const out = fixtureOutput({ query: QUERY, seed: 2, bodyWords: 400 });
    expect(checks(structureFindings({ ...short, bodyMd: assembleBody(out) }))).toContain("structure.word_count");
    expect(checks(structureFindings({ ...piece(), kind: "article" }))).toContain("structure.word_count");
  });
  it("FAQ de 4 à 6", () => {
    const p = piece();
    expect(checks(structureFindings({ ...p, faq: p.faq.slice(0, 3) }))).toContain("structure.faq_count");
    expect(checks(structureFindings({ ...p, faq: [...p.faq, ...p.faq] }))).toContain("structure.faq_count");
  });
  it("réponse d'abord", () => {
    expect(answersHeading("How does EMDR work?", "EMDR works by pairing recall with bilateral stimulation.")).toBe(true);
    expect(answersHeading("How does EMDR work?", "Many people wonder about this.")).toBe(false);
    expect(answersHeading("How does EMDR work?", "Have you ever wondered how EMDR works?")).toBe(false);
    expect(answersHeading("Is EMDR safe?", "Yes.")).toBe(false);
  });
});

describe("liens : la liste fermée d'insight_sources", () => {
  it("une URL hors liste fait échouer", () => {
    expect(checks(linkFindings("See [this](https://example.com/emdr).", ALLOWED))).toEqual(["links.not_allowed"]);
    expect(checks(linkFindings("Read https://www.nimh.nih.gov/news/fake-study today.", ALLOWED))).toEqual(["links.not_allowed"]);
    expect(checks(linkFindings("Visit www.emdria.org for more.", ALLOWED))).toEqual(["links.not_allowed"]);
  });
  it("une URL de la liste passe, à la barre finale près", () => {
    expect(linkFindings("See [NIMH](https://www.nimh.nih.gov/news/).", ALLOWED)).toEqual([]);
  });
});

describe("rien qui ne vienne du brief", () => {
  it("lieux", () => {
    expect(checks(placeFindings("Clients come from Berkeley and the Bay Area.", { city: "Oakland", state: "CA" }))).toContain("facts.place_invented");
    expect(checks(placeFindings("A practice in Oakland, CA.", { city: "Oakland", state: "CA" }))).toEqual([]);
    expect(checks(placeFindings("Near Lake Merritt.", { city: "Oakland", state: "CA" }))).toContain("facts.place_invented");
    expect(checks(placeFindings("Sessions in Portland, Oregon.", { city: "Oakland", state: "CA" }))).toContain("facts.place_invented");
    expect(checks(placeFindings("The office is at 1200 Grand Avenue.", { city: "Oakland", state: "CA" }))).toContain("facts.address_invented");
  });
  it("prix, assurance, format, expérience", () => {
    expect(checks(practiceFactFindings("Sessions are $180."))).toEqual(["facts.practice_invented"]);
    expect(checks(practiceFactFindings("We accept Aetna."))).toEqual(["facts.practice_invented"]);
    expect(checks(practiceFactFindings("Telehealth is available."))).toEqual(["facts.practice_invented"]);
    expect(checks(practiceFactFindings("With 15 years of experience."))).toEqual(["facts.practice_invented"]);
    expect(practiceFactFindings("A session lasts about fifty minutes.")).toEqual([]);
  });
});

describe("psychoéducation seulement", () => {
  it("ni guérison, ni diagnostic, ni promesse", () => {
    expect(checks(clinicalFindings("EMDR can cure trauma."))).toEqual(["clinical.claim"]);
    expect(checks(clinicalFindings("We will diagnose what is going on."))).toEqual(["clinical.claim"]);
    expect(checks(clinicalFindings("You will feel lighter after a few sessions."))).toEqual(["clinical.claim"]);
    expect(checks(clinicalFindings("It is highly effective."))).toEqual(["clinical.claim"]);
    expect(clinicalFindings("A secure, curious stance helps.")).toEqual([]);
  });
  it("la licence n'est pas dans le texte", () => {
    expect(checks(licenceFindings("Dana is an LMFT #123456."))).toEqual(["licence.in_body"]);
    expect(licenceFindings("An LMFT works with couples.")).toEqual([]);
  });
});

describe("gates adaptées au texte long", () => {
  it("la spécificité exige les faits de la grille", () => {
    const facts = { modalityTerm: "EMDR therapy", populationTerm: "new parents", city: "Oakland", brandText: "" };
    expect(checks(specificityFindings("EMDR therapy for new parents in Oakland.", facts))).toEqual([]);
    expect(checks(specificityFindings("EMDR therapy in Oakland.", facts))).toEqual(["gate.specificity"]);
  });
  it("la spécificité exige deux racines de son positionnement", () => {
    const facts = { modalityTerm: null, populationTerm: null, city: null, brandText: "Structured trauma work for exhausted surgeons and nurses" };
    expect(specificityFindings("Structured work for surgeons who are exhausted.", facts)).toEqual([]);
    expect(checks(specificityFindings("A generic page about therapy.", facts))).toEqual(["gate.specificity"]);
  });
  it("distance : un texte et sa copie se ressemblent, deux fixtures non", () => {
    const a = piece({}, 3).bodyMd;
    const b = piece({}, 4).bodyMd;
    expect(shingles(a).size).toBeGreaterThan(50);
    expect(checks(distanceFindings(a, [{ id: "x", text: a }]))).toEqual(["gate.own_distance"]);
    expect(distanceFindings(a, [{ id: "y", text: b }])).toEqual([]);
  });
  it("collision entre abonnées : le constat ne dit rien de l'autre", () => {
    const a = piece({}, 5).bodyMd;
    const found = collisionFindings(a, [{ id: "11111111-2222-3333-4444-555555555555", text: a }]);
    expect(checks(found)).toEqual(["gate.peer_collision"]);
    expect(found[0].detail).not.toContain("11111111");
  });
});
