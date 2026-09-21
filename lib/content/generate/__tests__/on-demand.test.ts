import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { validateCopy, type BrandContext } from "@/lib/content/generate/copy-batch";
import { budgetErrors } from "@/lib/compose/budget";
import { render, CompositionError } from "@/lib/compose/engine";
import { BudgetExceededError } from "@/lib/compose/budget";
import { ARCHETYPES } from "@/lib/compose/archetypes/index";
import {
  CAROUSEL_ARCHETYPE,
  FREE_IDEA_ARCHETYPE,
  archetypeForRequest,
  runOnDemandWrite,
  toTopicRequest,
  writeAction,
} from "@/lib/content/generate/on-demand";
import { carouselSlides } from "@/lib/content/slides";
import { cardPalette } from "@/lib/compose/palette";

/*
 * ── « WRITE IT », ÉPROUVÉ SANS APPELER PERSONNE ─────────────────────────
 *
 * ⚠ AUCUN APPEL RÉSEAU, ET AUCUNE CLEF. Le port est injecté (`WriteOnePort`),
 * donc le modèle est une fonction qui rend ce qu'on lui dit de rendre. Ce
 * n'est PAS une fixture de contenu : le texte des exemples ci-dessous ne
 * prétend pas montrer ce qu'un vrai modèle écrirait, il sert à faire passer
 * ou échouer une règle précise.
 */

const BRAND: BrandContext = {
  practiceName: "Still Water Therapy",
  voice: "warm, plain, unhurried",
  offLimits: "",
  ethicsRules: [
    {
      id: "promised_outcome",
      short_label: "a promised outcome",
      description: "Never promise a result, a cure, or a timeline.",
    },
  ],
};

/** Une direction de marque complète : `cardPalette` lit les cinq couleurs. */
const DIRECTION = {
  primary: "#2B2724",
  secondary: "#7A6A56",
  light: "#EFE9DF",
  dark: "#1C1A17",
  paper: "#F7F3EC",
};

/** Un port qui rend toujours la même sortie, et qui COMPTE ses appels. */
function portReturning(...bodies: string[]) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    create: async () => {
      const body = bodies[Math.min(calls, bodies.length - 1)];
      calls += 1;
      return {
        content: [{ type: "text", text: body }],
        usage: { input_tokens: 10, output_tokens: 20 },
      } as unknown as Anthropic.Message;
    },
  };
}

const STATEMENT = JSON.stringify({
  payload: { statement: "Rest is not a reward you earn after everything else is done" },
  caption: "A short caption that says the same thing at more length, plainly.",
  alt_text: "A card with a single sentence on it.",
  rationale: "Because rest keeps coming up.",
});

describe("une idée libre et un sujet suggéré prennent le MÊME chemin", () => {
  it("un sujet suggéré garde son archétype ; une idée libre tombe sur la déclaration", () => {
    const topic = {
      id: "t1",
      title: "Why rest feels hard",
      hook: "A hook",
      angle: "normalise",
      angle_label: "Naming it",
      archetype_key: "cycle",
      timely: false,
      rationale: null,
    };
    expect(archetypeForRequest({ topic, format: "single" })).toBe("cycle");
    expect(archetypeForRequest({ topic: null, format: "single" })).toBe(FREE_IDEA_ARCHETYPE);
  });

  it("le format carrousel l'emporte sur l'archétype du sujet — c'est un nombre de cartes", () => {
    const topic = {
      id: "t1",
      title: "T",
      hook: "H",
      angle: "educate",
      angle_label: null,
      archetype_key: "cycle",
      timely: false,
      rationale: null,
    };
    expect(archetypeForRequest({ topic, format: "carousel" })).toBe(CAROUSEL_ARCHETYPE);
  });

  it("ce qu'elle a déjà écrit entre dans la demande au lieu d'être jeté", () => {
    const req = toTopicRequest({
      topic: null,
      idea: "why rest feels hard after going back to work",
      format: "single",
      checkin: "",
      existingTitle: "Going back",
      existingCaption: "Three lines she had started",
    });
    expect(req.title).toContain("why rest feels hard");
    expect(req.hook).toContain("Going back");
    expect(req.hook).toContain("Three lines she had started");
    // ⚠ Une intention DU CATALOGUE, jamais un mot inventé pour l'occasion.
    expect(req.intent).toBe("educate");
  });
});

describe("⚠ DOUBLE CLIC : UNE SEULE ÉCRITURE, UN SEUL CRÉDIT", () => {
  /*
   * L'idempotence elle-même vit en base — une clef unique sur (post, clef
   * d'intention), éprouvée dans `supabase/tests/20260921120000_on_demand.test.sql`.
   * Ce que ce bloc éprouve est la moitié TypeScript : que la réponse de la
   * base décide s'il y a un appel payant, et que le cas ambigu ne dépense pas.
   */
  it("une réservation fraîche génère", () => {
    expect(writeAction({ state: "reserved" })).toBe("generate");
  });

  it("la MÊME intention rejouée ne génère pas — donc ne coûte rien", () => {
    expect(writeAction({ state: "written" })).toBe("already_written");
  });

  it("et une ligne relâchée ne génère pas non plus : en cas de doute, on ne dépense pas", () => {
    expect(writeAction({ state: "released" })).toBe("not_reserved");
  });

  it("les trois états sont couverts, sans défaut muet", () => {
    /*
     * Sans cette énumération, un quatrième état ajouté en base tomberait dans
     * une branche « génère » implicite — c'est-à-dire dépenserait.
     */
    const states = ["reserved", "written", "released"] as const;
    const seen = new Set(states.map((state) => writeAction({ state })));
    expect(seen).toEqual(new Set(["generate", "already_written", "not_reserved"]));
  });

  it("un seul « Write it » n'appelle le modèle qu'une fois quand la sortie est valide", async () => {
    const port = portReturning(STATEMENT);
    const result = await runOnDemandWrite(port, {
      brand: BRAND,
      request: {
        topicId: "free-idea",
        archetypeKey: "single_statement",
        title: "Rest",
        hook: "Rest",
        intent: "educate",
        checkin: "",
      },
    });
    expect(result.ok).toBe(true);
    expect(port.calls).toBe(1);
  });
});

describe("⚠ UNE IDÉE LIBRE NE CONTOURNE PAS LA DÉONTOLOGIE", () => {
  /*
   * ⚠ ET LE VERROU QUI COMPTE EST EN BASE. `content_items_payload_ethics_gate`
   * refuse l'UPDATE, donc un payload qui promet un résultat n'est pas écrit
   * même si tout ce qui précède l'a laissé passer — c'est éprouvé côté SQL.
   *
   * Ce qui est éprouvé ICI est le premier verrou : une idée libre passe par
   * le MÊME préfixe mis en cache, avec les MÊMES règles déontologiques
   * dedans. Un second chemin de génération est ce que ce test interdit.
   */
  it("les règles de la base sont dans le préfixe d'une idée libre", async () => {
    const seen: string[] = [];
    const port = {
      create: async (params: Anthropic.Messages.MessageCreateParamsNonStreaming) => {
        seen.push(JSON.stringify(params.system));
        return {
          content: [{ type: "text", text: STATEMENT }],
          usage: { input_tokens: 1, output_tokens: 1 },
        } as unknown as Anthropic.Message;
      },
    };

    await runOnDemandWrite(port, {
      brand: BRAND,
      request: toTopicRequest({
        topic: null,
        idea: "this work will cure your anxiety in six weeks",
        format: "single",
        checkin: "",
      }),
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("a promised outcome");
    expect(seen[0]).toContain("Never promise a result");
  });

  it("et son idée n'arrive JAMAIS sur la carte sans passer par le modèle", async () => {
    /*
     * La phrase qu'elle tape est un point de départ, pas du texte publié. Si
     * elle traversait telle quelle, une idée non conforme deviendrait une
     * carte que rien n'a relu.
     */
    const port = portReturning(STATEMENT);
    const result = await runOnDemandWrite(port, {
      brand: BRAND,
      request: toTopicRequest({
        topic: null,
        idea: "this work will cure your anxiety in six weeks",
        format: "single",
        checkin: "",
      }),
    });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.payload)).not.toContain("cure your anxiety");
  });
});

describe("⚠ UN CARROUSEL HORS BUDGET : L'ORDRE DE RÉSOLUTION DU MOTEUR", () => {
  const palette = cardPalette("item", DIRECTION, false);

  const card = (statement: string) => ({
    archetype_key: "single_statement",
    payload: { statement },
  });

  const SHORT = "Rest is not a reward you earn after everything else";
  const LONG = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");

  it("1. la FORME d'abord : moins de trois cartes n'est pas un carrousel", () => {
    expect(ARCHETYPES.carousel.parse({ cards: [card(SHORT), card(SHORT)] })).toBeNull();
    // Et un carrousel dans un carrousel n'a pas de plancher de récursion.
    expect(
      ARCHETYPES.carousel.parse({
        cards: [card(SHORT), card(SHORT), { archetype_key: "carousel", payload: {} }],
      })
    ).toBeNull();
  });

  it("2. puis le BUDGET, carte par carte, avec les bornes de CHAQUE archétype", () => {
    /*
     * ⚠ C'EST `budgetErrors` QUI RÉCURSE, pas un second contrôle ajouté à
     * côté. Le chemin de l'erreur nomme la carte fautive, ce qui est la seule
     * façon de savoir laquelle relancer.
     */
    const errors = budgetErrors("carousel", {
      cards: [card(SHORT), card(SHORT), card(LONG)],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe("cards[2].statement");
    expect(errors[0].said).toBe(40);
  });

  it("3. et `render` refuse AVANT de composer quoi que ce soit", () => {
    /*
     * L'ordre importe pour l'argent : le budget est de l'arithmétique sur des
     * mots, la composition mesure des glyphes. Refuser au budget coûte moins
     * et dit mieux ce qui ne va pas.
     */
    let thrown: unknown = null;
    try {
      render({
        archetype: "single_statement",
        payload: { statement: LONG },
        palette,
        eyebrow: "EYEBROW",
        headline: "A headline",
        footer: "Still Water Therapy",
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BudgetExceededError);
    expect(thrown).not.toBeInstanceOf(CompositionError);
  });

  it("4. un carrousel hors budget est REFUSÉ, jamais tronqué pour tenir", () => {
    const refused = carouselSlides({
      archetypeKey: "carousel",
      payload: { cards: [card(SHORT), card(SHORT), card(LONG)] },
      palette,
      eyebrow: "EYEBROW",
      headline: "A headline",
      footer: "Still Water Therapy",
    });
    expect(refused.kind).toBe("refused");
    if (refused.kind !== "refused") return;
    // Le message nomme la carte, et il vient du moteur.
    expect(refused.message).toContain("cards[2].statement");
  });

  it("et `validateCopy` applique exactement le même ordre sur une sortie de modèle", () => {
    const tooLong = JSON.stringify({
      payload: { cards: [card(SHORT), card(SHORT), card(LONG)] },
      caption: "A caption.",
      alt_text: "Alt text.",
    });
    const result = validateCopy("carousel", tooLong);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("over_budget");
    expect(result.budget?.[0].path).toBe("cards[2].statement");
  });
});

describe("un carrousel qui tient se rend carte par carte", () => {
  const palette = cardPalette("item", DIRECTION, false);
  const card = (statement: string) => ({
    archetype_key: "single_statement",
    payload: { statement },
  });

  const slides = carouselSlides({
    archetypeKey: "carousel",
    payload: {
      cards: [
        card("Rest is not a reward you earn after everything else"),
        card("Going back to work asks something of the body too"),
        card("Tiredness after a return is not a sign of failure"),
      ],
    },
    palette,
    eyebrow: "GOING BACK",
    headline: "A headline",
    footer: "Still Water Therapy",
  });

  it("il y en a autant que de cartes, numérotées à partir de un", () => {
    expect(slides.kind).toBe("slides");
    if (slides.kind !== "slides") return;
    expect(slides.slides.map((s) => s.number)).toEqual([1, 2, 3]);
  });

  it("chaque carte porte son rang, écrit par le moteur et non par l'écran", () => {
    if (slides.kind !== "slides") return;
    expect(slides.slides[0].svg).toContain("GOING BACK 1/3");
    expect(slides.slides[2].svg).toContain("GOING BACK 3/3");
  });

  it("et chacune est une carte complète, au cadre du produit", () => {
    if (slides.kind !== "slides") return;
    for (const slide of slides.slides) {
      expect(slide.svg).toContain('width="1080"');
      expect(slide.svg).toContain('height="1350"');
    }
  });

  it("un post qui n'est pas un carrousel le dit, plutôt que de rendre une liste vide", () => {
    expect(carouselSlides(null).kind).toBe("not_a_carousel");
    expect(
      carouselSlides({
        archetypeKey: "single_statement",
        payload: { statement: "Rest is not a reward you earn" },
        palette,
        eyebrow: "E",
        headline: "H",
        footer: "F",
      }).kind
    ).toBe("not_a_carousel");
  });
});
