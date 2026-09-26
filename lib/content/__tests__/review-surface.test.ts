import { describe, expect, it } from "vitest";
import { layoutAlternatives, MAX_ALTERNATIVES } from "@/lib/content/alternatives";
import { cardBands } from "@/lib/content/review";
import { payloadPublishedText, splitEthics, ethicsRuleWords } from "@/lib/content/ethics-line";
import { ratioFindings, clearanceFindings, floorFindings } from "@/lib/compose/audit";
import { contentHash } from "@/lib/compose/hash";
import { PALETTES } from "@/lib/compose/__tests__/fixtures";
import type { ContentItem } from "@/lib/data/content";

/*
 * ── L'ÉCRAN DE RELECTURE, SANS SUPABASE ─────────────────────────────────
 *
 * Tout ce qui est testé ici est pur : les variantes sont composées par le vrai
 * moteur, les bandeaux sont une fonction de l'item, et le texte publié d'un
 * payload est une fonction du payload. Aucun client, aucune clef, rien à
 * dépenser.
 *
 * Ce qui n'est PAS testé ici, et qui est dit plutôt que sous-entendu : la
 * lecture de `content_topics` et l'appel à `ethics_scan`. Les deux passent par
 * la RLS, et c'est `supabase/tests/` qui les éprouve depuis un vrai rôle.
 */

const PAYLOAD = {
  nodes: [
    { label: "Notice", gloss: "the first flicker" },
    { label: "Name it", gloss: "out loud if possible" },
    { label: "Let it pass", gloss: "without arguing" },
  ],
};

const BANDS = {
  eyebrow: "A CALMER WAY",
  headline: "Where it lands",
  footer: "@apracticename",
};

function item(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "item-1",
    brand_kit_id: "kit-1",
    archetype: "statement",
    status: "draft",
    title: "Where it lands",
    caption: null,
    rationale: null,
    compose_archetype: null,
    payload: null,
    topic: null,
    alt_text: null,
    tags: [],
    category: null,
    image_slot: null,
    register: null,
    on_image_text: null,
    theme: null,
    month_id: null,
    scheduled_for: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    posted: false,
    posted_at: null,
    channel: null,
    ...overrides,
  };
}

describe("layoutAlternatives", () => {
  it("rend la mise en page servie EN PREMIER", () => {
    /*
     * Une liste où la carte qu'elle regarde n'est pas la première demanderait
     * de la retrouver avant de pouvoir comparer.
     */
    const out = layoutAlternatives({ archetypeKey: "cycle", payload: PAYLOAD, palette: PALETTES[0], ...BANDS });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].archetypeKey).toBe("cycle");
  });

  it("n'en propose jamais plus de trois", () => {
    const out = layoutAlternatives({ archetypeKey: "cycle", payload: PAYLOAD, palette: PALETTES[0], ...BANDS });
    expect(out.length).toBeLessThanOrEqual(MAX_ALTERNATIVES);
  });

  it("ne propose QUE des mises en page qui composent vraiment", () => {
    /*
     * ⚠ MESURÉ SUR LE DOCUMENT, PAS DÉDUIT DU FAIT QUE `render` N'A PAS JETÉ.
     * C'est la même distinction que partout dans ce moteur : « n'a pas levé »
     * est une affirmation sur du code, la conformité est une mesure de sortie.
     */
    const out = layoutAlternatives({ archetypeKey: "cycle", payload: PAYLOAD, palette: PALETTES[0], ...BANDS });
    for (const alternative of out) {
      expect(floorFindings(alternative.svg), alternative.archetypeKey).toEqual([]);
      expect(ratioFindings(alternative.svg), alternative.archetypeKey).toEqual([]);
      expect(clearanceFindings(alternative.svg), alternative.archetypeKey).toEqual([]);
    }
  });

  it("le hash de chaque variante est CELUI du cache de rendu", () => {
    /*
     * C'est la raison pour laquelle choisir une variante déjà rendue ne rend
     * rien : le pipeline trouve ce hash-là dans `rendered_assets` et sert le
     * chemin. Si le calcul divergeait, chaque choix produirait un rendu neuf
     * en silence.
     */
    const out = layoutAlternatives({ archetypeKey: "cycle", payload: PAYLOAD, palette: PALETTES[0], ...BANDS });
    for (const alternative of out) {
      expect(alternative.contentHash).toBe(
        contentHash(alternative.archetypeKey, PAYLOAD, PALETTES[0])
      );
    }
  });

  it("le carrousel n'est jamais une variante : c'est plus de cartes", () => {
    const out = layoutAlternatives({ archetypeKey: "cycle", payload: PAYLOAD, palette: PALETTES[0], ...BANDS });
    expect(out.map((o) => o.archetypeKey)).not.toContain("carousel");
  });

  it("un payload que personne n'accepte rend une liste vide, pas une erreur", () => {
    const out = layoutAlternatives({
      archetypeKey: "cycle",
      payload: { nothing: "recognisable" },
      palette: PALETTES[0],
      ...BANDS,
    });
    expect(out).toEqual([]);
  });

  it("une palette sombre change le hash, donc change la carte", () => {
    const light = layoutAlternatives({ archetypeKey: "cycle", payload: PAYLOAD, palette: PALETTES[0], ...BANDS });
    const dark = layoutAlternatives({ archetypeKey: "cycle", payload: PAYLOAD, palette: PALETTES[2], ...BANDS });
    expect(light[0].contentHash).not.toBe(dark[0].contentHash);
  });
});

describe("cardBands", () => {
  /*
   * ⚠ CE CAS EXIGEAIT QUE LE THÈME PASSE EN PREMIER, ET C'ÉTAIT LE DÉFAUT.
   *
   * Il était écrit avec un thème d'un seul mot — « Rest » — où la règle et son
   * contraire donnent le même résultat. En production un thème dérivé est une
   * PHRASE, et le mois du 2026-09-21b l'a montré : dix cartes portaient le même
   * surtitre de quatorze mots. Le cas ne pouvait pas l'attraper, parce que sa
   * fixture ne ressemblait pas à ses données.
   *
   * Il vérifie donc maintenant l'ordre réel — ce qui est propre à la carte
   * d'abord — avec un thème qui a la forme d'un vrai thème.
   */
  it("un thème-phrase ne devient pas un surtitre de quatorze mots", () => {
    const bands = cardBands(item({
        theme: "returning to work when the body has not agreed to it",
        topic: null,
        title: "Rest is not a reward",
      }), "Elm & Ember Therapy", null);
    expect(bands.eyebrow.split(" ").length).toBeLessThanOrEqual(4);
    expect(bands.eyebrow).toBe("REST REWARD");
  });

  it("deux cartes d'un même thème ne portent pas le même surtitre", () => {
    const theme = "returning to work when the body has not agreed to it";
    const a = cardBands(item({ theme, topic: null, title: "Rest is not a reward" }), "Elm & Ember", null);
    const b = cardBands(item({ theme, topic: null, title: "The Sunday dread starts early" }), "Elm & Ember", null);
    expect(a.eyebrow).not.toBe(b.eyebrow);
  });

  it("le titre reçoit sa majuscule, et un nom propre garde la sienne", () => {
    expect(cardBands(item({ title: "rest is not a reward" }), "X", null).headline).toBe(
      "Rest is not a reward"
    );
    // ⚠ Un mot qui porte DÉJÀ une capitale est un choix, pas un oubli.
    expect(cardBands(item({ title: "eMDR is not hypnosis" }), "X", null).headline).toBe(
      "eMDR is not hypnosis"
    );
  });

  it("le libellé d'angle passe devant le titre", () => {
    const bands = cardBands(item({
        theme: null,
        topic: { id: "t", angle: "invite", angle_label: "A soft invitation", archetype_key: "cycle", timely: false },
      }), "Elm & Ember Therapy", null);
    expect(bands.eyebrow).toBe("A SOFT INVITATION");
  });

  it("à défaut de tout, le nom du cabinet — jamais une formule générique", () => {
    const bands = cardBands(item({ theme: null, topic: null, title: null }), "Elm & Ember Therapy", null);
    expect(bands.eyebrow).toBe("ELM & EMBER THERAPY");
    expect(bands.footer).toBe("Elm & Ember Therapy");
  });

  it("aucun bandeau n'est jamais vide", () => {
    /*
     * ⚠ UNE CHAÎNE VIDE N'A PAS DE HAUTEUR. Le moteur mesure une bande à partir
     * de son texte ; une bande vide produirait une carte dont l'équilibre a été
     * prouvé sur un autre document.
     */
    const bands = cardBands(item({ title: "   ", theme: "  " }), "   ", null);
    expect(bands.eyebrow).not.toBe("");
    expect(bands.headline).not.toBe("");
    expect(bands.footer).not.toBe("");
  });
});

describe("payloadPublishedText", () => {
  it("remonte les libellés ET les gloses du diagramme", () => {
    const text = payloadPublishedText(PAYLOAD);
    expect(text).toContain("Notice");
    expect(text).toContain("the first flicker");
  });

  it("ne remonte PAS les clefs de système", () => {
    /*
     * Scanner `archetype_key` ferait remonter des règles sur des mots que
     * personne ne lira jamais sur une carte.
     */
    const text = payloadPublishedText({
      cards: [{ archetype_key: "single_statement", payload: { statement: "One thing" } }],
    });
    expect(text).toContain("One thing");
    expect(text).not.toContain("single_statement");
  });

  it("descend dans les tableaux imbriqués", () => {
    expect(payloadPublishedText({ lines: ["Evenings", "Telehealth"] })).toEqual([
      "Evenings",
      "Telehealth",
    ]);
  });
});

describe("la ligne déontologique", () => {
  it("sépare ce qui bloque de ce qui prévient", () => {
    const line = splitEthics([
      { rule_id: "guarantee", severity: "block", excerpt: "guaranteed" },
      { rule_id: "award_winning", severity: "warn", excerpt: "award-winning" },
    ]);
    expect(line.blocking.map((b) => b.rule_id)).toEqual(["guarantee"]);
    expect(line.warnings.map((w) => w.rule_id)).toEqual(["award_winning"]);
  });

  it("met chaque règle connue en mots, et ne laisse pas une inconnue sans mots", () => {
    expect(ethicsRuleWords("clients_say")).toBe("what clients say");
    /*
     * ⚠ LE REPLI COMPTE AUTANT QUE LA TABLE. La production porte deux motifs
     * que cette branche n'a pas (voir FOLLOWUP.md F1, n°13) : un vingtième
     * motif doit arriver à l'écran dégradé, pas muet.
     */
    expect(ethicsRuleWords("a_rule_added_later")).toBe("a rule added later");
  });
});
