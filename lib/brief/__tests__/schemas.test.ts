import { describe, expect, it } from "vitest";
import {
  briefDraftSchema,
  parseStoredBriefDraft,
  PREUVES_DISPONIBLES,
  step1Schema,
  step4Schema,
  step5Schema,
  stepSchemas,
  STEP_NUMBERS,
} from "@/lib/brief/schemas";
import { STEPS, TONE_SLIDERS } from "@/lib/brief/steps";

/*
 * Contrat de validation du brief US. Ces tests décrivent les règles que la
 * re-spécialisation thérapeutes impose : licence obligatoire, branche « other »
 * conditionnelle, exactement 3 ressentis, 1 à 3 familles de couleurs, et
 * l'absence — déontologique — des témoignages clients.
 */

const validStep1 = {
  nom_activite: "Hearth Counseling",
  metier: "lmft",
  specialties: ["couples", "trauma_emdr"],
  offre_principale: "Couples therapy and weekend intensives.",
  stade: "premiumizing",
};

describe("étape 1 — licence et spécialités", () => {
  it("accepte un type de licence de la liste", () => {
    expect(step1Schema.safeParse(validStep1).success).toBe(true);
  });

  it("refuse un brief sans type de licence", () => {
    const withoutLicense: Record<string, unknown> = { ...validStep1 };
    delete withoutLicense.metier;
    const result = step1Schema.safeParse(withoutLicense);
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.path[0] === "metier")
    ).toBe(true);
  });

  it("exige la précision libre quand la licence est « other »", () => {
    const result = step1Schema.safeParse({ ...validStep1, metier: "autre" });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.path[0] === "metier_autre")
    ).toBe(true);
  });

  it("accepte « other » dès que la précision est fournie", () => {
    const result = step1Schema.safeParse({
      ...validStep1,
      metier: "autre",
      metier_autre: "Licensed art therapist",
    });
    expect(result.success).toBe(true);
  });

  it("laisse les spécialités facultatives", () => {
    const withoutSpecialties: Record<string, unknown> = { ...validStep1 };
    delete withoutSpecialties.specialties;
    const result = step1Schema.safeParse(withoutSpecialties);
    expect(result.success).toBe(true);
    expect(result.data?.specialties).toEqual([]);
  });

  it("refuse une spécialité hors liste", () => {
    const result = step1Schema.safeParse({
      ...validStep1,
      specialties: ["astrology"],
    });
    expect(result.success).toBe(false);
  });
});

describe("étape 4 — ressentis", () => {
  const base = {
    ton_sobre_audacieux: 2,
    ton_chaleureux_professionnel: 2,
    ton_classique_contemporain: 3,
    ton_minimal_expressif: 3,
  };

  it("exige exactement 3 ressentis", () => {
    expect(
      step4Schema.safeParse({ ...base, emotions: ["calm", "trust", "safety"] })
        .success
    ).toBe(true);
    expect(
      step4Schema.safeParse({ ...base, emotions: ["calm", "trust"] }).success
    ).toBe(false);
    expect(
      step4Schema.safeParse({
        ...base,
        emotions: ["calm", "trust", "safety", "hope"],
      }).success
    ).toBe(false);
  });

  it("donne 3 par défaut à chaque curseur non renseigné", () => {
    const result = step4Schema.safeParse({
      emotions: ["calm", "trust", "safety"],
    });
    expect(result.success).toBe(true);
    expect(result.data?.ton_sobre_audacieux).toBe(3);
    expect(result.data?.ton_chaleureux_professionnel).toBe(3);
    expect(result.data?.ton_classique_contemporain).toBe(3);
    expect(result.data?.ton_minimal_expressif).toBe(3);
    // Les 4 curseurs déclarés sont bien ceux que l'étape 4 valide.
    expect(TONE_SLIDERS.map((s) => s.name).sort()).toEqual(
      [
        "ton_chaleureux_professionnel",
        "ton_classique_contemporain",
        "ton_minimal_expressif",
        "ton_sobre_audacieux",
      ]
    );
  });
});

describe("étape 5 — familles de couleurs", () => {
  it("en accepte 1 à 3, pas 0 ni 4", () => {
    const parse = (familles_chromatiques: string[]) =>
      step5Schema.safeParse({ familles_chromatiques }).success;
    expect(parse(["deep_blues"])).toBe(true);
    expect(parse(["deep_blues", "warm_neutrals", "monochrome"])).toBe(true);
    expect(parse([])).toBe(false);
    expect(
      parse(["deep_blues", "warm_neutrals", "monochrome", "soft_pastels"])
    ).toBe(false);
  });
});

describe("étape 7 — preuves disponibles", () => {
  it("n'offre aucune option de témoignage client", () => {
    // ACA C.3.a / APA 5.05 : la sollicitation de témoignages est interdite.
    for (const value of PREUVES_DISPONIBLES) {
      expect(value).not.toMatch(/testimonial|review|rating/i);
    }
  });
});

describe("configuration et schémas", () => {
  it("couvre les 7 étapes", () => {
    expect(STEPS.map((s) => s.step)).toEqual([...STEP_NUMBERS]);
    expect(Object.keys(stepSchemas)).toHaveLength(7);
  });

  it("ne déclare aucun champ absent du schéma global", () => {
    const known = new Set(Object.keys(briefDraftSchema.shape));
    for (const step of STEPS) {
      for (const field of step.fields) {
        if (field.kind === "sliders") {
          for (const slider of field.sliders) {
            expect(known).toContain(slider.name);
          }
        } else {
          expect(known).toContain(field.name);
        }
      }
    }
  });

  it("n'expose que des valeurs d'options acceptées par le schéma d'étape", () => {
    type Parser = { safeParse: (v: unknown) => { success: boolean } };
    type Wrapped = Parser & {
      element?: Parser;
      def?: { innerType?: Wrapped };
    };

    /* Retire les enveloppes .default() / .optional() pour atteindre le tableau. */
    function unwrap(schema: Wrapped): Wrapped {
      let current = schema;
      while (current.def?.innerType) current = current.def.innerType;
      return current;
    }

    for (const step of STEPS) {
      const schema = stepSchemas[step.step as (typeof STEP_NUMBERS)[number]];
      for (const field of step.fields) {
        if (field.kind !== "choice" && field.kind !== "multi") continue;
        const declared = schema.shape[
          field.name as keyof typeof schema.shape
        ] as Wrapped | undefined;
        if (!declared) continue;

        // Pour un multi-choix, on valide l'élément et non le tableau : les
        // contraintes de cardinalité (exactement 3, 1 à 3) sont testées à part.
        const unwrapped = unwrap(declared);
        const valueSchema = unwrapped.element ?? unwrapped;
        for (const option of field.options) {
          expect(
            valueSchema.safeParse(option.value).success,
            `${field.name} = ${option.value}`
          ).toBe(true);
        }
      }
    }
  });
});

describe("lecture tolérante du brief stocké", () => {
  it("conserve les champs valides et écarte les valeurs périmées", () => {
    const draft = parseStoredBriefDraft({
      nom_activite: "Hearth Counseling",
      metier: "therapeute", // valeur de l'ancien brief français
      familles_chromatiques: ["deep_blues"],
      emotions: ["calm", "trust", "safety"],
      inconnu: "ignoré",
    });

    expect(draft.nom_activite).toBe("Hearth Counseling");
    expect(draft.metier).toBeUndefined();
    expect(draft.familles_chromatiques).toEqual(["deep_blues"]);
    expect(draft.emotions).toEqual(["calm", "trust", "safety"]);
    expect("inconnu" in draft).toBe(false);
  });

  it("renvoie un brouillon vide pour tout ce qui n'est pas un objet", () => {
    expect(parseStoredBriefDraft(null)).toEqual({});
    expect(parseStoredBriefDraft("brief")).toEqual({});
    expect(parseStoredBriefDraft([1, 2])).toEqual({});
  });
});

describe("parcours complet des 7 étapes", () => {
  /* Un brief entièrement rempli, tel qu'une praticienne le saisirait. */
  const fullBrief = {
    // 1 — Your practice
    nom_activite: "Hearth Counseling",
    metier: "lmft",
    specialties: ["couples", "trauma_emdr"],
    offre_principale: "Couples therapy and weekend intensives.",
    stade: "premiumizing",
    // 2 — Positioning
    probleme_resolu: "Partners who keep having the same fight.",
    resultat_client: "A clearer view of what the fight is really about.",
    alternatives: "Directories, or waiting another year.",
    differenciation: "Fifteen years with couples, EMDR-trained.",
    // 3 — Ideal client
    cible_description: "First-gen professionals carrying success guilt.",
    contexte_achat: "long_considered",
    objections: ["cost", "will_they_get_me"],
    // 4 — Voice & tone
    ton_sobre_audacieux: 2,
    ton_chaleureux_professionnel: 2,
    ton_classique_contemporain: 4,
    ton_minimal_expressif: 2,
    emotions: ["safety", "steadiness", "warmth"],
    a_eviter_ton: "hustle language, exclamation marks",
    // 5 — Palette
    familles_chromatiques: ["warm_neutrals", "muted_plum_slate"],
    niveau_contraste: "soft",
    couleurs_a_eviter: "sage",
    univers_admires: "Aesop stores, Kinfolk.",
    // 6 — Typography
    style_typographique: "editorial_serif",
    niveau_caractere: "understated",
    // 7 — Your website
    objectif_site: "book_consultations",
    action_attendue: "book a consultation",
    pages_souhaitees: ["home", "about", "approach", "fees", "contact"],
    preuves_disponibles: ["credentials", "training_certifications"],
    contraintes: "No stock photos of people.",
  };

  it("franchit chaque étape sans blocage", () => {
    for (const step of STEP_NUMBERS) {
      const result = stepSchemas[step].safeParse(fullBrief);
      expect(result.success, `étape ${step}: ${result.error?.message}`).toBe(
        true
      );
    }
  });

  it("survit à un aller-retour par la persistance jsonb", () => {
    const stored = JSON.parse(JSON.stringify(fullBrief));
    const draft = parseStoredBriefDraft(stored);
    expect(draft).toEqual(fullBrief);
  });

  it("bloque l'étape dont un champ obligatoire manque", () => {
    const incomplete: Record<string, unknown> = { ...fullBrief };
    delete incomplete.action_attendue;
    const result = stepSchemas[7].safeParse(incomplete);
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.path[0] === "action_attendue")
    ).toBe(true);
  });
});
