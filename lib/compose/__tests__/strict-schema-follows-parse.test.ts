import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ARCHETYPES, ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import {
  CAROUSEL_INNER,
  LETTERED_ACRONYMS,
  PAYLOAD_SCHEMAS,
  payloadSchema,
  schemaAccepts,
  strictViolations,
  type JsonSchema,
} from "@/lib/compose/archetypes/schema";
import { archetypeInstruction, CAROUSEL_INNER_ARCHETYPES } from "@/lib/content/generate/copy-batch";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE SCHÉMA STRICT SUIT `parse()` — SINON IL DEVIENT LA SECONDE SOURCE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `provider.ts` refusait `strict: true` parce qu'un schéma écrit à la main serait
 * « une seconde source de vérité pour la forme des cartes — et celle des deux
 * qu'on oublie de mettre à jour est celle qui décide ». Le schéma existe
 * désormais ; ce fichier est ce qui l'empêche de devenir cette seconde source.
 *
 * Trois obligations, chacune avec son test :
 *
 *   1. ce que le schéma accepte, `parse()` l'accepte — sinon le modèle serait
 *      CONTRAINT à écrire des payloads que le moteur refuse ;
 *   2. le schéma demande ce que la consigne demande — les comptes écrits dans
 *      `SHAPES` et ceux d'ici ne divergent pas ;
 *   3. le schéma respecte les règles du mode strict — sinon chaque appel tombe
 *      en 400, et c'est un appel payé à découvrir.
 */

const ALL = [...Object.keys(PAYLOAD_SCHEMAS), "carousel"];

/** Une instance minimale qu'un schéma accepte, aux bornes qu'on lui donne. */
function instance(schema: JsonSchema, at: "min" | "max", path = ""): unknown {
  if (Array.isArray(schema.anyOf)) return instance((schema.anyOf as JsonSchema[])[0], at, path);
  if (Array.isArray(schema.enum)) return (schema.enum as unknown[])[at === "min" ? 0 : schema.enum.length - 1];
  switch (schema.type) {
    case "string":
      return `Word${path.length % 7} here`;
    case "array": {
      const n = (at === "min" ? schema.minItems : schema.maxItems) as number;
      return Array.from({ length: n }, (_, i) => instance(schema.items as JsonSchema, at, `${path}[${i}]`));
    }
    case "object":
      return Object.fromEntries(
        Object.entries(schema.properties as Record<string, JsonSchema>).map(([k, v]) => [k, instance(v, at, `${path}.${k}`)])
      );
    default:
      throw new Error(`instance: ${String(schema.type)}`);
  }
}

/**
 * ⚠ L'ACRONYME EST LA SEULE CONTRAINTE QU'UN SCHÉMA NE DIT PAS : chaque libellé
 * commence par la lettre de son rang. L'instance la respecte, sinon `parse()`
 * la refuserait pour une raison qui n'est pas celle qu'on éprouve.
 */
function conforming(key: string, at: "min" | "max"): unknown {
  const value = instance(payloadSchema(key), at) as Record<string, unknown>;
  if (key === "lettered_technique") {
    const acronym = value.acronym as string;
    value.items = (value.items as Array<{ label: string; gloss: string }>).map((item, i) => ({
      ...item,
      label: `${acronym[i]}${item.label.slice(1)}`,
    }));
  }
  if (key === "carousel") {
    /* Trois panneaux distincts, tous dans la première branche. */
    value.cards = (value.cards as Array<Record<string, unknown>>).map((c) => ({
      ...c, payload: conforming(c.archetype_key as string, at),
    }));
  }
  return value;
}

describe("1. ce que le schéma accepte, parse() l'accepte", () => {
  it("les onze archétypes ont un schéma, et pas un de plus", () => {
    expect(ALL.sort()).toEqual([...ARCHETYPE_KEYS].sort());
  });

  it.each(ALL)("« %s » aux bornes basse et haute", (key: string) => {
    for (const at of ["min", "max"] as const) {
      const value = conforming(key, at);
      expect(schemaAccepts(payloadSchema(key), value), `${key} ${at} : le schéma refuse sa propre instance`).toBe(true);
      expect(ARCHETYPES[key].parse(value), `${key} ${at} : parse() refuse ce que le schéma impose`).not.toBeNull();
    }
  });

  /*
   * ⚠ ET CHAQUE BRANCHE DU CARROUSEL, pas seulement la première. Un panneau dont
   * la branche serait fausse ne se verrait qu'au jour où le modèle la choisit.
   */
  it.each(CAROUSEL_INNER)("un panneau de carrousel « %s » passe les deux", (inner: string) => {
    const panel = { archetype_key: inner, payload: conforming(inner, "min") };
    const carousel = { cards: [panel, panel, panel] };
    expect(schemaAccepts(payloadSchema("carousel"), carousel)).toBe(true);
    expect(ARCHETYPES.carousel.parse(carousel)).not.toBeNull();
  });

  it("un panneau dont la clef et le payload ne vont pas ensemble est refusé", () => {
    const wrong = { archetype_key: "cycle", payload: conforming("single_statement", "min") };
    expect(schemaAccepts(payloadSchema("carousel"), { cards: [wrong, wrong, wrong] })).toBe(false);
  });

  it.each(ALL)("« %s » : un champ retiré est refusé par les deux", (key: string) => {
    const value = conforming(key, "min") as Record<string, unknown>;
    for (const field of Object.keys(value)) {
      const without = { ...value };
      delete without[field];
      expect(schemaAccepts(payloadSchema(key), without), `${key} sans ${field}`).toBe(false);
      expect(ARCHETYPES[key].parse(without), `${key} sans ${field} : parse() l'accepte`).toBeNull();
    }
  });

  it.each(ALL)("« %s » : un champ en trop est refusé par le schéma", (key: string) => {
    const value = { ...(conforming(key, "min") as Record<string, unknown>), extra: "x" };
    expect(schemaAccepts(payloadSchema(key), value)).toBe(false);
  });
});

describe("2. le schéma demande ce que la consigne demande", () => {
  /*
   * ⚠ LES COMPTES DE `SHAPES` SONT DE LA PROSE, ET C'EST ELLE QUE LE MODÈLE LIT.
   * Un schéma à quatre items sous une consigne qui en demande trois mettrait le
   * modèle devant deux ordres contraires — et la sortie stricte gagnerait sans
   * qu'on le voie.
   */
  const fixed: Array<[string, string, number]> = [];
  for (const [key, schema] of Object.entries(PAYLOAD_SCHEMAS)) {
    for (const [field, sub] of Object.entries(schema.properties as Record<string, JsonSchema>)) {
      if (sub.type === "array" && sub.minItems === sub.maxItems) fixed.push([key, field, sub.minItems as number]);
    }
  }

  it.each(fixed)("« %s.%s » : %i entrées, et la consigne dit le même nombre", (key: string, field: string, n: number) => {
    const text = archetypeInstruction(key);
    const shape = text.split("\n")[1];
    const said = new RegExp(`"${field}": \\[(?:EXACTLY )?${n} x|"${field}": \\[ONE PER LETTER`).test(shape) ||
      (key === "comparison_pair" && field === "right" && /THE SAME NUMBER/.test(shape));
    expect(said, `${key}.${field} : le schéma dit ${n}, la consigne dit « ${shape} »`).toBe(true);
  });

  it("les acronymes du schéma sont ceux de la consigne, dans le même ordre", () => {
    const text = archetypeInstruction("lettered_technique");
    const listed = /EXACTLY one of: ([A-Z, ]+)"/.exec(text)?.[1].split(", ");
    expect(listed).toEqual([...LETTERED_ACRONYMS]);
  });

  it("les panneaux possibles d'un carrousel sont ceux de la consigne", () => {
    expect([...CAROUSEL_INNER].sort()).toEqual([...CAROUSEL_INNER_ARCHETYPES].sort());
  });

  it("le carrousel demande trois à six panneaux, comme la consigne", () => {
    const cards = (payloadSchema("carousel").properties as Record<string, JsonSchema>).cards;
    expect([cards.minItems, cards.maxItems]).toEqual([3, 6]);
    expect(archetypeInstruction("carousel")).toMatch(/\[3 to 6 x/);
  });

  /*
   * ⚠ LES EXEMPLES MESURÉS PASSENT LE SCHÉMA, SAUF DEUX, ET ILS SONT NOMMÉS.
   *
   * Trouvé en écrivant ce test : deux des exemples « acceptés » du dépôt
   * contredisent la consigne par défaut — une paire de comparaison à TROIS
   * entrées de chaque côté là où `SHAPES` en demande deux, quatre stratégies là
   * où il en demande trois. `parse()` les accepte (2–4, 3–5) ; la consigne ne les
   * demande pas, et le schéma suit la consigne.
   *
   * Ces exemples ne sont montrés au modèle que sous `CONTENT_EXAMPLES=on`, éteint
   * par défaut. Allumés, ils montreraient au modèle une forme que la sortie
   * stricte lui interdit d'écrire. La liste est donc FERMÉE : un troisième écart
   * fait rougir ce test, et les deux connus sont consignés (FOLLOWUP F70).
   */
  const KNOWN_DIVERGENCE = ["comparison_pair#3", "numbered_strategies#0"];

  it("les exemples conformes du dépôt passent le schéma, sauf les deux écarts nommés", () => {
    const examples = JSON.parse(readFileSync("lib/content/generate/fixtures/conforming-examples.json", "utf8")) as
      Record<string, Array<{ payload: unknown }>>;
    const misses: string[] = [];
    for (const [key, list] of Object.entries(examples)) {
      for (const [i, ex] of list.entries()) {
        if (ARCHETYPES[key].parse(ex.payload) === null) continue;
        if (!schemaAccepts(payloadSchema(key), ex.payload)) misses.push(`${key}#${i}`);
      }
    }
    expect(misses, `exemple(s) conforme(s) que le schéma refuserait : ${misses.join(", ")}`).toEqual(KNOWN_DIVERGENCE);
  });
});

describe("3. les règles du mode strict sont tenues", () => {
  it.each(ALL)("« %s » : additionalProperties false et tout en required, à chaque niveau", (key: string) => {
    expect(strictViolations(payloadSchema(key))).toEqual([]);
  });

  it("le validateur des tests lève sur un mot-clef qu'il ne connaît pas", () => {
    expect(() => schemaAccepts({ type: "string", pattern: "x" }, "x")).toThrow(/unsupported keyword/);
  });
});
