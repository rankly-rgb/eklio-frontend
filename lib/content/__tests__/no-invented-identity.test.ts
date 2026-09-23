import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { practitionerLines, identityAllowList, type PractitionerFacts } from "@/lib/content/practitioner";
import { checkInventedIdentity } from "@/lib/content/month-checks";
import { budgetErrors } from "@/lib/compose/budget";
import {
  MODEL_WRITTEN_ARCHETYPES, CAROUSEL_INNER_ARCHETYPES, archetypeInstruction,
} from "@/lib/content/generate/copy-batch";

/*
 * ── « ROWAN MERCIER THERAPY » NE PEUT PLUS ÊTRE ÉCRIT ───────────────────
 *
 * Le 2026-09-21, une carte praticienne du mois d'ISLA THORNBURY portait
 * « Rowan Mercier Therapy » et « rowan@rowanmercier.com ». Le nom et
 * l'adresse n'existaient dans aucun compte : le modèle les a fabriqués.
 *
 * Un contrôle bloquant a été posé le jour même. Il attrapait la carte APRÈS
 * l'avoir payée, et il ne reconnaissait que des FORMES — une arobase, un
 * suffixe « Therapy ». Ce fichier vérifie que la CAUSE a disparu : que rien
 * dans le chemin de génération ne permet plus au modèle d'écrire une identité.
 */

const FACTS: PractitionerFacts = {
  practiceName: "Isla Thornbury Therapy",
  city: "Oakland",
  state: "CA",
  modalities: ["EMDR"],
  takingClients: "yes",
};

describe("le modèle ne peut plus écrire d'identité", () => {
  it("la carte praticienne n'est plus dans son schéma de sortie", () => {
    expect(MODEL_WRITTEN_ARCHETYPES).not.toContain("practitioner_card");
    expect(() => archetypeInstruction("practitioner_card")).toThrow();
  });

  /*
   * ⚠ C'EST PAR LÀ QUE C'EST PASSÉ. L'identité inventée était le cinquième
   * VOLET d'un carrousel, pas une carte praticienne de premier niveau.
   */
  it("et aucun carrousel ne peut en empiler une", () => {
    expect(CAROUSEL_INNER_ARCHETYPES).not.toContain("practitioner_card");
    expect(archetypeInstruction("carousel")).not.toContain("practitioner_card");

    const smuggled = {
      cards: [
        { archetype_key: "single_statement", payload: { statement: "Rest is not a reward you earn." } },
        { archetype_key: "practitioner_card", payload: { lines: ["Rowan Mercier Therapy"] } },
        { archetype_key: "single_statement", payload: { statement: "The body keeps its own time." } },
      ],
    };
    const errors = budgetErrors("carousel", smuggled);
    expect(errors.some((e) => e.path === "cards[1].archetype_key")).toBe(true);
  });
});

/*
 * ── ⚠ L'INTERDICTION TIENT À L'INTÉRIEUR D'UN CARROUSEL ────────────────
 *
 * C'est le chemin RÉEL du défaut, et il n'était couvert que par ricochet :
 * « Rowan Mercier Therapy » et « rowan@rowanmercier.com » étaient le cinquième
 * VOLET d'un carrousel du mois d'Isla Thornbury. Une carte praticienne de
 * premier niveau n'a jamais rien inventé.
 *
 * Un payload de carrousel est imbriqué — `cards[i].payload.lines[j]` — et un
 * contrôle qui ne descendrait pas d'un niveau verrait un carrousel propre. Les
 * cas ci-dessous posent la question à l'endroit exact où elle s'est posée.
 */
describe("l'identité est interdite JUSQUE DANS un carrousel", () => {
  const allowed = identityAllowList(FACTS);

  it("un nom de cabinet inventé dans un volet est vu", () => {
    const carousel = {
      cards: [
        { archetype_key: "single_statement", payload: { statement: "Rest is not a reward you earn." } },
        { archetype_key: "practitioner_card", payload: { lines: ["Rowan Mercier Therapy", "Oakland, CA"] } },
      ],
    };
    const findings = checkInventedIdentity(carousel, FACTS.practiceName!, allowed);
    expect(findings.some((f) => f.check === "identity.practice")).toBe(true);
    // ⚠ Le chemin nomme le volet, sinon on cherche le défaut sur la mauvaise carte.
    expect(findings.find((f) => f.check === "identity.practice")!.detail).toContain("cards[1]");
  });

  it("une adresse dans un volet est vue, à n'importe quelle profondeur", () => {
    const carousel = {
      cards: [
        { archetype_key: "single_statement", payload: { statement: "The body keeps its own time." } },
        {
          archetype_key: "surface_and_beneath",
          payload: {
            surface: { label: "Looking fine", gloss: "write to hello@somewhere.com" },
            beneath: { label: "Running empty", gloss: "nothing left by Friday" },
          },
        },
      ],
    };
    const findings = checkInventedIdentity(carousel, FACTS.practiceName!, allowed);
    expect(findings.some((f) => f.check === "identity.contact")).toBe(true);
    expect(findings[0].detail).toContain("cards[1].payload.surface.gloss");
  });

  it("un identifiant social dans un volet est vu", () => {
    const carousel = {
      cards: [{ archetype_key: "single_statement", payload: { statement: "Find me @islathornbury there." } }],
    };
    expect(
      checkInventedIdentity(carousel, FACTS.practiceName!, allowed).some((f) => f.check === "identity.contact")
    ).toBe(true);
  });

  /*
   * ⚠ ET LE CARROUSEL RÉELLEMENT PUBLIÉ EST REFUSÉ, tel qu'il est en base.
   * C'est la seule version du cas qui ne repose pas sur une fixture écrite
   * après coup pour ressembler au défaut.
   */
  it("le carrousel qui a réellement publié l'identité est refusé", () => {
    const month = JSON.parse(
      readFileSync("lib/content/__tests__/fixtures/month-isla.json", "utf8")
    ) as Array<{ archetype: string; payload: unknown }>;
    const carousels = month.filter((p) => p.archetype === "carousel");
    expect(carousels.length).toBeGreaterThan(0);

    const findings = carousels.flatMap((p) =>
      checkInventedIdentity(p.payload, FACTS.practiceName!, allowed)
    );
    expect(findings.some((f) => f.detail.includes("Rowan Mercier Therapy"))).toBe(true);
    expect(findings.some((f) => f.detail.includes("rowan@rowanmercier.com"))).toBe(true);
    // Et le constat pointe bien un volet, pas la carte de premier niveau.
    expect(findings.every((f) => f.detail.includes("cards["))).toBe(true);
  });

  it("un carrousel propre ne dit rien", () => {
    const clean = {
      cards: [
        { archetype_key: "single_statement", payload: { statement: "Rest is not a reward you earn." } },
        { archetype_key: "single_statement", payload: { statement: "The body keeps its own time." } },
      ],
    };
    expect(checkInventedIdentity(clean, FACTS.practiceName!, allowed)).toEqual([]);
  });
});

describe("les lignes viennent du brief, ou la carte n'existe pas", () => {
  it("un brief complet donne des lignes recopiées, jamais rédigées", () => {
    expect(practitionerLines(FACTS)).toEqual(["EMDR", "Oakland, CA", "Taking new clients"]);
  });

  it("le nom du cabinet n'est pas une ligne — il est déjà dans le pied", () => {
    expect(practitionerLines(FACTS)).not.toContain("Isla Thornbury Therapy");
  });

  /*
   * ⚠ « null » EST LA BONNE RÉPONSE, PAS UN ÉCHEC. Le tirage retire alors
   * l'archétype de la ronde et le mélange se rééquilibre sur les dix autres.
   */
  it("un brief trop maigre ne donne pas de carte du tout", () => {
    expect(practitionerLines({ ...FACTS, city: null, state: null, takingClients: null })).toBeNull();
    expect(practitionerLines({ ...FACTS, modalities: [], city: null, state: null })).toBeNull();
  });

  it("« ne prend pas de clients » ne se publie pas", () => {
    const lines = practitionerLines({ ...FACTS, takingClients: "no" });
    expect(lines).toEqual(["EMDR", "Oakland, CA"]);
  });
});

describe("le filet, rejoué sur le mois d'Isla Thornbury", () => {
  const month = JSON.parse(
    readFileSync("lib/content/__tests__/fixtures/month-isla.json", "utf8")
  ) as Array<{ archetype: string; payload: unknown }>;

  const allowed = identityAllowList(FACTS);

  it("le carrousel qui portait l'identité inventée est refusé", () => {
    const findings = month.flatMap((p) =>
      checkInventedIdentity(p.payload, FACTS.practiceName!, allowed)
    );
    expect(findings.some((f) => f.detail.includes("Rowan Mercier Therapy"))).toBe(true);
    expect(findings.some((f) => f.detail.includes("rowan@rowanmercier.com"))).toBe(true);
  });

  /*
   * ⚠ ET LE FILET NE SE CONTENTE PLUS DE RECONNAÎTRE DES FORMES. Il confronte
   * ce qui est écrit à ce que le brief porte : un nom de cabinet plausible,
   * qu'aucune expression régulière ne distinguerait d'un vrai, est refusé
   * parce qu'il n'est pas dans la liste.
   */
  it("un nom plausible mais absent du brief est refusé", () => {
    const invented = { lines: ["Marrow & Vale Counselling", "Oakland, CA"] };
    const findings = checkInventedIdentity(invented, FACTS.practiceName!, allowed);
    expect(findings.some((f) => f.check === "identity.practice")).toBe(true);
  });

  it("ce que le brief porte passe", () => {
    const real = { lines: practitionerLines(FACTS)! };
    expect(checkInventedIdentity(real, FACTS.practiceName!, allowed)).toEqual([]);
  });

  it("le contrôle vaut pour tous les archétypes, pas seulement la carte praticienne", () => {
    const diagram = {
      surface: { label: "Looking fine", gloss: "at Marrow Wellness" },
      beneath: { label: "Running empty", gloss: "call (510) 555-0134" },
    };
    const findings = checkInventedIdentity(diagram, FACTS.practiceName!, allowed);
    expect(findings.map((f) => f.check)).toContain("identity.practice");
    expect(findings.map((f) => f.check)).toContain("identity.contact");
  });
});
