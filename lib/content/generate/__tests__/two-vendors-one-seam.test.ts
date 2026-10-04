import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { payloadSchema } from "@/lib/compose/archetypes/schema";
import {
  OPENAI_BATCH,
  OPENAI_COPY_CANDIDATES,
  PRICE_SOURCE,
  anthropicBody,
  anthropicUsage,
  copyEnvelopeFormat,
  copyProvider,
  openAiBatchLine,
  openAiBody,
  openAiText,
  openAiUsage,
  priceRefusal,
  PRICE_VERIFIED_ON,
  OPENAI_COPY_MODEL,
  priceVerified,
  type CopyCall,
} from "@/lib/content/generate/provider";

/*
 * ── ⚠ AUCUN APPEL RÉSEAU N'A PU ÊTRE FAIT POUR ÉCRIRE CE FICHIER ────────
 *
 * Ni chez OpenAI — aucune clef dans l'environnement, et tous ses domaines
 * refusés par la politique d'egress — ni chez Anthropic, dont le compte était
 * sous limite d'usage jusqu'au 2026-10-01. Les noms de champs viennent des
 * déclarations de `openai@7.23.0`, générées depuis la spécification de l'API.
 *
 * Ce fichier est donc tout ce qui peut être prouvé aujourd'hui, et ce n'est pas
 * rien : la traduction est pure, et une traduction pure se vérifie entièrement
 * hors ligne. Ce qu'il ne prouve pas, il le dit.
 */

const CALL: CopyCall = {
  model: "gpt-5.6-terra",
  prefix: "PREFIX that is long and stable",
  variable: "the one topic that changes",
  maxTokens: 2000,
  effort: "medium",
  archetypeKey: "surface_and_beneath",
};

afterEach(() => {
  delete process.env.CONTENT_COPY_PROVIDER;
});

describe("le fournisseur se choisit par l'environnement", () => {
  it("Anthropic par défaut", () => {
    expect(copyProvider()).toBe("anthropic");
  });

  it("OpenAI quand on le demande", () => {
    process.env.CONTENT_COPY_PROVIDER = "openai";
    expect(copyProvider()).toBe("openai");
  });

  /*
   * ⚠ UNE VALEUR INCONNUE NE BASCULE PAS. Une faute de frappe dans une variable
   * d'environnement ne doit pas changer de fournisseur en silence.
   */
  it.each(["OpenAI", "gpt", "true", ""])("« %s » ne bascule pas", (value) => {
    process.env.CONTENT_COPY_PROVIDER = value;
    expect(copyProvider()).toBe("anthropic");
  });
});

describe("les deux traductions portent les mêmes cinq choses", () => {
  it("Anthropic : préfixe caché dans system, variable dans messages", () => {
    const body = anthropicBody(CALL);
    expect(body.model).toBe(CALL.model);
    expect(body.max_tokens).toBe(CALL.maxTokens);
    const system = body.system as Array<{ text: string; cache_control?: unknown }>;
    expect(system[0].text).toBe(CALL.prefix);
    expect(system[0].cache_control, "le préfixe n'est plus marqué pour le cache").toEqual({
      type: "ephemeral",
    });
    expect(body.messages[0].content).toBe(CALL.variable);
  });

  it("OpenAI : préfixe dans instructions, variable dans input", () => {
    const body = openAiBody(CALL);
    expect(body.model).toBe(CALL.model);
    expect(body.instructions).toBe(CALL.prefix);
    expect(body.input).toBe(CALL.variable);
    expect(body.max_output_tokens).toBe(CALL.maxTokens);
    expect(body.reasoning).toEqual({ effort: "medium" });
  });

  /*
   * ⚠ LA CLEF DE CACHE EST L'ARCHÉTYPE, ET C'EST STRUCTUREL. Le SDK déclare
   * `text_format_changed` et `reasoning_effort_changed` parmi les motifs
   * d'invalidation : deux archétypes sous une même clef reconstruiraient le
   * cache à chaque appel, et la remise disparaîtrait sans que rien ne le dise.
   */
  it("OpenAI : une entrée de cache par archétype, retenue 24 h", () => {
    expect(openAiBody(CALL).prompt_cache_key).toBe("eklio-copy-surface_and_beneath");
    expect(openAiBody({ ...CALL, archetypeKey: "cycle" }).prompt_cache_key).toBe("eklio-copy-cycle");
    expect(openAiBody(CALL).prompt_cache_retention).toBe("24h");
  });

  /* ⚠ Des textes publiés sous la licence d'une clinicienne ne se stockent pas
   * chez le fournisseur. */
  it("OpenAI : la réponse n'est pas conservée côté fournisseur", () => {
    expect(openAiBody(CALL).store).toBe(false);
  });
});

describe("l'enveloppe ET le payload sont contraints, en strict", () => {
  const format = copyEnvelopeFormat("quadrant_model") as {
    type: string; name: string; strict: boolean;
    schema: { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
  };

  it("les cinq champs de l'enveloppe sont exigés", () => {
    expect(format.type).toBe("json_schema");
    expect(format.schema.required.sort()).toEqual(["alt_text", "caption", "card_line", "payload", "rationale"]);
    expect(format.schema.additionalProperties).toBe(false);
  });

  /*
   * ⚠ `strict: true` DEPUIS LE 2026-10-04, ET LA RAISON DE `false` EST LEVÉE.
   * Elle était l'absence de schéma machine des archétypes ; il vit dans
   * `lib/compose/archetypes/schema.ts`, tenu aligné sur les `parse()` par
   * `strict-schema-follows-parse.test.ts`.
   */
  it("le payload est le schéma de l'archétype, et le drapeau strict est à true", () => {
    expect(format.strict).toBe(true);
    expect(format.schema.properties.payload).toEqual(payloadSchema("quadrant_model"));
  });

  it("le corps OpenAI porte le schéma de SON archétype", () => {
    const body = openAiBody(CALL) as { text: { format: { schema: { properties: { payload: unknown } } } } };
    expect(body.text.format.schema.properties.payload).toEqual(payloadSchema(CALL.archetypeKey));
  });
});

describe("la comptabilité des tokens est la même des deux côtés", () => {
  it("Anthropic", () => {
    expect(
      anthropicUsage({
        input_tokens: 10, output_tokens: 20,
        cache_read_input_tokens: 300, cache_creation_input_tokens: 4,
      })
    ).toEqual({ input: 10, output: 20, cacheRead: 300, cacheWrite: 4 });
  });

  it("OpenAI", () => {
    expect(
      openAiUsage({
        input_tokens: 10, output_tokens: 20,
        input_tokens_details: { cached_tokens: 300, cache_write_tokens: 4 },
      })
    ).toEqual({ input: 10, output: 20, cacheRead: 300, cacheWrite: 4 });
  });

  /* ⚠ Un usage absent rend des zéros, jamais `undefined` : le coût se calcule
   * dessus, et `NaN` traverserait tout le registre sans lever. */
  it.each([null, undefined, {}])("un usage manquant rend des zéros (%s)", (usage) => {
    expect(openAiUsage(usage as never)).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    expect(anthropicUsage(usage as never)).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });
});

describe("le texte se lit par la commodité, et par la forme canonique sinon", () => {
  it("output_text quand il est là", () => {
    expect(openAiText({ output_text: '{"ok":1}' })).toBe('{"ok":1}');
  });

  /*
   * ⚠ ET PAR `output` SINON. Dépendre du seul champ de commodité ferait
   * dépendre le pipeline d'un raccourci que la version suivante peut cesser de
   * remplir ; la liste est la forme que la spécification décrit.
   */
  it("la liste output quand la commodité est vide", () => {
    expect(
      openAiText({
        output_text: "",
        output: [{ content: [{ type: "output_text", text: '{"a":' }, { type: "output_text", text: "1}" }] }],
      })
    ).toBe('{"a":1}');
  });

  it("rien du tout rend une chaîne vide, pas une exception", () => {
    expect(openAiText(null)).toBe("");
    expect(openAiText({})).toBe("");
    expect(openAiText({ output: [{ content: [{ type: "reasoning", text: "x" }] }] })).toBe("");
  });
});

describe("le lot OpenAI, et ce qu'il impose de différent", () => {
  it("il passe par /v1/responses, fenêtre 24 h, fichier de purpose batch", () => {
    expect(OPENAI_BATCH.endpoint).toBe("/v1/responses");
    /*
     * ⚠ SEULE VALEUR DÉCLARÉE. `BatchCreateParams.completion_window` n'accepte
     * que '24h' dans openai@7.23.0 — le harnais abandonne à 90 minutes, et cette
     * borne est la NÔTRE : un lot abandonné peut continuer à être facturé.
     */
    expect(OPENAI_BATCH.completionWindow).toBe("24h");
    expect(OPENAI_BATCH.filesPurpose).toBe("batch");
  });

  it("une ligne de JSONL porte son custom_id, sa méthode et son corps", () => {
    const line = openAiBatchLine("topic-42", CALL);
    expect(line.custom_id).toBe("topic-42");
    expect(line.method).toBe("POST");
    expect(line.url).toBe("/v1/responses");
    expect((line.body as { instructions: string }).instructions).toBe(CALL.prefix);
  });
});

describe("un tarif non lu ne peut pas produire un coût", () => {
  it("les modèles Anthropic ont un tarif daté", () => {
    for (const model of ["claude-sonnet-5", "claude-haiku-4-5-20251001"]) {
      expect(priceVerified(model), model).toBe(true);
      expect(priceRefusal(model)).toBeNull();
    }
  });

  /*
   * ⚠ UN SEUL DES DEUX CANDIDATS EST VÉRIFIÉ, ET C'EST LE RETENU. Le tarif de
   * `gpt-5.6-terra` a été lu à la source le 2026-10-04 ; celui de `gpt-5.6-luna`
   * a été transmis en même temps mais n'est PAS inscrit — un tarif inscrit est un
   * tarif qu'un coût peut employer. Ce test tombe le jour où l'on inscrit luna
   * sans l'avoir retenu.
   */
  it("le modèle retenu est chiffrable, et daté", () => {
    expect(OPENAI_COPY_MODEL).toBe(OPENAI_COPY_CANDIDATES.quality);
    expect(priceVerified(OPENAI_COPY_MODEL)).toBe(true);
    expect(priceRefusal(OPENAI_COPY_MODEL)).toBeNull();
    expect(PRICE_VERIFIED_ON[OPENAI_COPY_MODEL]).toBe("2026-10-04");
  });

  it("le candidat non retenu refuse toujours de se chiffrer", () => {
    const model = OPENAI_COPY_CANDIDATES.economy;
    expect(priceVerified(model)).toBe(false);
    const refusal = priceRefusal(model);
    expect(refusal).toContain(model);
    expect(refusal).toContain(PRICE_SOURCE);
  });

  it("les deux candidats sont des paliers distincts de la même famille", () => {
    const { economy, quality } = OPENAI_COPY_CANDIDATES;
    expect(economy).not.toBe(quality);
    for (const m of [economy, quality]) expect(m).toMatch(/^gpt-5\.6-/);
  });
});

/*
 * ── ⚠ UN SEUL ASSEMBLEUR, SINON LA BASCULE EST À MOITIÉ FAITE ───────────
 *
 * Le mois (par lot) et « Write it » (synchrone) construisaient les mêmes
 * paramètres à deux endroits. L'en-tête de `write-one.ts` promettait « même
 * préfixe, même partie variable, même validateur » — tenu par convention. Une
 * bascule de fournisseur faite d'un seul côté aurait laissé la moitié des posts
 * chez l'ancien, et le rapport de coût aurait mélangé les deux.
 */
describe("un seul endroit assemble un appel de rédaction", () => {
  const sources = ["lib/content/generate/copy-batch.ts", "lib/content/generate/write-one.ts"];

  it("aucun appelant ne construit les paramètres à la main", () => {
    const readFile = (p: string) => readFileSync(p, "utf8");
    for (const path of sources) {
      const src = readFile(path);
      const handMade = [...src.matchAll(/max_tokens:\s*\d+/g)];
      expect(
        handMade.map((m) => m[0]),
        `${path} fixe max_tokens en littéral au lieu de passer par copyCallFor`
      ).toEqual([]);
    }
  });

  it("les deux chemins passent par la traduction du fournisseur", () => {
    for (const path of sources) {
      expect(readFileSync(path, "utf8"), `${path} n'appelle pas anthropicBody`).toContain(
        "anthropicBody("
      );
    }
  });

  /*
   * ⚠ ET LE PRÉFIXE N'EST ÉCRIT QU'UNE FOIS. `cachedPrefix` emballe désormais
   * `cachedPrefixText` ; deux constructions du texte voudraient dire deux jeux
   * de règles déontologiques, dont l'un périmé sans que rien ne le dise.
   */
  it("le texte du préfixe a une seule source", () => {
    const src = readFileSync("lib/content/generate/copy-batch.ts", "utf8");
    expect([...src.matchAll(/export function cachedPrefixText\(/g)]).toHaveLength(1);
    const wrapper = src.slice(src.indexOf("export function cachedPrefix("), src.indexOf("export function cachedPrefixText("));
    expect(wrapper).toContain("cachedPrefixText(brand, archetypeKey)");
  });
});
