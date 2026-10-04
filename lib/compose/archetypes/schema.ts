/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA FORME DES ONZE PAYLOADS, EN SCHÉMA JSON — POUR LA SORTIE STRICTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `provider.ts` le disait : la sortie structurée stricte était bloquée parce que
 * les archétypes n'avaient « pas de définition machine ». C'était à moitié vrai.
 * Ils en ont TROIS, et aucune n'est un schéma :
 *
 *   `parse()` de chaque module      la forme, lue par le moteur de composition
 *   `budgetErrors()` (budget.ts)    les bornes de mots
 *   `content_topic_payload_valid`   la même chose, en SQL, qui décide en base
 *
 * Ce fichier n'en ajoute pas une quatrième qui déciderait : il TRADUIT la forme
 * pour le seul usage qui exige un schéma — contraindre le modèle à la génération.
 * Ce qu'il accepte, `parse()` doit l'accepter aussi, et un test le vérifie sur
 * des échantillons aux bornes (`strict-schema-follows-parse.test.ts`). Le jour où
 * un module change de forme sans que ce fichier suive, ce test rougit.
 *
 * ── ⚠ IL DEMANDE CE QUE LA CONSIGNE DEMANDE, PAS CE QUE LA BASE TOLÈRE ───
 *
 * `parse()` accepte un cycle de trois à six nœuds ; la consigne en demande trois,
 * pour une raison mesurée (à quatre entrées et plus, un libellé tombe à 9,1 px
 * dans une vignette). Le schéma prend le compte de la CONSIGNE : il contraint ce
 * qu'on veut obtenir, et il reste dans ce que `parse()` accepte. Deux sources qui
 * diraient « trois » et « trois à six » ne sont pas en désaccord ; deux qui
 * diraient « quatre » et « trois » le seraient, et le test compare les comptes
 * écrits dans `SHAPES` à ceux d'ici.
 *
 * ── ⚠ CE QU'UN SCHÉMA NE SAIT PAS DIRE, ET QUI RESTE À `parse()` ────────
 *
 *   les mots    « un à trois mots » n'est pas exprimable proprement ; le budget
 *               reste vérifié par `budgetErrors`, puis par le CHECK en base.
 *   l'acronyme  « chaque libellé commence par la lettre de rang i » non plus ;
 *               le schéma borne l'acronyme à la liste de la consigne et le
 *               nombre d'items à quatre, `parse()` vérifie les initiales.
 *
 * Le schéma ne remplace donc aucune validation : il retire la classe d'échec
 * « forme » (champ absent, clef mal nommée, mauvais nombre d'items, texte avant
 * l'accolade) avant qu'elle soit payée.
 *
 * ── ⚠ LES RÈGLES DU MODE STRICT, TENUES ICI ─────────────────────────────
 *
 * Chaque objet porte `additionalProperties: false` et déclare TOUS ses champs
 * dans `required`. Un objet qui manquerait l'un ou l'autre fait refuser l'appel
 * entier par un 400 — et c'est le test, pas le fournisseur, qui doit le voir.
 */

export type JsonSchema = Record<string, unknown>;

const text: JsonSchema = { type: "string" };

function object(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

const item = object({ label: text, gloss: text });

function exactly(n: number, of: JsonSchema = item): JsonSchema {
  return { type: "array", items: of, minItems: n, maxItems: n };
}

/**
 * Les acronymes que la consigne autorise.
 *
 * ⚠ RECOPIÉS DE `SHAPES.lettered_technique`, ET UN TEST LES COMPARE. Ils
 * vivent dans la consigne parce que c'est elle qui interdit d'en inventer un ;
 * le schéma ne fait que rendre cette interdiction mécanique.
 */
export const LETTERED_ACRONYMS = [
  "RAIN", "STOP", "HALT", "SIFT", "TIPP", "GROW", "SAFE", "CALM", "NAME", "FACE",
] as const;

/**
 * Les payloads, par archétype, au compte que la consigne demande.
 *
 * ⚠ `practitioner_card` Y EST, MÊME S'IL N'EST PAS RÉDIGÉ PAR UN MODÈLE. Il est
 * assemblé depuis le brief ; son schéma sert à la parité avec les dix autres et
 * au test qui compare chaque module à son schéma.
 */
export const PAYLOAD_SCHEMAS: Record<string, JsonSchema> = {
  single_statement: object({ statement: text }),
  quadrant_model: object({ axis_x: text, axis_y: text, items: exactly(4) }),
  cycle: object({ nodes: exactly(3) }),
  surface_and_beneath: object({ surface: item, beneath: item }),
  comparison_pair: object({ left: exactly(2), right: exactly(2) }),
  numbered_strategies: object({ items: exactly(3) }),
  lettered_technique: object({
    acronym: { type: "string", enum: [...LETTERED_ACRONYMS] },
    items: exactly(4),
  }),
  concentric_control: object({ rings: exactly(3) }),
  annotated_curve: object({ axis_x: text, axis_y: text, points: exactly(3) }),
  practitioner_card: object({
    lines: { type: "array", items: text, minItems: 2, maxItems: 4 },
  }),
};

/**
 * Les panneaux d'un carrousel : un panneau par archétype intérieur, en `anyOf`.
 *
 * ⚠ LA CLEF ET LE PAYLOAD SONT LIÉS DANS CHAQUE BRANCHE. Un schéma qui
 * déclarerait `archetype_key` en `enum` à côté d'un `payload` en `anyOf`
 * laisserait passer une clef `cycle` avec un payload de quadrant — deux champs
 * justes, la jonction fausse, la classe de F27.
 */
export function carouselSchema(inner: readonly string[]): JsonSchema {
  return object({
    cards: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        anyOf: inner.map((key) =>
          object({
            archetype_key: { type: "string", enum: [key] },
            payload: payloadSchema(key),
          })
        ),
      },
    },
  });
}

/** Les archétypes qu'un carrousel peut contenir : tous sauf lui, et sauf la carte de praticienne. */
export const CAROUSEL_INNER = Object.keys(PAYLOAD_SCHEMAS).filter((k) => k !== "practitioner_card");

export function payloadSchema(archetypeKey: string): JsonSchema {
  if (archetypeKey === "carousel") return carouselSchema(CAROUSEL_INNER);
  const schema = PAYLOAD_SCHEMAS[archetypeKey];
  if (!schema) throw new Error(`schema: unknown archetype ${archetypeKey}`);
  return schema;
}

/* ── Un validateur minimal, pour le sous-ensemble employé ci-dessus ───── */

/**
 * Ce schéma accepte-t-il cette valeur ?
 *
 * ⚠ IL NE SERT QU'AUX TESTS ET À LA RELECTURE, JAMAIS À DÉCIDER. La décision
 * appartient à `validateCopy`, donc à `parse()` et à `budgetErrors`. Il couvre
 * exactement les mots-clefs qu'on emploie — `type`, `properties`, `required`,
 * `additionalProperties`, `items`, `minItems`, `maxItems`, `enum`, `anyOf` — et
 * LÈVE sur tout autre, pour qu'un mot-clef ajouté sans être compris ne passe pas
 * en silence pour satisfait.
 */
export function schemaAccepts(schema: JsonSchema, value: unknown): boolean {
  const known = new Set([
    "type", "properties", "required", "additionalProperties", "items",
    "minItems", "maxItems", "enum", "anyOf", "description",
  ]);
  for (const key of Object.keys(schema)) {
    if (!known.has(key)) throw new Error(`schemaAccepts: unsupported keyword ${key}`);
  }

  if (Array.isArray(schema.anyOf)) {
    return (schema.anyOf as JsonSchema[]).some((branch) => schemaAccepts(branch, value));
  }
  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).includes(value)) return false;

  switch (schema.type) {
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "array": {
      if (!Array.isArray(value)) return false;
      if (typeof schema.minItems === "number" && value.length < schema.minItems) return false;
      if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return false;
      return value.every((v) => schemaAccepts(schema.items as JsonSchema, v));
    }
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const o = value as Record<string, unknown>;
      const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
      for (const key of (schema.required ?? []) as string[]) if (!(key in o)) return false;
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(o)) if (!(key in properties)) return false;
      }
      return Object.entries(properties).every(([key, sub]) => !(key in o) || schemaAccepts(sub, o[key]));
    }
    default:
      throw new Error(`schemaAccepts: unsupported type ${String(schema.type)}`);
  }
}

/**
 * Les violations des règles du mode strict, ou une liste vide.
 *
 * ⚠ C'EST LE FOURNISSEUR QUI LES REFUSE, MAIS PAR UN 400 QUI COÛTE UN APPEL ET
 * NE DIT RIEN DU POST. Les voir ici les rend gratuites.
 */
export function strictViolations(schema: JsonSchema, path = "$"): string[] {
  const out: string[] = [];
  if (Array.isArray(schema.anyOf)) {
    (schema.anyOf as JsonSchema[]).forEach((b, i) => out.push(...strictViolations(b, `${path}.anyOf[${i}]`)));
  }
  if (schema.type === "object") {
    const properties = Object.keys((schema.properties ?? {}) as object);
    if (schema.additionalProperties !== false) out.push(`${path}: additionalProperties n'est pas false`);
    const required = new Set((schema.required ?? []) as string[]);
    for (const p of properties) if (!required.has(p)) out.push(`${path}.${p}: absent de required`);
    for (const [p, sub] of Object.entries((schema.properties ?? {}) as Record<string, JsonSchema>)) {
      out.push(...strictViolations(sub, `${path}.${p}`));
    }
  }
  if (schema.type === "array" && schema.items) out.push(...strictViolations(schema.items as JsonSchema, `${path}[]`));
  return out;
}
