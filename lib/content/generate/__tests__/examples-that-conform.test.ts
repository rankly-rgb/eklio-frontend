import { describe, expect, it } from "vitest";
import EXAMPLES from "@/lib/content/generate/fixtures/conforming-examples.json";
import {
  cachedPrefix, MODEL_WRITTEN_ARCHETYPES, CARD_LINE_MAX, examplesOn,
} from "@/lib/content/generate/copy-batch";
import { checkMonth, type PostUnderCheck } from "@/lib/content/month-checks";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ── ⚠ LE MODÈLE N'A JAMAIS VU UN BON POST ──────────────────────────────
 *
 * Le préfixe ne portait que des RÈGLES, et une règle dit ce qu'il ne faut pas
 * faire. La notation indépendante met l'écriture à 1,6 sur 5, trois planches
 * de suite, et les sept contrôles de F26 ne l'ont pas déplacée : ils ont
 * supprimé les sept défauts qu'ils nomment, exactement.
 *
 * ⚠ CE FICHIER EXISTE POUR QUE LES EXEMPLES NE POURRISSENT PAS. Un exemple
 * qui cesserait de passer les contrôles enseignerait au modèle le défaut que
 * le contrôle refuse — et ce serait invisible : le mois sortirait, refusé,
 * sans que rien ne désigne le préfixe.
 */
type Example = { topic: string; intent: string; cardLine: string; payload: unknown };
const examples = EXAMPLES as Record<string, Example[]>;

const DIRECTION: DirectionPalette = {
  paper: "#FAF6EE", light: "#F4EEE3", secondary: "#C08A3E", primary: "#B4674A", dark: "#2B2A27",
};

const BRAND = {
  practiceName: "Willow Clinic",
  voice: "warm, plain",
  offLimits: "",
  ethicsRules: [{ id: "a", short_label: "no promises", description: "never guarantee an outcome" }],
};

describe("chaque exemple passe ce qu'on demande au modèle", () => {
  for (const [archetype, list] of Object.entries(examples)) {
    for (const example of list) {
      it(`${archetype} — « ${example.cardLine} »`, () => {
        const post: PostUnderCheck = {
          archetype, title: example.topic, cardLine: example.cardLine, payload: example.payload,
        };
        const findings = checkMonth({ posts: [post], direction: DIRECTION, modalities: ["EMDR"] });
        expect(findings.map((f) => `${f.check} — ${f.detail.slice(0, 80)}`)).toEqual([]);
        expect(example.cardLine.length).toBeLessThanOrEqual(CARD_LINE_MAX);
      });
    }
  }
});

describe("ce que la sélection garantit", () => {
  /*
   * ⚠ TROIS À CINQ PAR ARCHÉTYPE. Un seul exemple est un gabarit : le modèle
   * le recopie. Le carrousel s'arrête à trois parce qu'il empile trois à six
   * payloads et que le préfixe est mis en cache à chaque appel du mois.
   */
  it("trois à cinq exemples par archétype écrit par le modèle", () => {
    for (const archetype of MODEL_WRITTEN_ARCHETYPES) {
      expect(examples[archetype]?.length, archetype).toBeGreaterThanOrEqual(3);
      expect(examples[archetype]?.length, archetype).toBeLessThanOrEqual(5);
    }
  });

  /*
   * ⚠ LA CARTE PRATICIENNE N'EN A PAS, ET C'EST VOULU. Son payload vient du
   * brief — modalité, ville, disponibilité — et lui montrer des exemples d'un
   * champ qu'il ne remplit pas lui apprendrait à le remplir.
   */
  it("aucun exemple pour un archétype que le modèle n'écrit pas", () => {
    for (const archetype of Object.keys(examples)) {
      expect(MODEL_WRITTEN_ARCHETYPES, archetype).toContain(archetype);
    }
  });

  /*
   * ⚠ QUATRE VARIATIONS D'UNE IDÉE ENSEIGNENT UNE IDÉE. Les intentions du
   * catalogue sont cinq ; les exemples d'un archétype en couvrent au moins
   * trois, sinon ils apprennent un angle et pas une forme.
   */
  it("les exemples d'un archétype ne disent pas la même chose", () => {
    for (const [archetype, list] of Object.entries(examples)) {
      const intents = new Set(list.map((e) => e.intent));
      expect(intents.size, archetype).toBeGreaterThanOrEqual(3);
      const openings = new Set(list.map((e) => e.cardLine.toLowerCase().split(/\s+/).slice(0, 2).join(" ")));
      expect(openings.size, archetype).toBe(list.length);
    }
  });

  /* ⚠ Et aucune des formules que F29 a nommées. */
  it("aucune formule relevée par la notation", () => {
    const blob = JSON.stringify(examples).toLowerCase();
    for (const formula of ["body says no", "is not failure"]) {
      expect(blob, formula).not.toContain(formula);
    }
  });
});

describe("le préfixe les porte", () => {
  it("chaque archétype écrit par le modèle reçoit les siens", () => {
    for (const archetype of MODEL_WRITTEN_ARCHETYPES) {
      const text = cachedPrefix(BRAND, archetype)[0].text;
      expect(text, archetype).toContain("EXAMPLES —");
      for (const example of examples[archetype]) {
        expect(text, `${archetype} / ${example.cardLine}`).toContain(example.cardLine);
        expect(text, `${archetype} / ${example.topic}`).toContain(example.topic);
      }
    }
  });

  /*
   * ⚠ ILS SONT DANS LA PARTIE MISE EN CACHE, ET C'EST TOUT L'INTÉRÊT. Placés
   * dans la partie variable, quarante exemples se paieraient plein tarif à
   * chacun des cinquante-quatre appels d'un mois ; dans le préfixe ils se
   * paient une fois et se relisent à un dixième.
   */
  it("ils sont avant le dernier `cache_control`", () => {
    const blocks = cachedPrefix(BRAND, "carousel");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[0].text).toContain("EXAMPLES —");
  });

  /*
   * ⚠ ET ON LUI DIT DE NE PAS LES RECOPIER. Un mois qui reprend les mots d'un
   * exemple est un mois de doublons, et `checkDuplicateTitles` le refuse —
   * après l'avoir payé.
   */
  it("il est dit de ne pas les recopier", () => {
    expect(cachedPrefix(BRAND, "cycle")[0].text).toContain("DO NOT REUSE THEIR WORDS");
  });

  /*
   * ⚠ ET ON PEUT LES RETIRER, ce qui est la seule façon de mesurer ce qu'ils
   * apportent. Trois changements dans la même session — le modèle, les
   * exemples, la révision — et une note qui monte ne dit pas lequel a payé.
   */
  it("`CONTENT_EXAMPLES=off` rend le préfixe d'avant", () => {
    expect(examplesOn()).toBe(true);
    process.env.CONTENT_EXAMPLES = "off";
    try {
      expect(examplesOn()).toBe(false);
      const text = cachedPrefix(BRAND, "cycle")[0].text;
      expect(text).not.toContain("EXAMPLES —");
      expect(text).toContain("ADVERTISING ETHICS");
    } finally {
      delete process.env.CONTENT_EXAMPLES;
    }
  });
});
