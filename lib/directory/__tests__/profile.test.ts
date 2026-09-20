import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildCredentialBlock,
  BODY_MAX,
  FIRST_PARAGRAPH_MAX,
  buildDirectoryProfile,
  buildStructuredFields,
  checkProse,
  labelList,
} from "@/lib/directory/profile";

/*
 * ── LE PROFIL D'ANNUAIRE, ET LE DÉFAUT QU'IL DOIT ÉVITER ────────────────
 *
 * `site_spec_token_lines` lisait `p_spec->>'primary_text_hex'` à nu.
 * `'libellé' || ': ' || NULL` vaut NULL, et TROIS LIGNES ONT DISPARU d'un
 * livrable payant sans la moindre erreur. Elles ont été trouvées en lisant la
 * sortie rendue, pas en lisant le code.
 *
 * Un profil Psychology Today est un assemblage de champs souvent absents. Ce
 * fichier existe pour que la même chose ne s'y produise pas.
 */

const EMPTY = {
  state: null,
  specialties: [],
  modalities: [],
  personas: [],
  insurances: [],
};

describe("⚠ tous les champs optionnels vides est un CAS NORMAL", () => {
  it("le profil est produit, pas refusé", () => {
    /*
     * Le test que le lot exige nommément. Une praticienne qui n'a coché
     * aucune modalité, aucune assurance et aucun persona a un profil valide :
     * elle a une prose, et c'est la prose qui est le livrable.
     */
    const result = buildDirectoryProfile({
      platform: "psychology_today",
      firstParagraph: "The paragraph search results show.",
      body: "The rest of it.",
      structured: EMPTY,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.structured).toEqual({});
    expect(result.draft.prose.firstParagraph).toBe(
      "The paragraph search results show."
    );
  });

  it("aucune clé vide, aucune liste vide, aucun undefined", () => {
    /*
     * ⚠ `{issues: []}` et l'absence d'`issues` disent la même chose à un
     * humain et deux choses différentes à du code : la première invite à
     * écrire « Issues: » suivi de rien, ce qui est exactement la ligne
     * fantôme qu'on cherche à ne pas produire.
     *
     * Et la base refuse l'autre forme du même défaut — une chaîne vide DANS
     * une liste (`directory_structured_valid`).
     */
    const fields = buildStructuredFields(EMPTY);
    expect(Object.keys(fields)).toEqual([]);
    expect(JSON.stringify(fields)).toBe("{}");
    for (const value of Object.values(fields)) {
      expect(value).not.toBeUndefined();
    }
  });
});

describe("la moitié des champs remplis, l'autre vide", () => {
  const half = buildStructuredFields({
    state: "Oregon",
    specialties: ["Trauma", "Anxiety"],
    modalities: [],
    personas: ["First responders"],
    insurances: [],
  });

  it("ce qui est là est là", () => {
    expect(half.licensed_state).toEqual(["Oregon"]);
    expect(half.issues).toEqual(["Trauma", "Anxiety"]);
    expect(half.client_focus).toEqual(["First responders"]);
  });

  it("⚠ ce qui n'est pas là est ABSENT, pas vide", () => {
    expect("therapy_types" in half).toBe(false);
    expect("insurance" in half).toBe(false);
  });

  it("rien ne s'est perdu en silence", () => {
    // Trois champs entrés, trois clés sorties. Un quatrième champ qui
    // disparaîtrait ferait tomber ce compte.
    expect(Object.keys(half).sort()).toEqual([
      "client_focus",
      "issues",
      "licensed_state",
    ]);
  });
});

describe("un libellé de catalogue disparu ne laisse pas de trou muet", () => {
  it("il ne produit rien, et la liste raccourcit", () => {
    /*
     * ⚠ C'EST LE TROISIÈME DES QUATRE DÉFAUTS PERMISSIFS DU BACKEND :
     * `array_to_string` écarte les NULL en silence, et c'est ce qui a rendu
     * le défaut de concaténation invisible. Ici la liste raccourcit, ce qui
     * se voit — au lieu d'un séparateur en trop, qui ne se voit pas.
     */
    expect(labelList(["Trauma", null, "Anxiety", undefined, "  "])).toEqual([
      "Trauma",
      "Anxiety",
    ]);
  });

  it("un identifiant non résolu ne devient jamais une chaîne vide", () => {
    const fields = buildStructuredFields({ ...EMPTY, specialties: [null, undefined] });
    expect("issues" in fields).toBe(false);
  });
});

describe("le premier paragraphe est récupérable seul", () => {
  it("il est rendu séparément du corps", () => {
    const result = buildDirectoryProfile({
      platform: "psychology_today",
      firstParagraph: "Search results show only this.",
      body: "And this is everything after it.",
      structured: EMPTY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.prose.firstParagraph).toBe("Search results show only this.");
    expect(result.draft.prose.body).toBe("And this is everything after it.");
  });

  it("⚠ le corps ne répète pas le premier paragraphe", () => {
    /*
     * Un modèle à qui on demande « le premier paragraphe, puis le reste »
     * recopie très souvent le premier en tête du reste. Le profil public
     * montrerait alors deux fois la même phrase.
     */
    const verdict = checkProse("The opening line.", "The opening line. Then more.");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.problems).toContain(
      "body_repeats_first_paragraph"
    );
  });
});

describe("⚠ on refuse, on ne tronque pas", () => {
  it("une prose trop longue échoue au lieu d'être coupée", () => {
    /*
     * Une coupure silencieuse produit une phrase qui s'arrête au milieu, sur
     * un profil public, et personne ne l'a décidée. La règle commune du
     * dépôt : « quand un choix existe entre refuser bruyamment et rendre
     * quelque chose d'incomplet, prendre le refus ».
     */
    const verdict = checkProse("x".repeat(FIRST_PARAGRAPH_MAX + 1), "body");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.problems).toContain(
      "first_paragraph_too_long"
    );
  });

  it("les deux bornes sont celles de la base", () => {
    // `directory_profiles_first_paragraph_check` et `_body_check`. La
    // duplication évite un aller-retour vers une contrainte qui va refuser ;
    // la base reste l'autorité, et ces deux lignes sont l'épingle.
    expect(FIRST_PARAGRAPH_MAX).toBe(1200);
    expect(BODY_MAX).toBe(6000);
  });

  it("une prose absente est un échec nommé, pas un profil vide", () => {
    const verdict = checkProse(null, "   ");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.problems.sort()).toEqual([
      "body_missing",
      "first_paragraph_missing",
    ]);
  });
});

describe("⚠ le module ne fabrique aucune chaîne", () => {
  it("il ne joint rien et ne met aucun libellé devant une valeur", () => {
    /*
     * C'EST L'INTERDICTION DU LOT, ET ELLE SE VÉRIFIE EN LISANT LE FICHIER.
     * Une composition par concaténation est exactement ce qui a fait
     * disparaître trois lignes d'un livrable payant ; un test de
     * comportement ne l'attraperait qu'avec la combinaison de champs absents
     * qui la déclenche, c'est-à-dire peut-être jamais.
     *
     * Les commentaires sont retirés d'abord : ils CITENT la construction
     * fautive pour expliquer pourquoi elle est interdite.
     */
    const source = readFileSync("lib/directory/profile.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(source, "un join() compose une sortie").not.toMatch(/\.join\(/);
    expect(source, "un littéral de gabarit compose une sortie").not.toMatch(/\$\{/);
    // Une concaténation de chaînes, la forme TypeScript du défaut SQL.
    expect(source, "une concaténation de littéraux").not.toMatch(/["'`]\s*\+\s*/);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ LES INTERTITRES — UN PROFIL N'EST PAS UNE BROCHURE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Relevé sur le chemin réel le 20 septembre : WHAT THE WORK LOOKS LIKE, et ses
 * voisines, en capitales, sur leur propre ligne.
 *
 * La prohibition est aussi dans le prompt — niveau 1. Celle-ci est le niveau 2,
 * parce qu'un FORMAT est exactement la consigne qu'un modèle laisse tomber sans
 * le dire, et parce que ce défaut-là se mesure sans jugement.
 */
describe("⚠ une ligne en capitales est un intertitre, et le gabarit le refuse", () => {
  const BON = "You keep having the same argument, and neither of you can say why.";

  it.each([
    ["un intertitre franc", "WHAT THE WORK LOOKS LIKE\n\nWe start by slowing it down."],
    ["un intertitre plus court", "HOW I WORK\n\nSlowly, and out loud."],
    ["un intertitre avec ponctuation", "WHAT TO EXPECT:\n\nA first session is mostly listening."],
  ])("%s est refusé", (_quoi, corps) => {
    const verdict = checkProse(BON, corps);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.problems).toContain("has_section_heading");
  });

  /*
   * ⚠ ET CE QUI NE DOIT PAS ÊTRE REFUSÉ. La condition « deux mots au moins »
   * existe pour ces cas-là : un sigle seul est en capitales sans être un titre
   * de section, et le métier en est plein.
   */
  it.each([
    ["un sigle seul sur sa ligne", "I trained in EMDR.\nEMDR\nIt shapes how I pay attention."],
    ["des sigles dans une phrase", "I am an LCSW and I trained in EMDR and IFS."],
    ["une phrase normale", "We start by slowing that argument down until you can both hear it."],
    ["un mot emphatique isolé", "It is slow. VERY slow, some weeks."],
  ])("%s passe", (_quoi, corps) => {
    const verdict = checkProse(BON, corps);
    if (!verdict.ok) expect(verdict.problems).not.toContain("has_section_heading");
  });

  it("⚠ le PREMIER PARAGRAPHE est regardé aussi — rien n'empêche un titre d'ouvrir", () => {
    const verdict = checkProse("ABOUT MY PRACTICE\n\n" + BON, "We start by slowing it down.");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.problems).toContain("has_section_heading");
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ LE BLOC DE CREDENTIAL — LE TITRE VIENT DU CATALOGUE, PAS DE LA LIGNE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Décision du 18 septembre, construite le 20. Le cas qui suit n'est pas
 * inventé : c'est l'un des trois briefs réels, relevé en base le 20 septembre.
 * Sa `practitioner_line` dit « Gary Whitfiled, PSYCH » et son brief dit
 * `lcsw`. PSYCH est le sigle catalogue de `licensed_psychologist` — le titre
 * d'un AUTRE board. Recopier la ligne l'imprimerait sur une page publique.
 */
describe("⚠ le bloc de credential", () => {
  it("⚠ LE CAS RÉEL : le titre saisi est écarté, celui du catalogue est écrit", () => {
    const bloc = buildCredentialBlock("Gary Whitfiled, PSYCH", {
      full: "Licensed Clinical Social Worker",
      abbreviation: "LCSW",
    });
    expect(bloc).toEqual({
      name: "Gary Whitfiled",
      title: "Licensed Clinical Social Worker",
      abbreviation: "LCSW",
    });
    /* Le titre saisi ne survit nulle part dans le bloc. */
    expect(JSON.stringify(bloc)).not.toContain("PSYCH");
  });

  /*
   * ⚠ UN SIGLE ABSENT N'EST PAS UN TITRE ABSENT. La Californie ne publie aucun
   * sigle pour une psychologue, et l'Oregon n'a aucun couple relevé : dans les
   * deux cas c'est l'intitulé complet qui s'écrit. C'est la Floride qui rend
   * cette chaîne obligatoire (§490.012(2)(b)).
   */
  it("sans sigle publié, l'intitulé complet reste imprimable", () => {
    const bloc = buildCredentialBlock("Mike Daniels, LMHC", {
      full: "Licensed Mental Health Counselor",
      abbreviation: null,
    });
    expect(bloc?.abbreviation).toBeNull();
    expect(bloc?.title).toBe("Licensed Mental Health Counselor");
  });

  it("sans nom, ou sans titre au catalogue, il n'y a pas de bloc", () => {
    expect(buildCredentialBlock(null, { full: "X", abbreviation: null })).toBeNull();
    expect(buildCredentialBlock("   ", { full: "X", abbreviation: null })).toBeNull();
    expect(buildCredentialBlock(", LCSW", { full: "X", abbreviation: null })).toBeNull();
    expect(buildCredentialBlock("Nora Whitfield", null)).toBeNull();
  });

  it("une ligne sans virgule est un nom entier", () => {
    expect(buildCredentialBlock("Nora Whitfield", { full: "X", abbreviation: "Y" })?.name).toBe(
      "Nora Whitfield"
    );
  });
});
