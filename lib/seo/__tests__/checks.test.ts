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
import { collisionFindings, distanceFindings, questionOverlapFindings, shingles, specificityFindings } from "@/lib/seo/gates";
import { sentenceCase } from "@/lib/seo/checks";
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
  it("le constat de meta dit combien de caractères ajouter", () => {
    const f = seoFindings(piece({ meta: "x".repeat(132) })).find((x) => x.check === "seo.meta_length");
    expect(f?.detail).toContain("add 8 to 28 characters");
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
  it("une puce est un élément, pas une phrase d'introduction (défaut du premier mois réel)", () => {
    const p = piece();
    const body = p.bodyMd + "\n\n- Questions that can be useful during preparation include:\n- What are the phases?\n";
    expect(checks(structureFindings({ ...p, bodyMd: body }))).toContain("structure.bullet_lead_in");
  });
  it("une phrase qui annonce une liste est suivie de la liste (défaut du troisième passage réel)", () => {
    const p = piece();
    const detached = p.bodyMd + "\n\nYou might ask the following:\n\nIt is also reasonable to ask about pacing.\n\n- One\n- Two\n";
    expect(checks(structureFindings({ ...p, bodyMd: detached }))).toContain("structure.list_detached");
    const attached = p.bodyMd + "\n\nYou might ask the following:\n\n- One\n- Two\n";
    expect(checks(structureFindings({ ...p, bodyMd: attached }))).not.toContain("structure.list_detached");
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
    expect(answersHeading("Is EMDR safe?", "Maybe so.")).toBe(false);
  });
  it("réponse d'abord : une question fermée se répond par oui ou non (phrases du premier mois réel)", () => {
    expect(
      answersHeading("Can I stop EMDR processing during a session?", "Yes, you can tell the therapist that you want to pause, slow down, or shift the focus.")
    ).toBe(true);
    expect(answersHeading("What if I am unsure what to focus on?", "Yes, you can begin EMDR therapy without a fully defined target.")).toBe(true);
    expect(answersHeading("Is IFS only focused on childhood experiences?", "No.")).toBe(true);
    expect(answersHeading("Do I have to share every detail of a difficult experience?", "Not necessarily.")).toBe(true);
    expect(answersHeading("Can IFS and EMDR be used in the same therapy practice?", "Yes.")).toBe(true);
    expect(answersHeading("Can I stop EMDR processing during a session?", "Many people wonder about this part of the work.")).toBe(false);
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
    // ⚠ « medical » n'est pas Medi-Cal : faux positif du troisième passage réel (2026-11-12)
    expect(practiceFactFindings("A pregnancy, birth, postpartum medical event, or early caregiving experience.")).toEqual([]);
    expect(checks(practiceFactFindings("We accept Medi-Cal."))).toEqual(["facts.practice_invented"]);
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

describe("défauts relevés à la relecture du premier mois réel", () => {
  it("la même question sur deux pages de son site (formulations réelles)", () => {
    const found = questionOverlapFindings(
      ["Do I have to talk through every detail of a difficult experience?"],
      ["Do I have to share every detail of a difficult experience?", "Is EMDR only about eye movements?"]
    );
    expect(checks(found)).toEqual(["gate.question_repeated"]);
    expect(questionOverlapFindings(["Is EMDR the same as hypnosis?"], ["What is bilateral stimulation?"])).toEqual([]);
  });
  it("les mots de sa grille ne font pas une répétition (troisième passage réel)", () => {
    expect(
      questionOverlapFindings(["Why might new parents consider EMDR therapy?"], ["Who may consider EMDR therapy?"], ["EMDR therapy"])
    ).toEqual([]);
    expect(
      checks(questionOverlapFindings(
        ["Do I have to talk through every detail of a difficult experience?"],
        ["Do I have to share every detail of a difficult experience?"],
        ["EMDR therapy"]
      ))
    ).toEqual(["gate.question_repeated"]);
  });
  it("un fragment n'est pas un paragraphe (« paragraphs »)", () => {
    const p = piece();
    const body = p.bodyMd.replace("\n\n## ", "\n\nparagraphs\n\n## ");
    expect(checks(structureFindings({ ...p, bodyMd: body }))).toContain("structure.fragment");
  });
  it("une requête recopiée en minuscules devient un titre", () => {
    expect(sentenceCase("what to expect in a first EMDR therapy session")).toBe("What to expect in a first EMDR therapy session");
  });
});

describe("une étape décrite n'est pas une promesse (session 2, profil D)", () => {
  it("« you will be invited to notice » décrit la séance : pas de constat", () => {
    // La phrase réelle, qui a mis la page locale de D en quarantaine deux fois.
    const real =
      "When bilateral stimulation is used, you will be invited to notice what arises while keeping one part of your attention in the present.";
    expect(clinicalFindings(real)).toEqual([]);
    expect(clinicalFindings("You will be asked about your history.")).toEqual([]);
  });
  it("une promesse reste une promesse, et le constat cite la phrase", () => {
    const found = clinicalFindings("After a few sessions you will feel lighter and calmer.");
    expect(checks(found)).toEqual(["clinical.claim"]);
    expect(found[0].detail).toContain("you will feel");
    expect(checks(clinicalFindings("You'll be free of it."))).toEqual(["clinical.claim"]);
    expect(checks(clinicalFindings("You will be able to stop worrying."))).toEqual(["clinical.claim"]);
  });
});

describe("deux questions sur deux approches différentes ne se répètent pas (session 2, profil D)", () => {
  const VOCAB = ["EMDR therapy", "IFS therapy", "somatic experiencing therapy", "Gottman Method couples therapy", "CBT therapy"];
  it.each([
    // Les trois faux positifs réels du premier tour : chacun a coûté une réécriture.
    ["What happens during a somatic experiencing session?", "What happens in an EMDR therapy session?"],
    ["Somatic experiencing and EMDR at Natarajan Therapy", "What is EMDR therapy?"],
    ["What will the therapist ask about in the first session?", "What should you ask an EMDR therapist?"],
  ])("« %s » ≠ « %s »", (mine, other) => {
    expect(questionOverlapFindings([mine], [other], VOCAB)).toEqual([]);
  });
  it("la même question sur la même approche reste une répétition", () => {
    expect(checks(questionOverlapFindings(["How does EMDR therapy work?"], ["How does EMDR work?"], VOCAB))).toEqual(["gate.question_repeated"]);
    expect(
      checks(questionOverlapFindings(
        ["Do I have to talk through every detail of a difficult experience?"],
        ["Do I have to share every detail of a difficult experience?"],
        VOCAB
      ))
    ).toEqual(["gate.question_repeated"]);
    expect(questionOverlapFindings(["Why might new parents consider EMDR therapy?"], ["Who may consider EMDR therapy?"], VOCAB)).toEqual([]);
  });
});

describe("une question courte qui partage un sujet n'est pas la même question (session 2, mois 3 de Lena)", () => {
  const VOCAB = ["EMDR therapy", "IFS therapy"];
  it("« Can I stop bilateral stimulation… » ≠ « What is bilateral stimulation? » (faux positif réel)", () => {
    expect(questionOverlapFindings(["Can I stop bilateral stimulation if I do not like it?"], ["What is bilateral stimulation?"], VOCAB)).toEqual([]);
  });
  it.each([
    // Les vraies répétitions du même mois, qui doivent rester prises.
    ["Who may consider EMDR therapy?", "Who may consider EMDR therapy?"],
    ["What should I ask an EMDR therapist?", "What should I ask an EMDR therapist?"],
    ["What happens in an EMDR therapy session?", "What happens in an EMDR session?"],
    ["Do I have to talk through a difficult memory in detail?", "Do I have to talk through every detail of a difficult experience?"],
  ])("« %s » répète « %s »", (mine, other) => {
    expect(checks(questionOverlapFindings([mine], [other], VOCAB))).toEqual(["gate.question_repeated"]);
  });
});
