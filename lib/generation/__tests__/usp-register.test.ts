import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  acronymOf,
  checkRegister,
  registerReason,
} from "@/lib/generation/usp-register";
import { USP_ANGLES, LEGACY_USP_ANGLES } from "@/lib/generation/how-you-work-shapes";

/*
 * ── GATE 5 — NI MODALITÉ, NI DÉMOGRAPHIE ────────────────────────────────
 *
 * L'offre du 13 septembre : « sa niche, formulée dans les mots de ses
 * patients, pas en modalités ni en démographie ».
 *
 * ⚠ POURQUOI UNE GATE ET PAS SEULEMENT UN PROMPT. Un modèle à qui on interdit
 * « EMDR » écrit « une approche fondée sur le retraitement des souvenirs ».
 * C'est la même leçon que `lib/check/rewrite.ts` a apprise sur les garanties,
 * et elle est écrite dans son en-tête : « a model asked to remove a guarantee
 * will often produce a softer guarantee ».
 */

describe("les angles disent ce que l'offre demande", () => {
  it("aucun angle généré n'est une démographie ni une modalité", () => {
    expect([...USP_ANGLES]).toEqual([
      "presenting_problem",
      "the_moment",
      "what_keeps_returning",
    ]);
  });

  it("les deux angles que l'offre interdisait sont retirés de la génération", () => {
    /*
     * `population` était la démographie, `method` était la modalité. Les
     * renommer n'aurait rien changé : c'est ce qu'ils demandaient au modèle
     * d'écrire qui était devenu faux.
     */
    expect(USP_ANGLES as readonly string[]).not.toContain("population");
    expect(USP_ANGLES as readonly string[]).not.toContain("method");
  });

  it("⚠ ils restent LISIBLES, parce que des briefs les portent", () => {
    // Les refuser en lecture ferait disparaître le positionnement de quelqu'un
    // au rechargement d'une page.
    expect([...LEGACY_USP_ANGLES]).toEqual([
      "population",
      "method",
      "lived_experience",
    ]);
  });
});

describe("la modalité est refusée", () => {
  const vocabulary = {
    modalityLabels: ["EMDR", "Eye movement desensitization and reprocessing"],
    personaLabels: [],
  };

  it("par son sigle", () => {
    const verdict = checkRegister(
      "EMDR anchors every session, steady and unhurried.",
      vocabulary
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.kind).toBe("modality");
  });

  it("par son nom complet", () => {
    const verdict = checkRegister(
      "Eye movement desensitization and reprocessing, at your pace.",
      vocabulary
    );
    expect(verdict.ok).toBe(false);
  });

  it("⚠ et la phrase de la patiente passe", () => {
    // La même niche, dite du point de vue de la personne qui appelle.
    expect(
      checkRegister(
        "For the call you put off for months after the job followed you home.",
        vocabulary
      ).ok
    ).toBe(true);
  });
});

describe("la limite de mot n'est pas décorative", () => {
  it("un libellé court n'attrape pas un mot qui le contient", () => {
    /*
     * ⚠ Sans `\\b`, « art » attrape « part », « started », « heartbreak ».
     * C'est la même discipline que `usp_banned_phrases_check` en base (`\\y`)
     * et que les patterns de `lib/ethics/rules.ts`.
     */
    const vocabulary = { modalityLabels: ["Art"], personaLabels: [] };
    expect(
      checkRegister("It started with a heartbreak she could not part with.", vocabulary).ok
    ).toBe(true);
    expect(checkRegister("Art is the way in.", vocabulary).ok).toBe(false);
  });

  it("un terme de moins de trois lettres n'est jamais cherché", () => {
    // Deux lettres attrapent trop, et une gate qui refuse une phrase correcte
    // coûte une régénération à chaque fois.
    const vocabulary = { modalityLabels: ["IT"], personaLabels: [] };
    expect(checkRegister("It is quiet here.", vocabulary).ok).toBe(true);
  });
});

describe("l'acronyme est dérivé, pas listé", () => {
  it("des initiales des mots significatifs", () => {
    expect(acronymOf("Cognitive behavioral therapy")).toBe("CBT");
    expect(acronymOf("Eye movement desensitization and reprocessing")).toBe("EMDR");
    expect(acronymOf("Internal family systems")).toBe("IFS");
  });

  it("null en dessous de trois lettres", () => {
    expect(acronymOf("Art")).toBeNull();
    expect(acronymOf("Play therapy")).toBeNull();
  });
});

describe("le segment de marché est refusé, la situation ne l'est pas", () => {
  const vocabulary = {
    modalityLabels: [],
    personaLabels: ["High-achieving professionals"],
  };

  it("reprendre le libellé du segment est refusé", () => {
    const verdict = checkRegister(
      "For high-achieving professionals who never stop.",
      vocabulary
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.kind).toBe("demographic");
  });

  it("⚠ dire la même situation autrement passe, et c'est le but", () => {
    /*
     * L'offre distingue « nommer une SITUATION de vie », permis, de « nommer
     * un segment de marché », interdit. La gate ne tranche donc pas sur le
     * persona lui-même : elle refuse la reprise LITTÉRALE de son libellé,
     * qui est la forme sous laquelle un segment arrive dans une phrase.
     */
    expect(
      checkRegister(
        "For the people who are good at everything except stopping.",
        vocabulary
      ).ok
    ).toBe(true);
  });
});

describe("la raison sert la reprise", () => {
  it("elle nomme le mot fautif, pas la règle", () => {
    /*
     * « évite les modalités » ne fait pas atterrir une reprise ; « le mot
     * "EMDR" » si. C'est ce que `lib/ethics/guard.ts` a établi en citant
     * l'extrait fautif plutôt que la règle.
     */
    const verdict = checkRegister("EMDR, gently.", {
      modalityLabels: ["EMDR"],
      personaLabels: [],
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(registerReason(verdict)).toContain("EMDR");
  });
});

describe("⚠ aucune liste universelle de modalités", () => {
  it("le module ne nomme aucune thérapie", () => {
    /*
     * C'EST LE POINT DU MODULE. Une liste universelle serait incomplète le
     * jour de son écriture et fausse un mois plus tard. La gate compare la
     * phrase à ce qu'ELLE a coché — donc une thérapeute EMDR est protégée
     * contre « EMDR » sans qu'on ait à connaître EMDR.
     *
     * Les commentaires sont retirés avant l'inspection : l'en-tête cite des
     * exemples pour expliquer, et interdire ça reviendrait à interdire
     * d'écrire la raison.
     */
    const source = readFileSync("lib/generation/usp-register.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    for (const name of ["EMDR", "CBT", "IFS", "somatic", "psychodynamic"]) {
      expect(source, `${name} est écrit en dur`).not.toContain(name);
    }
  });
});
