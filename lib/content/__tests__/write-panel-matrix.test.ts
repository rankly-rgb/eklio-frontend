import { describe, expect, it } from "vitest";
import {
  writeScreen,
  postKindFor,
  writeStateFor,
  writeOffReason,
  writeOffDetail,
  type PostKind,
  type WriteState,
} from "@/lib/content/write-screen";

/*
 * ── LA MATRICE type de post × état ──────────────────────────────────────
 *
 * Le trou d'origine était qu'aucune combinaison n'était décidée quelque part
 * de lisible : la page montrait le formulaire vide dans tous les cas où elle
 * n'avait pas de carte. Les neuf cases sont maintenant énumérées, et le test
 * échoue si une case manque à la table.
 */

const KINDS: PostKind[] = ["generated", "manual_empty", "manual_partial"];
const STATES: WriteState[] = ["armed", "not_switched_on", "quota_exhausted"];

/**
 * Ce que l'écran doit montrer.
 *
 * ⚠ LA COLONNE « generated » EST CONSTANTE : un post déjà écrit n'a pas de
 * panneau. Elle vient le relire, pas le refaire — « Regenerate » est ailleurs
 * et porte son coût dans son libellé.
 *
 * ⚠ ET LE PANNEAU RESTE SUR LES DEUX AUTRES MÊME NON ARMÉ. C'est la règle
 * 1.5 : il se désarme, il ne disparaît pas. Le faire disparaître renverrait
 * au formulaire vide sans qu'elle apprenne que la fonction existe.
 */
const EXPECTED: Record<PostKind, Record<WriteState, ReturnType<typeof writeScreen>>> = {
  generated: {
    armed: { panel: false, writeEnabled: false, notice: null, warnsOverwrite: false },
    not_switched_on: { panel: false, writeEnabled: false, notice: null, warnsOverwrite: false },
    quota_exhausted: { panel: false, writeEnabled: false, notice: null, warnsOverwrite: false },
  },
  manual_empty: {
    armed: { panel: true, writeEnabled: true, notice: null, warnsOverwrite: false },
    not_switched_on: {
      panel: true,
      writeEnabled: false,
      notice: "not_switched_on",
      warnsOverwrite: false,
    },
    quota_exhausted: {
      panel: true,
      writeEnabled: false,
      notice: "quota_exhausted",
      warnsOverwrite: false,
    },
  },
  manual_partial: {
    // ⚠ LE PANNEAU EST LÀ, ET IL PRÉVIENT AVANT D'ÉCRASER SES MOTS.
    armed: { panel: true, writeEnabled: true, notice: null, warnsOverwrite: true },
    not_switched_on: {
      panel: true,
      writeEnabled: false,
      notice: "not_switched_on",
      warnsOverwrite: true,
    },
    quota_exhausted: {
      panel: true,
      writeEnabled: false,
      notice: "quota_exhausted",
      warnsOverwrite: true,
    },
  },
};

describe("⚠ MATRICE type de post × état", () => {
  it("la table couvre les neuf cases, sans trou", () => {
    expect(KINDS).toHaveLength(3);
    for (const kind of KINDS) {
      expect(Object.keys(EXPECTED[kind]).sort(), kind).toEqual([
        "armed",
        "not_switched_on",
        "quota_exhausted",
      ]);
    }
  });

  for (const kind of KINDS) {
    for (const state of STATES) {
      it(`${kind} · ${state}`, () => {
        expect(writeScreen({ kind, state })).toEqual(EXPECTED[kind][state]);
      });
    }
  }
});

describe("⚠ LES CAS NÉGATIFS — ils échouent sur l'état d'avant", () => {
  it("un post manuel VIDE montre le panneau, pas le formulaire vide", () => {
    /*
     * C'est le défaut rapporté : « New item » puis Title / Caption / Alt text
     * / Tags, et un dégradé à la place du visuel. La promesse du produit est
     * qu'elle ne fait jamais face à un champ vide.
     */
    expect(writeScreen({ kind: "manual_empty", state: "armed" }).panel).toBe(true);
  });

  it("⚠ ET IL RESTE VISIBLE QUAND L'ÉCRITURE N'EST PAS ACTIVÉE", () => {
    // Règle 1.5. Le cacher renverrait au formulaire vide en silence.
    const screen = writeScreen({ kind: "manual_empty", state: "not_switched_on" });
    expect(screen.panel).toBe(true);
    expect(screen.writeEnabled).toBe(false);
    expect(screen.notice).toBe("not_switched_on");
  });

  it("quota épuisé : le panneau reste, « Write it » ne part pas", () => {
    const screen = writeScreen({ kind: "manual_partial", state: "quota_exhausted" });
    expect(screen.panel).toBe(true);
    expect(screen.writeEnabled).toBe(false);
    expect(screen.notice).toBe("quota_exhausted");
  });

  it("un post déjà écrit n'est pas interrompu par un panneau", () => {
    expect(writeScreen({ kind: "generated", state: "armed" }).panel).toBe(false);
  });

  it("⚠ SES MOTS NE SONT JAMAIS ÉCRASÉS SANS AVERTISSEMENT", () => {
    expect(writeScreen({ kind: "manual_partial", state: "armed" }).warnsOverwrite).toBe(true);
    expect(writeScreen({ kind: "manual_empty", state: "armed" }).warnsOverwrite).toBe(false);
  });
});

/*
 * ── LES DEUX VERROUS, ET LE FAIT QU'IL Y EN AVAIT UN SEUL ───────────────
 *
 * Trouvé en cliquant, le 2026-09-21 : avec `CONTENT_GENERATION_ARMED="true"`
 * et aucune `ANTHROPIC_API_KEY`, « Write it » s'allumait, annonçait « Uses 1
 * of your 7 left this month », et rendait un 503 au clic. Le type du panneau
 * disait pourtant depuis toujours « le drapeau est éteint, OU la clef
 * absente ». Ces cas-ci font échouer le retour en arrière.
 */
describe("ce qui désarme l'écriture", () => {
  it("le drapeau seul suffit à désarmer", () => {
    expect(writeStateFor({ armedFlag: false, keyPresent: true, creditsLeft: 7 })).toBe(
      "not_switched_on"
    );
    expect(writeOffReason({ armedFlag: false, keyPresent: true })).toBe("flag");
  });

  it("⚠ LA CLEF ABSENTE DÉSARME AUSSI — c'est le cas qui manquait", () => {
    expect(writeStateFor({ armedFlag: true, keyPresent: false, creditsLeft: 7 })).toBe(
      "not_switched_on"
    );
    expect(writeOffReason({ armedFlag: true, keyPresent: false })).toBe("key");
  });

  it("les deux ensemble se disent ensemble", () => {
    expect(writeOffReason({ armedFlag: false, keyPresent: false })).toBe("both");
    expect(writeOffDetail("both")).toContain("CONTENT_GENERATION_ARMED");
    expect(writeOffDetail("both")).toContain("ANTHROPIC_API_KEY");
  });

  it("armé et pourvu, le quota peut décider", () => {
    expect(writeStateFor({ armedFlag: true, keyPresent: true, creditsLeft: 0 })).toBe(
      "quota_exhausted"
    );
    expect(writeStateFor({ armedFlag: true, keyPresent: true, creditsLeft: 7 })).toBe("armed");
    expect(writeStateFor({ armedFlag: true, keyPresent: true, creditsLeft: null })).toBe("armed");
    expect(writeOffReason({ armedFlag: true, keyPresent: true })).toBeNull();
  });

  /*
   * ⚠ L'ORDRE, ET CE QU'IL ÉVITE. Un quota à zéro sur un déploiement non armé
   * dirait « ça revient le 1er » — et rien ne reviendrait. Le désarmement
   * passe devant, et ce cas fige l'ordre.
   */
  it("désarmé bat épuisé", () => {
    expect(writeStateFor({ armedFlag: false, keyPresent: false, creditsLeft: 0 })).toBe(
      "not_switched_on"
    );
  });
});

/*
 * ── LA CARTE N'EST PAS UNE SIGNATURE ────────────────────────────────────
 *
 * La page répondait « generated » dès qu'une carte composait. Un
 * `single_statement` compose depuis le TITRE — et `statement` est l'archétype
 * par défaut de « New post ». Taper quatre mots faisait donc disparaître le
 * panneau, et `manual_partial` était inatteignable pour l'archétype par
 * défaut. Ces cas-ci le rendent atteignable, et le gardent.
 */
describe("quel type de post", () => {
  const nothing = { topicId: null, payload: null, rationale: null };

  it("rien dedans : le post est vide", () => {
    expect(postKindFor({ hasCaption: false, hasTitle: false, marks: nothing })).toBe(
      "manual_empty"
    );
  });

  it("⚠ UN TITRE À ELLE RESTE À ELLE — c'est le cas qui manquait", () => {
    expect(postKindFor({ hasCaption: false, hasTitle: true, marks: nothing })).toBe(
      "manual_partial"
    );
    // Et donc le panneau reste, avec l'avertissement d'écrasement.
    expect(writeScreen({ kind: "manual_partial", state: "armed" })).toEqual({
      panel: true,
      writeEnabled: true,
      notice: null,
      warnsOverwrite: true,
    });
  });

  it("une légende suffit à dire que c'est écrit", () => {
    expect(postKindFor({ hasCaption: true, hasTitle: true, marks: nothing })).toBe("generated");
  });

  it.each([
    ["un sujet de banque", { topicId: "t", payload: null, rationale: null }],
    ["un payload de diagramme", { topicId: null, payload: { statement: "x" }, rationale: null }],
    ["une ligne « Why this one »", { topicId: null, payload: null, rationale: "because" }],
  ])("chacune des trois marques dit que c'est Eklio : %s", (_label, marks) => {
    expect(postKindFor({ hasCaption: false, hasTitle: true, marks })).toBe("generated");
  });
});
