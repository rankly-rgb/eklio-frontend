import { describe, expect, it } from "vitest";
import {
  FIRST_LINE_MAX_ATTEMPTS,
  FIRST_LINE_TARGET_CHARS,
  introducedCredentials,
  rewriteFirstLine,
} from "@/lib/check/first-line";
import { rewriteAndRescan } from "@/lib/check/rewrite";
import type { EthicsRule, LicenseType, Degree } from "@/lib/catalog/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * THE FIRST LINE — LES DEUX GARDES, SONDÉES
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le palier gratuit est le seul chemin du produit qu'une inconnue atteint sans
 * compte, sans kit et sans achat. Tout ce qui le garde se tient donc ici, et
 * chaque garde est sondée dans les DEUX sens : elle refuse ce qu'elle doit
 * refuser, et elle laisse passer ce qu'elle doit laisser passer. Une garde qui
 * refuse tout serait verte sur la moitié gauche de ce fichier.
 */

const RULES: EthicsRule[] = [
  {
    id: "proven",
    short_label: "No promised outcomes",
    description: "Never promise a result, a cure, or a recovery.",
    example_forbidden: "I guarantee you will heal.",
  } as unknown as EthicsRule,
];

const TITRES: Pick<LicenseType, "label" | "description">[] = [
  { label: "LCSW", description: "Licensed Clinical Social Worker" },
  { label: "LMFT", description: "Licensed Marriage and Family Therapist" },
];

const DIPLOMES: Pick<Degree, "label">[] = [{ label: "PhD" } as Pick<Degree, "label">];

/** Un texte impeccable qui ouvre sur les diplômes. Le cas qu'on vend. */
const OUVRE_SUR_LE_CV =
  "I hold a PhD from Berkeley and have been licensed in California for twelve years.";

/** Ce qu'une réécriture devrait produire : la lectrice d'abord. */
const OUVRE_SUR_LA_LECTRICE =
  "You are struggling to sleep, and the mornings are the hardest part of your day.";

/** Rend toujours la même chose, sans jamais dépenser. */
const rend = (texte: string) => async () => texte;

describe("le cas que The First Line existe pour servir", () => {
  /*
   * ⚠ LA SONDE QUI JUSTIFIE TOUT LE FICHIER `first-line.ts`. Un profil qui
   * ouvre sur un doctorat ne déclenche AUCUNE des six règles — il n'y a rien à
   * réparer. `rewriteAndRescan` ne part donc jamais au modèle et rend le texte
   * inchangé. C'est juste pour ce qu'elle fait, et ce serait « rien » pour la
   * cliente qu'on veut servir.
   */
  it("un texte qui ouvre sur les diplômes ne déclenche aucune règle", async () => {
    const ancien = await rewriteAndRescan(OUVRE_SUR_LE_CV, RULES, rend("jamais appelé"));
    expect(ancien.attempts).toBe(0);
    expect(ancien.unchanged).toBe(true);
    expect(ancien.text).toBe(OUVRE_SUR_LE_CV);
  });

  it("⚠ et The First Line le réécrit quand même — c'est toute la différence", async () => {
    const outcome = await rewriteFirstLine(
      OUVRE_SUR_LE_CV,
      RULES,
      TITRES,
      DIPLOMES,
      rend(OUVRE_SUR_LA_LECTRICE)
    );
    expect(outcome.attempts).toBe(1);
    expect(outcome.rewritten).toBe(OUVRE_SUR_LA_LECTRICE);
    expect(outcome.resolved).toBe(true);
  });
});

describe("la garde déontologique mord sur le texte PRODUIT", () => {
  it("refuse de rendre une réécriture qui promet un résultat", async () => {
    const outcome = await rewriteFirstLine(
      OUVRE_SUR_LE_CV,
      RULES,
      TITRES,
      DIPLOMES,
      rend("I guarantee you will heal from your anxiety.")
    );

    expect(outcome.refusal).toBe("ethics");
    expect(outcome.rewritten).toBeNull();
    expect(outcome.resolved).toBe(false);
    expect(outcome.after.some((f) => f.severity === "block")).toBe(true);
  });

  it("réessaie une fois, et pas deux", async () => {
    let appels = 0;
    const outcome = await rewriteFirstLine(
      OUVRE_SUR_LE_CV,
      RULES,
      TITRES,
      DIPLOMES,
      async () => {
        appels += 1;
        return "I guarantee you will heal.";
      }
    );
    expect(appels).toBe(FIRST_LINE_MAX_ATTEMPTS);
    expect(appels).toBe(2);
    expect(outcome.attempts).toBe(2);
  });

  it("⚠ et le diagnostic part quand même — c'est la moitié qu'on a promise", async () => {
    const outcome = await rewriteFirstLine(
      "I guarantee you will heal from your anxiety.",
      RULES,
      TITRES,
      DIPLOMES,
      rend("I guarantee you will heal.")
    );
    expect(outcome.rewritten).toBeNull();
    expect(outcome.before.length).toBeGreaterThan(0);
  });
});

describe("la garde de credential : ce que NOUS écrivons, pas ce qu'elle a écrit", () => {
  it("refuse une réécriture qui ajoute un titre qu'elle n'avait pas", async () => {
    const outcome = await rewriteFirstLine(
      OUVRE_SUR_LA_LECTRICE,
      RULES,
      TITRES,
      DIPLOMES,
      rend("As an LCSW, I know the mornings are the hardest part of your day.")
    );

    expect(outcome.refusal).toBe("credential_introduced");
    expect(outcome.rewritten).toBeNull();
    expect(outcome.introduced).toEqual(["LCSW"]);
  });

  it("⚠ mais LAISSE le titre qu'elle a publié elle-même — c'est la prémisse du lot", async () => {
    const sien = "I am an LCSW and I work with new mothers.";
    const outcome = await rewriteFirstLine(
      sien,
      RULES,
      TITRES,
      DIPLOMES,
      rend("The first months are harder than anyone told you. I am an LCSW who works with new mothers.")
    );

    expect(outcome.refusal).toBeNull();
    expect(outcome.rewritten).toContain("LCSW");
    expect(outcome.introduced).toEqual([]);
  });

  it("attrape le titre écrit en toutes lettres, pas seulement le sigle", () => {
    expect(
      introducedCredentials(
        "I work with new mothers.",
        "I am a Licensed Marriage and Family Therapist working with new mothers.",
        TITRES,
        DIPLOMES
      )
    ).toEqual(["Licensed Marriage and Family Therapist"]);
  });

  it("attrape un diplôme inventé, qui est un credential comme un autre", () => {
    expect(
      introducedCredentials("I work with new mothers.", "I hold a PhD.", TITRES, DIPLOMES)
    ).toEqual(["PhD"]);
  });

  /*
   * ⚠ CELLE-CI EST LA SONDE QUI MANQUAIT AILLEURS. Un sigle court à l'intérieur
   * d'un mot n'est pas un sigle : sans les bornes de mot, « LEP » ferait
   * trébucher « sleep » et « slept », et la garde refuserait des réécritures
   * parfaitement honnêtes jusqu'à ce que quelqu'un la désarme entièrement.
   */
  it("⚠ ne confond pas un sigle avec les lettres d'un autre mot", () => {
    const avecLep = [...TITRES, { label: "LEP", description: "Licensed Educational Psychologist" }];
    expect(
      introducedCredentials(
        "I work with new mothers.",
        "You have not slept properly in months, and sleep is the first thing to go.",
        avecLep,
        []
      )
    ).toEqual([]);
  });

  it("ne se laisse pas avoir par la casse", () => {
    expect(
      introducedCredentials("I work with new mothers.", "I am an lcsw.", TITRES, [])
    ).toEqual(["LCSW"]);
  });
});

describe("la longueur cible", () => {
  /*
   * ⚠ ÉPINGLÉE PARCE QU'ELLE EST FAUSSE. Personne n'a vérifié ce que
   * Psychology Today affiche en résultats de recherche — cet environnement ne
   * peut pas atteindre le site. La valeur est provisoire, et l'épingler rend
   * son changement visible dans un diff au lieu d'une dérive silencieuse.
   */
  it("vaut 320 caractères, valeur provisoire à changer dans lib/check/first-line.ts", () => {
    expect(FIRST_LINE_TARGET_CHARS).toBe(320);
  });

  it("⚠ et elle atteint réellement l'invite — sinon le paramètre ne sert à rien", async () => {
    let vue = "";
    await rewriteFirstLine(
      OUVRE_SUR_LE_CV,
      RULES,
      TITRES,
      DIPLOMES,
      async (_system, instruction) => {
        vue = instruction;
        return OUVRE_SUR_LA_LECTRICE;
      },
      512
    );
    expect(vue).toContain("512 characters");
  });

  it("⚠ et l'invite dit d'ouvrir sur la lectrice, pas de changer le moins possible", async () => {
    let systeme = "";
    await rewriteFirstLine(
      OUVRE_SUR_LE_CV,
      RULES,
      TITRES,
      DIPLOMES,
      async (system) => {
        systeme = system;
        return OUVRE_SUR_LA_LECTRICE;
      }
    );
    expect(systeme).toMatch(/OPEN ON THE READER'S PROBLEM/);
    expect(systeme).not.toMatch(/Change as little as possible/);
  });
});

describe("le coût, borné dans le module lui-même", () => {
  /*
   * Le plafond en base (`consume_anon_generation`) borne le nombre de
   * REQUÊTES. Ce qui borne le nombre d'APPELS par requête est ici, et les deux
   * se multiplient : c'est ce produit qui fait la dépense maximale.
   */
  it("ne dépasse jamais deux appels modèle, quoi que rende le modèle", async () => {
    for (const reponse of ["", "I guarantee you will heal.", "As an LCSW, hello."]) {
      let appels = 0;
      await rewriteFirstLine(OUVRE_SUR_LE_CV, RULES, TITRES, DIPLOMES, async () => {
        appels += 1;
        return reponse;
      });
      expect(appels).toBeLessThanOrEqual(2);
    }
  });

  it("s'arrête au premier essai quand il est bon — le cas courant coûte UN appel", async () => {
    let appels = 0;
    await rewriteFirstLine(OUVRE_SUR_LE_CV, RULES, TITRES, DIPLOMES, async () => {
      appels += 1;
      return OUVRE_SUR_LA_LECTRICE;
    });
    expect(appels).toBe(1);
  });
});
