import { describe, expect, it, vi } from "vitest";
import {
  DirectoryProseClicheError,
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

/*
 * ⚠ LA SECONDE GARDE, MUETTE PAR DÉFAUT DANS LES SONDES QUI NE LA VISENT PAS.
 * `generateDirectoryProfile` appelle réellement `usp_banned_phrases_check` :
 * sans injection, ces tests ouvriraient un client service-role. Le sonder pour
 * de vrai est l'objet du bloc « les clichés d'annuaire », plus bas.
 */
const NO_CLICHE = async () => [];

/*
 * ⚠ La LISTE des clichés est injectée vide, pour la même raison : sans
 * injection, construire le prompt système ouvrirait un client service-role.
 * Ce que la liste change dans le prompt est sondé à part, plus bas.
 */
const NO_LIST = async () => [];

describe("le gabarit du lot 1 est respecté", () => {
  it("le premier paragraphe et le reste sont produits SÉPARÉMENT", async () => {
    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      FULL_STRUCTURED,
      callOnce(),
      NO_CLICHE,
      NO_LIST
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
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call, NO_CLICHE, NO_LIST)
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
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call, NO_CLICHE, NO_LIST)
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
      callOnce(),
      NO_CLICHE,
      NO_LIST
    );
    expect(result.draft.structured).toEqual({});
    expect(result.draft.prose.firstParagraph).toBe(GOOD.firstParagraph);
  });

  it("une clé n'apparaît que si elle a une valeur", async () => {
    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      { ...EMPTY_STRUCTURED, specialties: ["Anxiety"] },
      callOnce(),
      NO_CLICHE,
      NO_LIST
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
      callOnce(),
      NO_CLICHE,
      NO_LIST
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
      call,
      NO_CLICHE,
      NO_LIST
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
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call, NO_CLICHE, NO_LIST)
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
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call, NO_CLICHE, NO_LIST)
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
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call, NO_CLICHE, NO_LIST)
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
      call,
      NO_CLICHE,
      NO_LIST
    );
    expect(result.modelCalls).toBe(1);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ LES CLICHÉS D'ANNUAIRE — LA MOITIÉ DE LA GARDE QUI MANQUAIT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mesuré en production le 19 septembre : un brouillon contenant « you
 * deserve » passait les DEUX tentatives sans que rien ne le relève, puis
 * mourait au `save_directory_profile` avec un 23514 levé par
 * `directory_profiles_ethics_gate`. La boucle de reprise ne voyait que la
 * moitié de ce que la base applique — elle ne pouvait donc réparer que la
 * moitié.
 *
 * ⚠ CES SONDES N'ÉCRIVENT AUCUNE LISTE DE PHRASES. Les trente clichés vivent
 * dans `banned_phrases` et s'y ajoutent sans déploiement ; une liste recopiée
 * ici mesurerait sa propre copie. Le vérificateur est injecté, et ce qui est
 * sondé est la MÉCANIQUE : est-ce qu'un cliché déclenche une reprise, est-ce
 * que la reprise le nomme, et est-ce que le second échec refuse proprement.
 */
describe("⚠ les clichés d'annuaire sont pré-scannés, donc réparables", () => {
  const CLICHE = "you deserve";

  it("un cliché au premier jet déclenche une SECONDE tentative, et la prose propre est rendue", async () => {
    const call = vi.fn(async () => GOOD) as DirectoryCall;
    /* Le premier jet est sale, le second propre : un seul appel au vérificateur par champ. */
    let tour = 0;
    const cliches = vi.fn(async () => (tour++ < 2 ? [CLICHE] : []));

    const result = await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      FULL_STRUCTURED,
      call,
      cliches,
      NO_LIST
    );

    expect(result.modelCalls).toBe(2);
    expect(call).toHaveBeenCalledTimes(2);
    expect(result.draft.prose.firstParagraph).toBe(GOOD.firstParagraph);
  });

  it("⚠ la reprise NOMME la formule — « réécrivez » sans dire quoi est un ordre sans objet", async () => {
    const call = vi.fn(async () => GOOD) as DirectoryCall;
    let tour = 0;
    const cliches = vi.fn(async () => (tour++ < 2 ? [CLICHE] : []));

    await generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call, cliches, NO_LIST);

    const secondPrompt = (call as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1] as string;
    expect(secondPrompt).toContain(CLICHE);
  });

  it("⚠ deux jets sales REFUSENT, et pas sous l'erreur de déontologie", async () => {
    const call = vi.fn(async () => GOOD) as DirectoryCall;
    const cliches = vi.fn(async () => [CLICHE]);

    const echec = generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      FULL_STRUCTURED,
      call,
      cliches,
      NO_LIST
    );

    await expect(echec).rejects.toBeInstanceOf(DirectoryProseClicheError);
    /* ⚠ Un cliché n'est pas une infraction déontologique : deux familles, deux erreurs. */
    await expect(echec).rejects.not.toBeInstanceOf(DirectoryProseRefusedError);
    await expect(echec).rejects.toMatchObject({ phrases: [CLICHE] });
    expect(call).toHaveBeenCalledTimes(MAX_MODEL_CALLS);
  });

  it("⚠ LES DEUX CHAMPS SÉPARÉMENT, comme le trigger — une phrase à cheval n'est pas une phrase", async () => {
    const call = callOnce();
    const vus: string[] = [];
    const cliches = vi.fn(async (texte: string) => {
      vus.push(texte);
      return [];
    });

    await generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call, cliches, NO_LIST);

    expect(vus).toEqual([GOOD.firstParagraph, GOOD.body]);
    /* Jamais la concaténation des deux. */
    expect(vus.some((t) => t.includes(GOOD.firstParagraph) && t.includes(GOOD.body))).toBe(false);
  });

  it("une infraction déontologique passe AVANT le cliché — la licence prime", async () => {
    const call = vi.fn(async () => ({
      firstParagraph: "I guarantee results for every client I see.",
      body: GOOD.body,
    })) as DirectoryCall;
    const cliches = vi.fn(async () => [CLICHE]);

    await expect(
      generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, FULL_STRUCTURED, call, cliches, NO_LIST)
    ).rejects.toBeInstanceOf(DirectoryProseRefusedError);
    /* Le vérificateur de clichés n'est même pas consulté sur un jet bloqué. */
    expect(cliches).not.toHaveBeenCalled();
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ LE MODÈLE EST INFORMÉ DES PHRASES QU'ON LUI REFUSERA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mesuré en production le 19 septembre : QUATRE refus sur cinq générations,
 * la même phrase à chaque fois (« you deserve »), y compris après un
 * changement de type de licence ET de domaine d'expertise. Ce n'est pas le
 * brief qui produisait le cliché — c'est qu'on demandait au modèle d'écrire un
 * profil d'annuaire sans jamais lui donner la liste qui le ferait rejeter.
 *
 * Une reprise répare un jet. Elle ne répare pas un prompt qui ne dit pas la
 * règle : c'est le maillon qui manquait, et celui-ci le sonde.
 *
 * ⚠ AUCUNE PHRASE RÉELLE N'EST ÉCRITE ICI. Les trente vivent dans
 * `banned_phrases` ; ce qui est sondé est la MÉCANIQUE — la liste arrive-t-elle
 * dans le prompt, une seule fois, et le prompt reste-t-il valide sans elle.
 */
describe("⚠ les clichés entrent dans le prompt système", () => {
  it("chaque phrase de la liste est écrite dans le prompt", () => {
    const system = directorySystemPrompt(FIXTURE_CATALOG.ethicsRules, [
      "you deserve",
      "safe space",
    ]);
    expect(system).toContain("you deserve");
    expect(system).toContain("safe space");
    /* ⚠ Et elles sont présentées comme une INTERDICTION, pas comme un exemple. */
    expect(system).toMatch(/never use/i);
  });

  it("⚠ une liste vide ne laisse PAS un bloc vide ni un titre orphelin", () => {
    const sans = directorySystemPrompt(FIXTURE_CATALOG.ethicsRules, []);
    expect(sans).not.toMatch(/never use/i);
    /* Le prompt reste utilisable : les règles déontologiques y sont toujours. */
    expect(sans).toContain("Psychology Today profile");
    expect(sans.trim()).toBe(sans);
  });

  /*
   * ⚠ L'ORDRE, ET UNE TAUTOLOGIE ÉCRITE PUIS RETIRÉE. La première version de
   * cette sonde comparait `indexOf(...)` à `x > 0 ? 0 : 0` — toujours vrai,
   * donc elle passait au vert en affirmant l'ordre INVERSE de celui que le
   * code produit. Une assertion qui ne peut pas échouer ne mesure rien, et
   * celle-ci cachait une erreur à moi.
   *
   * L'ordre réel, et celui qu'on veut : la déontologie, puis les clichés, puis
   * le style. Une licence en risque prime sur une phrase usée.
   */
  it("⚠ les règles déontologiques passent avant les clichés, et le style après", () => {
    const system = directorySystemPrompt(FIXTURE_CATALOG.ethicsRules, ["you deserve"]);
    const deontologie = system.search(/never|not|avoid/i);
    const cliches = system.indexOf("you deserve");
    const style = system.indexOf("Psychology Today profile");

    expect(deontologie).toBeGreaterThanOrEqual(0);
    expect(cliches).toBeGreaterThan(deontologie);
    expect(style).toBeGreaterThan(cliches);
  });

  it("⚠ la liste est lue UNE fois, avant la boucle — pas à chaque tentative", async () => {
    const call = vi.fn(async () => GOOD) as DirectoryCall;
    let tour = 0;
    const cliches = vi.fn(async () => (tour++ < 2 ? ["you deserve"] : []));
    const liste = vi.fn(async () => ["you deserve"]);

    await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      FULL_STRUCTURED,
      call,
      cliches,
      liste
    );

    expect(call).toHaveBeenCalledTimes(2);
    expect(liste).toHaveBeenCalledTimes(1);
  });

  it("⚠ et ce que le modèle reçoit contient bien les phrases, pas seulement le prompt construit à part", async () => {
    const call = vi.fn(async () => GOOD) as DirectoryCall;
    await generateDirectoryProfile(
      BUNDLE,
      FIXTURE_CATALOG,
      FULL_STRUCTURED,
      call,
      NO_CLICHE,
      async () => ["you deserve"]
    );
    const systemRecu = (call as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(systemRecu).toContain("you deserve");
  });
});
