import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyScope,
  buildKitPrompt,
  generateKitWithModel,
  KIT_SYSTEM_PROMPT,
  KitScopeError,
  type KitGeneration,
  type KitInput,
  type KitModelCall,
} from "@/lib/ai/kit";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { resolveKitScope } from "@/lib/kit/tiers";
import { publishableKitText, type PageCopy } from "@/lib/kit/content";
import type { BriefDraft } from "@/lib/brief/schemas";

/*
 * Contrat de la génération du kit (Lot 3) : la couche déontologique du Lot 0
 * enveloppe l'appel modèle, comme pour les directions, mais sur une surface
 * bien plus large — chaque titre et chaque corps de chaque page.
 *
 * Ce qui est vérifié ici est le comportement observable — régénération sur
 * violation, échec propre, périmètre respecté — sans jamais appeler l'API
 * Anthropic : `callModel` est injecté.
 *
 * Le chemin About/Approach a ses propres cas : ce sont les deux pages où une
 * promesse de résultat se glisse le plus facilement, et le prompt système les
 * nomme explicitement pour cette raison.
 */

const draft: BriefDraft = {
  practice_name: "Hearth Counseling",
  license_type: "lmft",
  offer: "Couples therapy and weekend intensives.",
  problem_addressed: "Partners who keep having the same argument.",
  emotions: ["safety", "steadiness", "warmth"],
  color_families: ["warm_neutrals"],
  type_style: "editorial_serif",
  site_goal: "book_consultations",
  primary_action: "Book a consultation",
  pages_wanted: ["home", "about", "approach", "contact"],
  available_proof: ["credentials", "training_certifications"],
};

const scope = resolveKitScope("signature", draft.pages_wanted);

const input: KitInput = {
  projectName: "Hearth Counseling",
  draft,
  direction: {
    name: "Quiet Hearth",
    description: "A composed, unhurried presence that gives room to think.",
    palette: {
      primary: "#2C4A6E",
      secondary: "#D9CBB8",
      accent: "#C57B45",
      neutral_light: "#F4F1EC",
      neutral_dark: "#16233A",
    },
    heading_font: "Fraunces",
    body_font: "Inter",
  },
  scope,
};

function page(name: PageCopy["page"], body: string): PageCopy {
  return {
    page: name,
    sections: [{ heading: "What this is", body }],
  };
}

const COMPLIANT: KitGeneration = {
  positioning_statement:
    "Hearth Counseling is a couples practice for partners who keep having the same argument in different words. The work is structured, unhurried, and grounded in Emotionally Focused Therapy.",
  brand_story:
    "I started this practice because the couples I sat with kept arriving exhausted by a conversation they had already had a hundred times.\n\nSessions here are ninety minutes, which is long enough to slow a conversation down and look at what is happening underneath it.",
  voice_and_tone: {
    adjectives: ["warm", "direct", "unhurried"],
    do_examples: [
      "A first session is ninety minutes, and most of it is listening.",
      "We look at the pattern the argument keeps returning to.",
      "You can bring the version of this you have never said out loud.",
    ],
    /*
     * Contre-exemples : ils NOMMENT la faute. Le troisième cite délibérément
     * une formule interdite — c'est ce qui rend visible, plus bas, le fait
     * qu'ils sont exclus du contrôle déontologique.
     */
    dont_examples: [
      "Naming a timeframe for how someone will feel.",
      "Borrowing authority from a training that was never completed.",
      "Writing that the work will heal your anxiety.",
    ],
  },
  website_copy: [
    page(
      "home",
      "A couples practice for partners who keep circling the same conversation."
    ),
    page(
      "about",
      "I am a licensed marriage and family therapist. I work with couples who arrive tired of the same argument."
    ),
    page(
      "approach",
      "The work draws on Emotionally Focused Therapy. Sessions look at the pattern a conversation keeps returning to."
    ),
    page(
      "contact",
      "Sessions are held on Tuesdays and Thursdays. Book a consultation to start."
    ),
  ],
  social_templates: [
    {
      name: "Quiet note",
      purpose: "A single idea from the work, for a weekday post.",
      layout:
        "Square, 1080x1080. Neutral light background #F4F1EC, one line of Fraunces at 64pt in #16233A, practice name in Inter 24pt bottom left.",
      example_caption:
        "The argument is rarely about the dishes. It is usually about whether you were heard the last time.",
    },
  ],
  website_prompt:
    "Build a four-page site for a couples therapy practice. Use #2C4A6E for links, #F4F1EC for backgrounds, Fraunces for headings and Inter for body. In Squarespace, start from a one-column layout; in Webflow, build the sections as a grid.",
};

/** Remplace le corps de la première section d'une page donnée. */
function withPageBody(
  base: KitGeneration,
  target: string,
  body: string
): KitGeneration {
  return {
    ...base,
    website_copy: base.website_copy.map((entry) =>
      entry.page === target
        ? { ...entry, sections: [{ ...entry.sections[0], body }] }
        : entry
    ),
  };
}

/* Promesse de résultat sur la page About — le cas le plus fréquent. */
const VIOLATING_ABOUT = withPageBody(
  COMPLIANT,
  "about",
  "I became a therapist to help people end your anxiety for good, and that is what this practice does."
);

/* Efficacité affirmée sur la page Approach — l'autre point de fuite. */
const VIOLATING_APPROACH = withPageBody(
  COMPLIANT,
  "approach",
  "This is a clinically proven method that resolves trauma in a handful of sessions."
);

/* Violation dans un TITRE de section, pas dans un corps. */
const VIOLATING_HEADING: KitGeneration = {
  ...COMPLIANT,
  website_copy: COMPLIANT.website_copy.map((entry) =>
    entry.page === "about"
      ? {
          ...entry,
          sections: [
            {
              heading: "Guaranteed results, session one",
              body: entry.sections[0].body,
            },
          ],
        }
      : entry
  ),
};

beforeEach(() => {
  // La couche ethics journalise chaque violation : on la tait pendant les tests.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prompt système", () => {
  it("injecte le socle déontologique (garde-fou de niveau 1)", () => {
    expect(KIT_SYSTEM_PROMPT).toContain(ETHICS_SYSTEM_RULES);
  });

  it("nomme explicitement les pages About et Approach comme points de fuite", () => {
    expect(KIT_SYSTEM_PROMPT).toContain("ABOUT page");
    expect(KIT_SYSTEM_PROMPT).toContain("APPROACH page");
  });
});

describe("prompt de génération", () => {
  it("liste les pages du périmètre et la direction choisie", () => {
    const prompt = buildKitPrompt(input);

    for (const key of scope.pages) {
      expect(prompt).toContain(`- ${key} (`);
    }
    expect(prompt).toContain("Quiet Hearth");
    expect(prompt).toContain("#2C4A6E");
    expect(prompt).toContain("Fraunces");
    expect(prompt).toContain("Book a consultation");
  });

  it("demande les specs sociales quand le tier les inclut, et les refuse sinon", () => {
    expect(buildKitPrompt(input)).toContain("3 to 4 branded social templates");

    const starter = buildKitPrompt({
      ...input,
      scope: resolveKitScope("starter", draft.pages_wanted),
    });
    expect(starter).toContain("No social templates in this deliverable");
  });
});

describe("génération gardée — chemin About / Approach", () => {
  it("régénère quand la page About promet un résultat, puis renvoie la version conforme", async () => {
    const calls: (string | null)[] = [];
    const callModel: KitModelCall = async (_prompt, feedback) => {
      calls.push(feedback);
      return calls.length === 1 ? VIOLATING_ABOUT : COMPLIANT;
    };

    const result = await generateKitWithModel(input, callModel);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toBeNull();
    // La reprise cite l'extrait fautif : c'est ce qui la fait atterrir.
    expect(calls[1]).toContain("end your anxiety");
    expect(result).toEqual(COMPLIANT);
  });

  it("régénère quand la page Approach affirme une efficacité prouvée", async () => {
    const calls: (string | null)[] = [];
    const callModel: KitModelCall = async (_prompt, feedback) => {
      calls.push(feedback);
      return calls.length === 1 ? VIOLATING_APPROACH : COMPLIANT;
    };

    const result = await generateKitWithModel(input, callModel);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("clinically proven");
    expect(result).toEqual(COMPLIANT);
  });

  it("surveille les titres de section, pas seulement les corps de texte", async () => {
    const calls: (string | null)[] = [];
    const callModel: KitModelCall = async (_prompt, feedback) => {
      calls.push(feedback);
      return calls.length === 1 ? VIOLATING_HEADING : COMPLIANT;
    };

    await generateKitWithModel(input, callModel);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("Guaranteed");
  });
});

describe("génération gardée — autres surfaces publiables", () => {
  it("surveille le prompt multi-plateformes, publiable par ricochet", async () => {
    const calls: (string | null)[] = [];
    const callModel: KitModelCall = async (_prompt, feedback) => {
      calls.push(feedback);
      return calls.length === 1
        ? {
            ...COMPLIANT,
            website_prompt: `${COMPLIANT.website_prompt} Add a banner reading "guaranteed relief in 6 weeks".`,
          }
        : COMPLIANT;
    };

    await generateKitWithModel(input, callModel);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("guaranteed");
  });

  it("surveille les légendes des gabarits sociaux", async () => {
    const calls: (string | null)[] = [];
    const callModel: KitModelCall = async (_prompt, feedback) => {
      calls.push(feedback);
      return calls.length === 1
        ? {
            ...COMPLIANT,
            social_templates: [
              {
                ...COMPLIANT.social_templates[0],
                example_caption:
                  "My clients say they sleep better after a month.",
              },
            ],
          }
        : COMPLIANT;
    };

    await generateKitWithModel(input, callModel);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("clients say");
  });

  /*
   * Contrat explicite, pas un oubli : les contre-exemples du guide de voix
   * illustrent la faute et ne sont jamais de la copy à publier. Les soumettre
   * au contrôle demanderait au modèle de nommer une faute sans jamais
   * l'écrire — la génération échouerait sur sa propre pédagogie.
   */
  it("ne vérifie PAS les contre-exemples du guide de voix", async () => {
    const calls: (string | null)[] = [];
    const callModel: KitModelCall = async (_prompt, feedback) => {
      calls.push(feedback);
      return COMPLIANT;
    };

    const result = await generateKitWithModel(input, callModel);

    // COMPLIANT porte « heal your anxiety » dans ses dont_examples : une seule
    // tentative, aucune régénération.
    expect(calls).toHaveLength(1);
    expect(result.voice_and_tone.dont_examples[2]).toContain(
      "heal your anxiety"
    );
    expect(
      publishableKitText(COMPLIANT, COMPLIANT.website_prompt)
    ).not.toContain(COMPLIANT.voice_and_tone.dont_examples[2]);
  });

  it("aplatit chaque page dans le texte publiable, sans échantillonner", () => {
    const texts = publishableKitText(COMPLIANT, COMPLIANT.website_prompt);

    for (const entry of COMPLIANT.website_copy) {
      expect(texts).toContain(entry.sections[0].heading);
      expect(texts).toContain(entry.sections[0].body);
    }
    expect(texts).toContain(COMPLIANT.positioning_statement);
    expect(texts).toContain(COMPLIANT.brand_story);
    expect(texts).toContain(COMPLIANT.website_prompt);
  });
});

describe("génération gardée — échec propre", () => {
  it("lève EthicsComplianceError sans renvoyer de contenu non conforme", async () => {
    let attempts = 0;
    const callModel: KitModelCall = async () => {
      attempts += 1;
      return VIOLATING_ABOUT;
    };

    await expect(generateKitWithModel(input, callModel)).rejects.toBeInstanceOf(
      EthicsComplianceError
    );

    // Première tentative + 2 reprises : au-delà, on abandonne.
    expect(attempts).toBe(3);
  });
});

describe("périmètre du livrable", () => {
  it("lève KitScopeError quand une page demandée manque, sans reprise", async () => {
    let attempts = 0;
    const callModel: KitModelCall = async () => {
      attempts += 1;
      return {
        ...COMPLIANT,
        website_copy: COMPLIANT.website_copy.filter(
          (entry) => entry.page !== "approach"
        ),
      };
    };

    await expect(generateKitWithModel(input, callModel)).rejects.toBeInstanceOf(
      KitScopeError
    );
    // Un manque de page est structurel : on n'use pas les reprises de la
    // couche déontologique dessus.
    expect(attempts).toBe(1);
  });

  it("écarte une page rendue sans avoir été demandée", () => {
    const withExtra: KitGeneration = {
      ...COMPLIANT,
      website_copy: [
        ...COMPLIANT.website_copy,
        page("fees", "Sessions are billed per visit."),
      ],
    };

    const scoped = applyScope(withExtra, scope);

    expect(scoped.website_copy.map((entry) => entry.page)).toEqual(scope.pages);
  });

  it("remet les pages dans l'ordre du périmètre", () => {
    const shuffled: KitGeneration = {
      ...COMPLIANT,
      website_copy: [...COMPLIANT.website_copy].reverse(),
    };

    expect(applyScope(shuffled, scope).website_copy.map((e) => e.page)).toEqual(
      scope.pages
    );
  });
});
