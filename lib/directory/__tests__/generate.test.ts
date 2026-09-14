import { describe, expect, it, vi } from "vitest";
import {
  DirectoryProseInvalidError,
  DirectoryProseRefusedError,
  MAX_MODEL_CALLS,
  directorySystemPrompt,
  generateDirectoryProfile,
  type DirectoryCall,
} from "@/lib/directory/generate";
import { BODY_MAX, FIRST_PARAGRAPH_MAX } from "@/lib/directory/profile";
import { FIXTURE_CATALOG } from "@/lib/brief/fixtures/catalog";
import type { BriefBundle } from "@/lib/data/brief";
import type { StructuredInput } from "@/lib/directory/profile";

/*
 * ── TOUT CE QUI EST DÉTERMINISTE DANS L'ÉTAPE DE GÉNÉRATION ─────────────
 *
 * L'appel modèle est injecté : ce fichier ne dépense rien et ne dépend
 * d'aucune clé. Ce qu'il vérifie est ce qui reste vrai quoi que le modèle
 * réponde — le plafond, le gabarit, la reprise déontologique, et la discipline
 * des champs optionnels.
 *
 * Ce qu'il NE peut pas vérifier : que la prose soit bonne. C'est ce que la
 * praticienne juge, et c'est pour ça que l'écran existe.
 */

const BUNDLE = {
  project: { id: "p1" },
  brief: {
    practice_name: "Elm & Ember Counseling",
    license_type_id: FIXTURE_CATALOG.licenseTypes[0].id,
    specialty_ids: [FIXTURE_CATALOG.specialties[0].id],
    modality_ids: [],
    client_persona_ids: [],
    session_style_ids: [],
    not_a_fit_ids: [],
    problem_card_ids: [],
    gain_card_ids: [],
    site_goal_ids: [],
    palette_family_ids: [],
  },
  data: {},
} as unknown as BriefBundle;

const FULL_STRUCTURED: StructuredInput = {
  state: "OR",
  specialties: ["Anxiety"],
  modalities: ["EMDR"],
  personas: ["Couples"],
  insurances: [],
};

/** ⚠ Le cas que L9 appelle normal : elle n'a répondu à aucun optionnel. */
const EMPTY_STRUCTURED: StructuredInput = {
  state: null,
  specialties: [],
  modalities: [],
  personas: [],
  insurances: [],
};

const GOOD = {
  firstParagraph: "You keep having the same argument, and neither of you can say why.",
  body: "We start by slowing that argument down until you can both hear it.",
};

const callOnce = (value = GOOD): DirectoryCall => vi.fn(async () => value);

describe("le gabarit du lot 1 est respecté", () => {
  it("le premier paragraphe et le reste sont produits SÉPARÉMENT", async () => {
    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      FULL_STRUCTURED,
      callOnce()
    );
    expect(result.draft.prose.firstParagraph).toBe(GOOD.firstParagraph);
    expect(result.draft.prose.body).toBe(GOOD.body);
    // ⚠ Et le reste NE CONTIENT PAS le premier paragraphe.
    expect(result.draft.prose.body).not.toContain(GOOD.firstParagraph);
  });

  it("une prose qui répète le premier paragraphe est refusée, pas rognée", async () => {
    const call: DirectoryCall = vi.fn(async () => ({
      firstParagraph: GOOD.firstParagraph,
      body: `${GOOD.firstParagraph} And then more.`,
    }));
    await expect(
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call)
    ).rejects.toBeInstanceOf(DirectoryProseInvalidError);
  });

  it("⚠ une prose trop longue est refusée, jamais tronquée", async () => {
    /*
     * Une coupure silencieuse produit une phrase qui s'arrête au milieu, sur
     * un profil public, sans que personne l'ait décidée.
     */
    const call: DirectoryCall = vi.fn(async () => ({
      firstParagraph: "a".repeat(FIRST_PARAGRAPH_MAX + 1),
      body: "b".repeat(10),
    }));
    await expect(
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call)
    ).rejects.toMatchObject({ problems: ["first_paragraph_too_long"] });
  });

  it("les bornes viennent du module, pas d'un nombre réécrit ici", () => {
    expect(FIRST_PARAGRAPH_MAX).toBeGreaterThan(0);
    expect(BODY_MAX).toBeGreaterThan(FIRST_PARAGRAPH_MAX);
  });
});

describe("⚠ aucune composition par concaténation de champs optionnels", () => {
  it("tous les optionnels vides est un cas NORMAL", async () => {
    /*
     * La discipline de L9, appliquée ici : une praticienne qui n'a rien
     * répondu produit un profil valide dont `structured` vaut `{}` — pas une
     * panne, pas un libellé suivi de rien.
     */
    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      EMPTY_STRUCTURED,
      callOnce()
    );
    expect(result.draft.structured).toEqual({});
    expect(result.draft.prose.firstParagraph).toBe(GOOD.firstParagraph);
  });

  it("une clé n'apparaît que si elle a une valeur", async () => {
    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      { ...EMPTY_STRUCTURED, specialties: ["Anxiety"] },
      callOnce()
    );
    expect(result.draft.structured).toEqual({ issues: ["Anxiety"] });
    // ⚠ Pas de `licensed_state: []`, pas de `insurance: []`.
    expect(Object.keys(result.draft.structured)).toEqual(["issues"]);
  });

  it("un libellé introuvable au catalogue raccourcit la liste, sans trou", async () => {
    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      { ...EMPTY_STRUCTURED, specialties: ["Anxiety", undefined, null, "  "] },
      callOnce()
    );
    expect(result.draft.structured.issues).toEqual(["Anxiety"]);
  });
});

describe("l'Ethics Guard, et un seul chemin", () => {
  it("une violation bloquante déclenche UNE reprise, et la seconde passe", async () => {
    const call = vi
      .fn<DirectoryCall>()
      .mockResolvedValueOnce({
        firstParagraph: "A clinically proven method that resolves trauma for good.",
        body: GOOD.body,
      })
      .mockResolvedValueOnce(GOOD);

    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      FULL_STRUCTURED,
      call
    );
    expect(result.modelCalls).toBe(2);
    expect(call).toHaveBeenCalledTimes(2);

    // ⚠ La reprise NOMME la violation — un modèle à qui on dit « recommence »
    // recommence à l'identique.
    expect(String(call.mock.calls[1][1])).toMatch(/broke advertising ethics/i);
  });

  it("⚠ la re-lecture n'est ni optionnelle ni conditionnelle", async () => {
    /*
     * La discipline de `lib/check/rewrite.ts`. Si la seconde tentative viole
     * encore, on refuse — on ne range pas une prose que la base rejetterait
     * de toute façon par son trigger.
     */
    const call: DirectoryCall = vi.fn(async () => ({
      firstParagraph: "Heal your anxiety in 12 weeks.",
      body: GOOD.body,
    }));
    await expect(
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call)
    ).rejects.toBeInstanceOf(DirectoryProseRefusedError);
    expect(call).toHaveBeenCalledTimes(MAX_MODEL_CALLS);
  });

  it("les DEUX champs sont scannés, pas leur concaténation", async () => {
    /*
     * Le trigger en base scanne `first_paragraph` et `body` séparément. Scanner
     * une chaîne jointe laisserait passer une violation à cheval sur la
     * jointure — et en créerait une qui n'existe dans aucun des deux.
     */
    const call: DirectoryCall = vi.fn(async () => ({
      firstParagraph: GOOD.firstParagraph,
      body: "Limited spots available.",
    }));
    await expect(
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call)
    ).rejects.toBeInstanceOf(DirectoryProseRefusedError);
  });

  it("le cadrage système porte le socle déontologique EN PREMIER", () => {
    const system = directorySystemPrompt(FIXTURE_CATALOG.ethicsRules);
    const rulesAt = system.indexOf("Psychology Today profile");
    expect(rulesAt).toBeGreaterThan(0);
    // ⚠ Aucune consigne de style ne doit précéder les règles.
    expect(system.slice(0, rulesAt)).toMatch(/never|not|avoid/i);
  });
});

describe("le plafond de dépense", () => {
  it("deux appels au plus, et le second n'existe que pour la reprise", async () => {
    expect(MAX_MODEL_CALLS).toBe(2);
  });

  it("⚠ il est vérifié AVANT l'appel, donc rien n'est dépensé au-delà", async () => {
    const call: DirectoryCall = vi.fn(async () => ({
      firstParagraph: "Heal your anxiety in 12 weeks.",
      body: GOOD.body,
    }));
    await expect(
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call)
    ).rejects.toBeTruthy();
    /* Jamais MAX + 1 : un plafond lu après coup est un reçu, pas un plafond. */
    expect(call).toHaveBeenCalledTimes(MAX_MODEL_CALLS);
  });

  it("un succès du premier coup ne fait qu'UN appel", async () => {
    const call = callOnce();
    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      FULL_STRUCTURED,
      call
    );
    expect(result.modelCalls).toBe(1);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
