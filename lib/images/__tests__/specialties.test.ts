import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BRIEF_SPECIALTY_IDS,
  NEUTRAL_OBJECT_REGISTER,
  OBJECT_REGISTER_BY_SPECIALTY,
  objectRegisterFor,
} from "@/lib/images/specialties";

/*
 * ── LA COUVERTURE, ET POURQUOI CE TEST EXISTE ───────────────────────────
 *
 * L'ancienne carte était écrite d'imagination : « couples therapy »,
 * « eating disorders », « substance use » -- trois clés que le brief ne peut
 * pas produire -- et il lui manquait six spécialités réelles. `Self-esteem`
 * est donc tombé dans le repli, et le repli était un fauteuil vide isolé,
 * l'image de stock la plus utilisée de la catégorie.
 *
 * Une carte de dix clés devinées n'est pas un correctif. Un test qui échoue
 * le jour où le brief gagne une spécialité que la carte ne couvre pas, si.
 */

const CATALOG_MIGRATION = resolve(
  __dirname,
  "../../../../eklio-backend/supabase/migrations/20260827100000_catalog_reference_data.sql"
);

describe("chaque spécialité du brief a son registre d'objets", () => {
  it.each(BRIEF_SPECIALTY_IDS)("« %s » ne tombe pas dans le repli", (id) => {
    const register = objectRegisterFor(id);
    expect(register).not.toBe(NEUTRAL_OBJECT_REGISTER);
    expect(register.length).toBeGreaterThan(20);
  });

  it("la carte ne contient aucune clé que le brief ne peut pas produire", () => {
    // L'autre moitié de la couverture : une clé morte est une clé écrite
    // d'imagination, et c'est exactement ce qui a produit le fauteuil.
    expect(Object.keys(OBJECT_REGISTER_BY_SPECIALTY).sort()).toEqual([...BRIEF_SPECIALTY_IDS].sort());
  });
});

describe("le repli dégrade vers quelque chose de bon", () => {
  it("une spécialité inconnue, ou absente, rend le registre neutre", () => {
    expect(objectRegisterFor("a_specialty_nobody_mapped")).toBe(NEUTRAL_OBJECT_REGISTER);
    expect(objectRegisterFor(null)).toBe(NEUTRAL_OBJECT_REGISTER);
    expect(objectRegisterFor("")).toBe(NEUTRAL_OBJECT_REGISTER);
  });

  it("le repli n'est PAS du mobilier", () => {
    // La règle apprise du fauteuil : un échec de correspondance doit dégrader
    // vers une nature morte, jamais vers un meuble.
    expect(NEUTRAL_OBJECT_REGISTER).toContain("ceramic vase");
    expect(NEUTRAL_OBJECT_REGISTER.toLowerCase()).not.toContain("chair");
  });
});

describe("aucun registre n'est du mobilier ni du clinique", () => {
  const ALL = [NEUTRAL_OBJECT_REGISTER, ...Object.values(OBJECT_REGISTER_BY_SPECIALTY)];

  it.each(ALL)("« %s » ne nomme aucun siège", (register) => {
    // Jamais un fauteuil, jamais un canapé, jamais une chaise d'aucune sorte.
    for (const seat of ["chair", "armchair", "couch", "sofa", "recliner"]) {
      expect(register.toLowerCase()).not.toContain(seat);
    }
  });

  it.each(ALL)("« %s » ne dépeint aucune condition", (register) => {
    // Le registre évoque une pièce, jamais un diagnostic.
    for (const clinical of [
      "pill", "medication", "scale", "food", "bottle", "prescription",
      "journal", "diagnosis", "therapy session", "tissue",
    ]) {
      expect(register.toLowerCase()).not.toContain(clinical);
    }
  });
});

describe("la liste des spécialités n'a pas dérivé du catalogue", () => {
  /*
   * `BRIEF_SPECIALTY_IDS` est un instantané du catalogue, comme la table de
   * prix. Quand eklio-backend est présent à côté de ce dépôt -- le cas en
   * développement -- on lit la migration qui sème `public.specialties` et on
   * exige l'égalité. En CI sans le dépôt voisin, ce test se retire, mais la
   * couverture ci-dessus, elle, tourne toujours.
   */
  const available = existsSync(CATALOG_MIGRATION);

  it.skipIf(!available)("elle correspond exactement à ce que sème la migration", () => {
    const sql = readFileSync(CATALOG_MIGRATION, "utf8");
    const block = sql.slice(sql.indexOf("insert into public.specialties"));
    const seeded = [...block.slice(0, block.indexOf(";")).matchAll(/\(\s*'([a-z_]+)'\s*,/g)].map(
      (match) => match[1]
    );

    expect(seeded.length).toBeGreaterThan(5);
    expect([...BRIEF_SPECIALTY_IDS].sort()).toEqual(seeded.sort());
  });

  it("l'instantané dit d'où il vient", () => {
    // Sans la date et la requête, personne ne peut le revérifier -- même
    // discipline que la table de prix.
    const source = readFileSync(resolve(__dirname, "../specialties.ts"), "utf8");
    expect(source).toContain("select id from public.specialties order by sort_order;");
    expect(source).toContain("2026-09-06");
  });
});

describe("un registre ne décrit jamais la lumière", () => {
  /*
   * Le maître possède la lumière : une seule, chaude, de fin d'après-midi,
   * venant du haut à gauche, pour toutes les images. Un registre qui en
   * mentionne une autre est le défaut 2 en miniature -- exactement ce qui a
   * donné une fenêtre grise sous une dominante chaude.
   *
   * On ne balaye QUE les registres. Le tiers gauche du brief héros dit
   * « plain sunlit wall » : c'est de la composition, pas un registre, et il
   * reste mot pour mot.
   */
  const FORBIDDEN_VOCABULARY = [
    "light", "lights", "lit", "sunlit", "backlit", "daylight", "sunlight", "lighting",
    "bright", "dim", "shadow", "shadows", "sunny", "overcast", "cloudy", "weather",
    "morning", "afternoon", "evening", "dusk", "dawn", "midday", "noon", "night",
    "sunrise", "sunset", "hour", "lens", "camera", "bokeh", "aperture", "exposure",
    "shutter", "focal", "grain", "vignette",
  ];

  const ALL_REGISTERS = [NEUTRAL_OBJECT_REGISTER, ...Object.values(OBJECT_REGISTER_BY_SPECIALTY)];

  it.each(ALL_REGISTERS)("« %s » ne nomme ni lumière, ni heure, ni objectif", (register) => {
    const words = register.toLowerCase().match(/[a-z]+/g) ?? [];
    const offenders = words.filter((word) => FORBIDDEN_VOCABULARY.includes(word));
    expect(
      offenders,
      "Un registre nomme des objets et des matières, jamais la lumière, l'heure,\n" +
        "la météo, un objectif ni un appareil. La direction maîtresse s'en charge,\n" +
        "et deux consignes de lumière dans un même prompt se contredisent."
    ).toEqual([]);
  });

  it("l'énumération interdite est bien appliquée, pas vacuously vraie", () => {
    // Témoin : une chaîne fautive DOIT être attrapée par la même règle.
    const canary = "a folded linen cloth, early light across the wall";
    const words = canary.toLowerCase().match(/[a-z]+/g) ?? [];
    expect(words.filter((word) => FORBIDDEN_VOCABULARY.includes(word))).toEqual(["light"]);
  });
});
